import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

/* ────────────────────────────────────────
   Constants
   ──────────────────────────────────────── */

const MAX_CHUNK_SIZE = 4000;
const MAX_RETRIES = 1;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash",
  generationConfig: {
    responseMimeType: "application/json",
  },
});

/* ────────────────────────────────────────
   Helpers
   ──────────────────────────────────────── */

function chunkText(text: string, size: number = MAX_CHUNK_SIZE): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\s*\n/);
  let current = "";

  for (const para of paragraphs) {
    if ((current + "\n\n" + para).length > size && current.length > 0) {
      chunks.push(current.trim());
      current = para;
    } else {
      current += (current ? "\n\n" : "") + para;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));

async function parseJSON<T>(promptText: string, retries = MAX_RETRIES): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await model.generateContent(promptText);
      
      let raw = "";
      try {
        raw = result.response.text().trim();
      } catch (textErr) {
        console.error("AI response text extraction failed:", textErr);
        throw new Error("AI returned an empty or blocked response. Please try again.");
      }

      // Strip markdown fences if present
      const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
      return JSON.parse(cleaned) as T;
    } catch (err: any) {
      if (err instanceof SyntaxError) {
        if (attempt === retries) throw new Error("Failed to parse AI response as JSON.");
        console.warn(`JSON parse attempt ${attempt + 1} failed, retrying in 3.5s…`);
        await wait(3500); // 3.5s delay to avoid immediately hitting rate limit again
      } else {
        // API error (429 Rate Limit, 500, etc.)
        if (attempt === retries) {
            console.error("Gemini API Error after retries:", err);
            throw new Error(err.message || "Google Gemini API error occurred.");
        }
        console.warn(`Gemini API error (attempt ${attempt + 1}):`, err.message, "Retrying in 4s...");
        await wait(4000); // Wait 4 seconds for API rate limits to reset
      }
    }
  }
  throw new Error("Unreachable");
}

async function groundingCheck(
  sourceChunk: string,
  questionText: string,
  correctAnswer: string
): Promise<boolean> {
  const check = await model.generateContent(
    `Does the following question and its correct answer appear in the source text provided? Answer YES or NO only, no explanation.\n\nSource text:\n${sourceChunk}\n\nQuestion:\n${questionText}\n\nCorrect answer:\n${correctAnswer}`
  );
  const verdict = check.response.text().trim().toUpperCase();
  return verdict.startsWith("YES");
}

/* ────────────────────────────────────────
   Types
   ──────────────────────────────────────── */

interface ExtractedConcept {
  label: string;
  source_chunk: string;
  position: number;
  prerequisite_positions: number[];
}

interface GeneratedQuestion {
  question_type: "theoretical" | "applicative";
  question_text: string;
  options: string[];
  correct_option_index: number;
  explanation_excerpt: string;
  scaffold_steps: string[] | null;
}

/* ────────────────────────────────────────
   POST handler
   ──────────────────────────────────────── */

