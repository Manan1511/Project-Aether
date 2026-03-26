export const maxDuration = 300; // 5 minutes max duration for Vercel/Next.js
export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

/* ────────────────────────────────────────
   Constants
   ──────────────────────────────────────── */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
let rawUrl = process.env.RAG_BACKEND_URL || "http://127.0.0.1:8000";
rawUrl = rawUrl.replace("localhost", "127.0.0.1");
const RAG_BACKEND_URL = rawUrl;

/* ────────────────────────────────────────
   Types (matching Python backend response)
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

interface RAGResponse {
  success: boolean;
  concepts: ExtractedConcept[];
  questions: Record<number, GeneratedQuestion[]>;
  conceptCount: number;
  questionCount: number;
}

/* ────────────────────────────────────────
   POST handler
   ──────────────────────────────────────── */

export async function POST(request: NextRequest) {
  try {
    const { documentId, text, pageCount } = await request.json();

    if (!documentId || !text) {
      return NextResponse.json(
        { error: "Missing documentId or text" },
        { status: 400 }
      );
    }

    if (!SUPABASE_SERVICE_KEY) {
      return NextResponse.json(
        {
          error:
            "Server configuration error: SUPABASE_SERVICE_ROLE_KEY is not set. Please add it to .env.local.",
        },
        { status: 500 }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    /* ── Step 1: Call the Python RAG backend ── */
    let ragResult: RAGResponse;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minutes

      const ragResponse = await fetch(`${RAG_BACKEND_URL}/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, text, pageCount }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!ragResponse.ok) {
        const errBody = await ragResponse.json().catch(() => ({}));
        const detail = (errBody as Record<string, string>).detail || "";
        
        if (detail.includes("ResourceExhausted") || detail.includes("RetryError")) {
          throw new Error("Google Gemini API quota exceeded (15 requests/minute). Please wait 60 seconds and try again.");
        }
        
        throw new Error(detail || `RAG backend returned ${ragResponse.status}`);
      }

      ragResult = (await ragResponse.json()) as RAGResponse;
    } catch (fetchErr: unknown) {
      console.error("--- RAG BACKEND FETCH CRITICAL FAILURE ---");
      const err = fetchErr as Record<string, unknown>;
      console.error("Message:", String(err?.message ?? ""));
      console.error("Stack:", String(err?.stack ?? ""));

      const message = fetchErr instanceof Error ? fetchErr.message : "Unknown error";
      
      if (message.includes("quota exceeded") || message.includes("RAG backend returned")) {
        throw new Error(message); // Pass through explicit backend errors
      }
      
      throw new Error(
        `RAG backend is unreachable (${RAG_BACKEND_URL}). ` +
          `Make sure the Python server is running: cd backend && uvicorn main:app --reload. ` +
          `Original error: ${message} (Cause: ${fetchErr?.cause?.message || "unknown"})`
      );
    }

    const { concepts, questions } = ragResult;

    /* ── Step 2: Insert concepts into Supabase ── */
    const conceptRows = concepts.map((c) => ({
      document_id: documentId,
      label: c.label,
      source_chunk: c.source_chunk,
      position: c.position,
      prerequisite_concept_ids: [] as string[],
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
      if (
        concept.prerequisite_positions &&
        concept.prerequisite_positions.length > 0
      ) {
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

    /* ── Step 3: Insert questions into Supabase ── */
    let totalQuestions = 0;

    for (const concept of concepts) {
      const conceptId = positionToId.get(concept.position);
      if (!conceptId) continue;

      const conceptQuestions = questions[concept.position] || [];
      for (const q of conceptQuestions) {
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
            failure_reason:
              err instanceof Error ? err.message : "Unknown error",
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
