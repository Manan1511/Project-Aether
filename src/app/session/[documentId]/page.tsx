"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSessionStore } from "@/stores/sessionStore";
import {
  calculateConfidenceUpdate,
  getPivotForAttempt,
  planSessionConcepts,
  type ConceptPerformance,
} from "@/lib/adaptiveEngine";
import {
  speakText,
  pauseSpeech,
  resumeSpeech,
  stopSpeech,
  isSpeaking,
  isPaused,
  isTTSSupported,
} from "@/lib/tts";
import type { Question } from "@/stores/sessionStore";

const SPEED_OPTIONS = [0.75, 1.0, 1.25] as const;

export default function SessionPage({
  params,
}: {
  params: { documentId: string };
}) {
  const { documentId } = params;
  const router = useRouter();
  const supabase = createClient();
  const store = useSessionStore();

  const [loading, setLoading] = useState(true);
  const [ttsSupported, setTtsSupported] = useState(true);
  const [audioTriggered, setAudioTriggered] = useState(false);

  // Load session data
  useEffect(() => {
    if (store.status !== "idle") return;

    async function initSession() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth/login"); return; }

      // Get user preferences
      const { data: prefs } = await supabase
        .from("user_preferences")
        .select("session_length, audio_speed")
        .eq("user_id", user.id)
        .single();

      const sessionLength = prefs?.session_length ?? 7;
      if (prefs?.audio_speed) store.setAudioSpeed(prefs.audio_speed);

      // Get concepts for this document
      const { data: concepts } = await supabase
        .from("concepts")
        .select("id, position, prerequisite_concept_ids")
        .eq("document_id", documentId)
        .order("position");

      if (!concepts || concepts.length === 0) {
        router.push("/library");
        return;
      }

      // Get concept performance
      const { data: perfData } = await supabase
        .from("concept_performance")
        .select("*")
        .eq("user_id", user.id)
        .eq("document_id", documentId);

      const perfMap = new Map<string, ConceptPerformance>();
      perfData?.forEach((p) =>
        perfMap.set(p.concept_id, {
          concept_id: p.concept_id,
          confidence_state: p.confidence_state,
          first_attempt_correct_count: p.first_attempt_correct_count,
          corrected_to_correct_count: p.corrected_to_correct_count,
          incorrect_count: p.incorrect_count,
        })
      );

      // Plan session concepts
      const plannedConceptIds = planSessionConcepts(concepts, perfMap);
      if (plannedConceptIds.length === 0) {
        router.push("/library");
        return;
      }

      // Get questions for planned concepts
      const { data: questions } = await supabase
        .from("questions")
        .select("*")
        .in("concept_id", plannedConceptIds.slice(0, sessionLength))
        .eq("grounding_verified", true)
        .order("created_at");

      if (!questions || questions.length === 0) {
        router.push("/library");
        return;
      }

      const questionsPlanned = Math.min(sessionLength, questions.length);

      // Create session row
      const { data: session } = await supabase
        .from("sessions")
        .insert({
          user_id: user.id,
          document_id: documentId,
          questions_planned: questionsPlanned,
          status: "active",
        })
        .select("id")
        .single();

      if (!session) { router.push("/library"); return; }

      store.startSession(
        session.id,
        documentId,
        questions.slice(0, questionsPlanned) as Question[],
        questionsPlanned
      );
      setLoading(false);
    }

    setTtsSupported(isTTSSupported());
    initSession();

    return () => { stopSpeech(); };
  }, [documentId, store.status, router, supabase, store]);

  // Spacebar handler
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.code === "Space" && e.target === document.body) {
        e.preventDefault();
        if (isSpeaking() && !isPaused()) {
          pauseSpeech();
          store.setAudioPlaying(false);
        } else if (isPaused()) {
          resumeSpeech();
          store.setAudioPlaying(true);
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [store]);

  const currentQuestion = store.questions[store.currentIndex];

  const handleSubmit = useCallback(async () => {
    if (!currentQuestion || store.selectedOptionIndex === null) return;

    store.submitAnswer();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const isCorrect = store.selectedOptionIndex === currentQuestion.correct_option_index;
    const pivotType = isCorrect ? null : getPivotForAttempt(
      currentQuestion.question_type,
      store.pivotAttempt
    );

    // Record session event
    await supabase.from("session_events").insert({
      session_id: store.sessionId,
      question_id: currentQuestion.id,
      concept_id: currentQuestion.concept_id,
      answer_index: store.selectedOptionIndex,
      is_correct: isCorrect,
      answer_changes: store.answerChanges,
      pivot_triggered: pivotType,
    });

    // Update concept performance
    const { data: existing } = await supabase
      .from("concept_performance")
      .select("*")
      .eq("user_id", user.id)
      .eq("concept_id", currentQuestion.concept_id)
      .single();

    const currentPerf: ConceptPerformance = existing || {
      concept_id: currentQuestion.concept_id,
      confidence_state: "unseen",
      first_attempt_correct_count: 0,
      corrected_to_correct_count: 0,
      incorrect_count: 0,
    };

    const { updated } = calculateConfidenceUpdate(currentPerf, {
      isCorrect,
      answerChanges: store.answerChanges,
    });

    await supabase.from("concept_performance").upsert({
      user_id: user.id,
      concept_id: currentQuestion.concept_id,
      document_id: documentId,
      confidence_state: updated.confidence_state,
      first_attempt_correct_count: updated.first_attempt_correct_count,
      corrected_to_correct_count: updated.corrected_to_correct_count,
      incorrect_count: updated.incorrect_count,
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,concept_id" });

    // Update session
    await supabase
      .from("sessions")
      .update({
        questions_answered: store.questionsAnswered,
        concepts_covered: Array.from(new Set(
          store.questions.slice(0, store.currentIndex + 1).map(q => q.concept_id)
        )),
      })
      .eq("id", store.sessionId);
  }, [currentQuestion, store, supabase, documentId]);

  const handleNext = useCallback(() => {
    stopSpeech();
    store.setAudioPlaying(false);
    setAudioTriggered(false);

    if (store.questionsAnswered >= store.questionsPlanned) {
      store.completeSession();
      return;
    }

    // If incorrect and pivot not exhausted, trigger pivot
    if (!store.isCorrect && store.pivotAttempt < 3) {
      const pivot = getPivotForAttempt(
        currentQuestion.question_type,
        store.pivotAttempt + 1
      );
      if (pivot) {
        store.triggerPivot(pivot);
        return;
      }
    }

    store.nextQuestion();
  }, [store, currentQuestion]);

  const handleReadAloud = useCallback(() => {
    if (!currentQuestion) return;
    setAudioTriggered(true);
    speakText(currentQuestion.question_text, store.audioSpeed, () => {
      store.setAudioPlaying(false);
    });
    store.setAudioPlaying(true);
  }, [currentQuestion, store]);

  const handleSpeedChange = useCallback((speed: number) => {
    store.setAudioSpeed(speed);
    stopSpeech();
    if (currentQuestion) {
      speakText(currentQuestion.question_text, speed, () => {
        store.setAudioPlaying(false);
      });
      store.setAudioPlaying(true);
    }
    // Save to preferences
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase
          .from("user_preferences")
          .update({ audio_speed: speed, updated_at: new Date().toISOString() })
          .eq("user_id", user.id);
      }
    });
  }, [currentQuestion, store, supabase]);

  // Session completed
  if (store.status === "completed") {
    return (
      <SessionEndView
        questionsAnswered={store.questionsAnswered}
        questionsPlanned={store.questionsPlanned}
        sessionId={store.sessionId!}
      />
    );
  }

  if (loading || !currentQuestion) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        minHeight: "calc(100dvh - 5rem)",
      }}>
        <div className="aether-loading" style={{ width: "64px", height: "64px" }} />
      </div>
    );
  }

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      minHeight: "calc(100dvh - 5rem)", padding: "2rem",
    }}>
      <div style={{ width: "100%", maxWidth: "640px" }}>
        {/* Progress */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: "2rem",
        }}>
          <span className="text-label-md" style={{ color: "var(--color-on-surface-variant)" }}>
            Question {store.currentIndex + 1} of {store.questionsPlanned}
          </span>
          <div style={{
            flex: 1, marginLeft: "1rem", height: "4px",
            backgroundColor: "var(--color-surface-container-high)",
            borderRadius: "2px", overflow: "hidden",
          }}>
            <div style={{
              width: `${((store.currentIndex + 1) / store.questionsPlanned) * 100}%`,
              height: "100%", backgroundColor: "var(--color-primary)",
              borderRadius: "2px", transition: "width 120ms ease",
            }} />
          </div>
        </div>

        {/* Pivot view */}
        {store.pivotActive && (
          <div className="aether-card" style={{
            marginBottom: "1.5rem",
            backgroundColor: "var(--color-surface-container-low)",
          }}>
            {store.pivotActive === "simplified_text" && (
              <div>
                <span className="text-label-md" style={{ color: "var(--color-primary-bright)" }}>
                  Let&apos;s review the concept
                </span>
                <p className="text-body-lg" style={{ marginTop: "0.75rem" }}>
                  {currentQuestion.explanation_excerpt}
                </p>
              </div>
            )}
            {store.pivotActive === "scaffold" && currentQuestion.scaffold_steps && (
              <div>
                <span className="text-label-md" style={{ color: "var(--color-primary-bright)" }}>
                  Step-by-step guidance
                </span>
                <div style={{ marginTop: "0.75rem" }}>
                  {currentQuestion.scaffold_steps.map((step, i) => (
                    <div key={i} style={{
                      padding: "0.75rem",
                      marginBottom: "0.5rem",
                      opacity: i <= store.currentScaffoldStep ? 1 : 0.3,
                      backgroundColor: i <= store.currentScaffoldStep
                        ? "var(--color-surface-container)"
                        : "transparent",
                      borderRadius: "var(--radius-input)",
                      transition: "opacity 120ms ease",
                    }}>
                      <span className="text-label-md" style={{ color: "var(--color-secondary-text)" }}>
                        Step {i + 1}
                      </span>
                      <p className="text-body-lg" style={{ marginTop: "0.25rem" }}>
                        {i <= store.currentScaffoldStep ? step : "…"}
                      </p>
                    </div>
                  ))}
                  {store.currentScaffoldStep < currentQuestion.scaffold_steps.length - 1 && (
                    <button
                      className="btn-secondary"
                      onClick={() => store.advanceScaffold()}
                      style={{ marginTop: "0.5rem" }}
                    >
                      Next step
                    </button>
                  )}
                </div>
              </div>
            )}
            {store.pivotActive === "source_excerpt" && (
              <div>
                <span className="text-label-md" style={{ color: "var(--color-primary-bright)" }}>
                  From the source text
                </span>
                <blockquote style={{
                  marginTop: "0.75rem",
                  paddingLeft: "1rem",
                  borderLeft: "3px solid var(--color-primary)",
                  fontStyle: "italic",
                }}>
                  <p className="text-body-lg">
                    {currentQuestion.explanation_excerpt}
                  </p>
                </blockquote>
                {ttsSupported && (
                  <button
                    className="btn-tertiary"
                    onClick={() => speakText(currentQuestion.explanation_excerpt, store.audioSpeed)}
                    style={{ marginTop: "0.5rem" }}
                  >
                    🔊 Read aloud
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Question container (Focus Mode: No card background) */}
        <div style={{ marginBottom: "2rem" }}>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            marginBottom: "1rem",
          }}>
            <span className="text-label-md" style={{ color: "var(--color-primary-bright)" }}>
              {currentQuestion.question_type === "theoretical" ? "Understanding" : "Application"}
            </span>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              {ttsSupported && (
                <button
                  id="read-aloud-btn"
                  className="btn-tertiary"
                  onClick={store.audioPlaying ? () => { pauseSpeech(); store.setAudioPlaying(false); } : handleReadAloud}
                  style={{ fontSize: "0.8125rem" }}
                >
                  {store.audioPlaying ? "⏸ Pause" : "🔊 Read aloud"}
                </button>
              )}
              {!ttsSupported && (
                <span style={{ fontSize: "0.75rem", color: "var(--color-secondary-text)" }}>
                  Audio not available in this browser
                </span>
              )}
            </div>
          </div>

          <h2 className="text-title-lg" style={{ marginBottom: "1.5rem" }}>
            {currentQuestion.question_text}
          </h2>

          {/* Speed controls — only shown after audio triggered */}
          {audioTriggered && ttsSupported && (
            <div style={{
              display: "flex", gap: "0.5rem", marginBottom: "1.5rem",
            }}>
              {SPEED_OPTIONS.map((speed) => (
                <button
                  key={speed}
                  className={store.audioSpeed === speed ? "btn-primary" : "btn-secondary"}
                  onClick={() => handleSpeedChange(speed)}
                  style={{ fontSize: "0.75rem", padding: "0.4rem 0.75rem" }}
                >
                  {speed}×
                </button>
              ))}
            </div>
          )}

          {/* Options */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {currentQuestion.options.map((option, i) => {
              const isSelected = store.selectedOptionIndex === i;
              const isCorrect = i === currentQuestion.correct_option_index;
              const showResult = store.answerSubmitted;

              let bgColor = "var(--color-surface-container-high)";
              let borderColor = "transparent";

              if (showResult && isCorrect) {
                bgColor = "var(--color-primary-container)";
                borderColor = "var(--color-primary)";
              } else if (showResult && isSelected && !isCorrect) {
                bgColor = "var(--color-error-container)";
                borderColor = "var(--color-error)";
              } else if (isSelected) {
                borderColor = "var(--color-primary)";
              }

              return (
                <button
                  key={i}
                  id={`option-${i}`}
                  onClick={() => store.selectOption(i)}
                  disabled={store.answerSubmitted}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "1rem 1.25rem",
                    backgroundColor: bgColor,
                    border: `2px solid ${borderColor}`,
                    borderRadius: "var(--radius-input)",
                    cursor: store.answerSubmitted ? "default" : "pointer",
                    transition: "all 120ms ease",
                    textAlign: "left",
                    width: "100%",
                    minHeight: "64px",
                    fontFamily: "var(--font-body)",
                    fontSize: "1rem",
                    color: "var(--color-on-surface)",
                  }}
                >
                  <span style={{
                    width: "28px", height: "28px", borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    backgroundColor: isSelected
                      ? "var(--color-primary)"
                      : "var(--color-surface-container)",
                    color: isSelected ? "var(--color-on-primary)" : "var(--color-on-surface-variant)",
                    fontSize: "0.8125rem", fontWeight: 600, flexShrink: 0,
                    fontFamily: "var(--font-label)",
                  }}>
                    {String.fromCharCode(65 + i)}
                  </span>
                  {option}
                </button>
              );
            })}
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
          {!store.answerSubmitted ? (
            <button
              id="submit-answer-btn"
              className="btn-primary"
              onClick={handleSubmit}
              disabled={store.selectedOptionIndex === null}
              style={{ minWidth: "120px" }}
            >
              Check answer
            </button>
          ) : (
            <button
              id="next-question-btn"
              className="btn-primary"
              onClick={handleNext}
              style={{ minWidth: "120px" }}
            >
              {store.questionsAnswered >= store.questionsPlanned ? "Finish" : "Continue"}
            </button>
          )}
        </div>

        {/* Feedback after submission */}
        {store.answerSubmitted && (
          <div className="aether-card" style={{
            marginTop: "1rem",
            backgroundColor: store.isCorrect
              ? "var(--color-primary-container)"
              : "var(--color-error-container)",
          }}>
            <p style={{
              fontFamily: "var(--font-headline)",
              fontWeight: 600,
              fontSize: "0.875rem",
              color: store.isCorrect
                ? "var(--color-on-primary-container)"
                : "var(--color-error)",
              marginBottom: "0.5rem",
            }}>
              {store.isCorrect ? "Correct" : "Not quite"}
            </p>
            <p className="text-body-lg" style={{
              color: store.isCorrect
                ? "var(--color-on-primary-container)"
                : "var(--color-on-surface)",
            }}>
              {currentQuestion.explanation_excerpt}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────
   Session End View
   ──────────────────────────────────────── */

function SessionEndView({
  questionsAnswered,
  questionsPlanned,
  sessionId,
}: {
  questionsAnswered: number;
  questionsPlanned: number;
  sessionId: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const store = useSessionStore();
  const [extending, setExtending] = useState(false);

  useEffect(() => {
    async function finalizeSession() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Update session
      const { data: session } = await supabase
        .from("sessions")
        .select("started_at")
        .eq("id", sessionId)
        .single();

      const durationSeconds = session?.started_at
        ? Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1000)
        : 0;

      await supabase.from("sessions").update({
        status: "completed",
        ended_at: new Date().toISOString(),
      }).eq("id", sessionId);

      // Update user stats
      const { data: stats } = await supabase
        .from("user_stats")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (stats) {
        await supabase.from("user_stats").update({
          total_session_seconds: stats.total_session_seconds + durationSeconds,
          updated_at: new Date().toISOString(),
        }).eq("user_id", user.id);
      }
    }
    finalizeSession();
  }, [sessionId, supabase]);

  const handleKeepGoing = useCallback(async () => {
    setExtending(true);
    store.resetSession();
    // No need for router.push/refresh, useEffect will trigger on store.status change
  }, [store]);

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", minHeight: "calc(100dvh - 5rem)", padding: "2rem",
    }}>
      <div style={{ width: "100%", maxWidth: "480px", textAlign: "center" }}>
        <div style={{
          width: "80px", height: "80px", borderRadius: "50%",
          backgroundColor: "var(--color-primary-container)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 1.5rem",
          fontSize: "2rem",
        }}>
          ✓
        </div>

        <h1 className="text-headline-md" style={{ marginBottom: "0.5rem" }}>
          Session complete
        </h1>
        <p className="text-body-lg" style={{
          color: "var(--color-on-surface-variant)", marginBottom: "2rem",
        }}>
          You answered {questionsAnswered} of {questionsPlanned} questions
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <button
            className="btn-primary"
            onClick={handleKeepGoing}
            disabled={extending}
            style={{ width: "100%" }}
          >
            {extending ? "Loading…" : "Keep going (+5 questions)"}
          </button>
          <button
            className="btn-secondary"
            onClick={() => {
              store.resetSession();
              router.push("/library");
            }}
            style={{ width: "100%" }}
          >
            End session
          </button>
        </div>
      </div>
    </div>
  );
}