export async function POST(request: NextRequest) {
  try {
    const { documentId, text, pageCount } = await request.json();

    if (!documentId || !text) {
      return NextResponse.json({ error: "Missing documentId or text" }, { status: 400 });
    }

    if (!SUPABASE_SERVICE_KEY) {
      return NextResponse.json(
        { error: "Server configuration error: SUPABASE_SERVICE_ROLE_KEY is not set. Please add it to .env.local." },
        { status: 500 }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const chunks = chunkText(text);

    /* ── Step 1: Extract concepts ── */
    const conceptPrompt = `You are analysing only the provided text. Do not use any external knowledge. Do not reference anything not present in the text below.

Analyse the following document text and extract the key concepts that a student should learn. For each concept, provide:
- label: A short, clear name for the concept
- source_chunk: The relevant excerpt from the text that explains this concept
- position: An integer starting from 0, indicating the learning order
- prerequisite_positions: An array of position integers that must be learned before this concept (empty array if none)

Order concepts by dependency — foundational concepts first.

Document text:
${chunks.join("\n\n---\n\n")}

Return only valid JSON. No markdown fences, no explanation, no preamble. Only the raw JSON array.

Expected format:
[{"label": "...", "source_chunk": "...", "position": 0, "prerequisite_positions": []}, ...]`;

    const concepts = await parseJSON<ExtractedConcept[]>(conceptPrompt);

    /* ── Step 2: Insert concepts ── */
    const conceptRows = concepts.map((c) => ({
      document_id: documentId,
      label: c.label,
      source_chunk: c.source_chunk,
      position: c.position,
      prerequisite_concept_ids: [] as string[], // Will be resolved after insert
    }));

    const { data: insertedConcepts, error: conceptError } = await supabase
      .from("concepts")
      .insert(conceptRows)
      .select("id, position");

    if (conceptError) throw conceptError;

    // Build position → ID map for prerequisite resolution
    const positionToId = new Map<number, string>();
    insertedConcepts?.forEach((c) => positionToId.set(c.position, c.id));

    // Update prerequisite_concept_ids
    for (const concept of concepts) {
      if (concept.prerequisite_positions.length > 0) {
        const prereqIds = concept.prerequisite_positions
          .map((pos) => positionToId.get(pos))
          .filter(Boolean) as string[];

        const conceptId = positionToId.get(concept.position);
        if (conceptId && prereqIds.length > 0) {
          await supabase
            .from("concepts")
            .update({ prerequisite_concept_ids: prereqIds })
            .eq("id", conceptId);
        }
      }
    }

    /* ── Step 3: Generate questions per concept ── */
    let totalQuestions = 0;

    for (const concept of concepts) {
      const conceptId = positionToId.get(concept.position);
      if (!conceptId) continue;

      const questionPrompt = `You are analysing only the provided text. Do not use any external knowledge. Do not reference anything not present in the text below.

Generate exactly 2 multiple-choice questions about the following concept from a document. One question should be "theoretical" (testing understanding of the concept) and one should be "applicative" (testing ability to apply the concept).

Concept: ${concept.label}
Source text: ${concept.source_chunk}

For each question:
- question_type: "theoretical" or "applicative"
- question_text: The question
- options: Array of exactly 4 answer options (strings)
- correct_option_index: Index (0-3) of the correct option
- explanation_excerpt: A short excerpt from the source text that explains why the answer is correct
- scaffold_steps: For applicative questions only, provide an array of 3-4 step-by-step hints. For theoretical questions, set to null.

Return only valid JSON. No markdown fences, no explanation, no preamble. Only the raw JSON array.

Expected format:
[{"question_type": "theoretical", "question_text": "...", "options": ["A", "B", "C", "D"], "correct_option_index": 0, "explanation_excerpt": "...", "scaffold_steps": null}, ...]`;

      const questions = await parseJSON<GeneratedQuestion[]>(questionPrompt);

      for (const q of questions) {
        // Grounding check
        const correctAnswer = q.options[q.correct_option_index];
        const grounded = await groundingCheck(
          concept.source_chunk,
          q.question_text,
          correctAnswer
        );

        if (!grounded) {
          // Retry once with regeneration
          console.warn(`Grounding failed for "${q.question_text}", regenerating…`);
          const retryPrompt = `You are analysing only the provided text. Do not use any external knowledge. Do not reference anything not present in the text below.

Generate ONE ${q.question_type} multiple-choice question about this concept. The question and correct answer MUST be directly answerable from the source text.

Concept: ${concept.label}
Source text: ${concept.source_chunk}

Return only valid JSON. No markdown fences, no explanation, no preamble. Only the raw JSON object.

Expected format:
{"question_type": "${q.question_type}", "question_text": "...", "options": ["A", "B", "C", "D"], "correct_option_index": 0, "explanation_excerpt": "...", "scaffold_steps": ${q.question_type === "applicative" ? '["step1", "step2", "step3"]' : "null"}}`;

          try {
            const retryQ = await parseJSON<GeneratedQuestion>(retryPrompt);
            const retryGrounded = await groundingCheck(
              concept.source_chunk,
              retryQ.question_text,
              retryQ.options[retryQ.correct_option_index]
            );

            if (retryGrounded) {
              await supabase.from("questions").insert({
                concept_id: conceptId,
                question_type: retryQ.question_type,
                question_text: retryQ.question_text,
                options: retryQ.options,
                correct_option_index: retryQ.correct_option_index,
                explanation_excerpt: retryQ.explanation_excerpt,
                scaffold_steps: retryQ.scaffold_steps,
                grounding_verified: true,
              });
              totalQuestions++;
            }
            // If retry also fails grounding, skip this question
          } catch {
            console.warn("Retry question generation failed, skipping");
          }
          continue;
        }

        await supabase.from("questions").insert({
          concept_id: conceptId,
          question_type: q.question_type,
          question_text: q.question_text,
          options: q.options,
          correct_option_index: q.correct_option_index,
          explanation_excerpt: q.explanation_excerpt,
          scaffold_steps: q.scaffold_steps,
          grounding_verified: true,
        });
        totalQuestions++;
      }
    }

    /* ── Step 4: Update document status ── */
    await supabase
      .from("documents")
      .update({
        status: "ready",
        total_concepts: concepts.length,
      })
      .eq("id", documentId);

    return NextResponse.json({
      success: true,
      conceptCount: concepts.length,
      questionCount: totalQuestions,
    });
  } catch (err) {
    console.error("Ingest error:", err);

    // Try to mark document as failed
    try {
      const { documentId } = await request.clone().json();
      if (documentId) {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
        await supabase
          .from("documents")
          .update({
            status: "failed",
            failure_reason: err instanceof Error ? err.message : "Unknown error",
          })
          .eq("id", documentId);
      }
    } catch {
      // Best effort
    }

    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ingestion failed" },
      { status: 500 }
    );
  }
}
