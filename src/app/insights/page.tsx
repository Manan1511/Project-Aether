"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import InsightsLoading from "./loading";

interface ConceptInsight {
  label: string;
  confidence_state: string;
  document_title: string;
}

export default function InsightsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [insights, setInsights] = useState<ConceptInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "low" | "medium" | "high">("all");

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth/login"); return; }

      const { data: perfData } = await supabase
        .from("concept_performance")
        .select(`
          confidence_state,
          concept_id,
          concepts:concept_id (label, document_id, documents:document_id (title))
        `)
        .eq("user_id", user.id)
        .neq("confidence_state", "unseen");

      const mapped: ConceptInsight[] = (perfData ?? []).map((p: Record<string, unknown>) => {
        const concepts = p.concepts as Record<string, unknown> | null;
        const documents = concepts?.documents as Record<string, unknown> | null;
        return {
          label: (concepts?.label as string) ?? "Unknown",
          confidence_state: p.confidence_state as string,
          document_title: (documents?.title as string) ?? "Unknown",
        };
      });

      setInsights(mapped);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = filter === "all"
    ? insights
    : insights.filter((i) => i.confidence_state === filter);

  const counts = {
    high: insights.filter((i) => i.confidence_state === "high").length,
    medium: insights.filter((i) => i.confidence_state === "medium").length,
    low: insights.filter((i) => i.confidence_state === "low").length,
  };

  if (loading) return <InsightsLoading />;

  return (
    <div style={{
      maxWidth: "720px", margin: "0 auto", padding: "2rem",
      minHeight: "calc(100dvh - 5rem)",
    }}>
      <h1 className="text-headline-md" style={{ marginBottom: "2rem" }}>
        Insights
      </h1>

      {/* Summary cards */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
        gap: "0.75rem", marginBottom: "2rem",
      }}>
        <div className="aether-card" style={{ textAlign: "center", padding: "1.25rem" }}>
          <div style={{
            fontFamily: "var(--font-headline)", fontSize: "2rem", fontWeight: 700,
            color: "var(--color-primary-bright)",
          }}>
            {counts.high}
          </div>
          <div className="text-label-md" style={{ color: "var(--color-on-surface-variant)", marginTop: "0.25rem" }}>
            Strong
          </div>
        </div>
        <div className="aether-card" style={{ textAlign: "center", padding: "1.25rem" }}>
          <div style={{
            fontFamily: "var(--font-headline)", fontSize: "2rem", fontWeight: 700,
            color: "var(--color-secondary)",
          }}>
            {counts.medium}
          </div>
          <div className="text-label-md" style={{ color: "var(--color-on-surface-variant)", marginTop: "0.25rem" }}>
            Developing
          </div>
        </div>
        <div className="aether-card" style={{ textAlign: "center", padding: "1.25rem" }}>
          <div style={{
            fontFamily: "var(--font-headline)", fontSize: "2rem", fontWeight: 700,
            color: "var(--color-error)",
          }}>
            {counts.low}
          </div>
          <div className="text-label-md" style={{ color: "var(--color-on-surface-variant)", marginTop: "0.25rem" }}>
            Needs review
          </div>
        </div>
      </div>

      {/* Filter */}
      <div style={{
        display: "flex", gap: "0.5rem", marginBottom: "1.5rem",
      }}>
        {(["all", "high", "medium", "low"] as const).map((f) => (
          <button
            key={f}
            className={filter === f ? "btn-primary" : "btn-secondary"}
            onClick={() => setFilter(f)}
            style={{ fontSize: "0.75rem", padding: "0.4rem 0.75rem", textTransform: "capitalize" }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Concept list */}
      {filtered.length === 0 ? (
        <p className="text-body-lg" style={{
          textAlign: "center", padding: "3rem",
          color: "var(--color-on-surface-variant)",
        }}>
          {insights.length === 0
            ? "Complete a session to see your insights"
            : "No concepts in this category"}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {filtered.map((insight, i) => (
            <div
              key={i}
              className="aether-card"
              style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "center", padding: "1rem 1.25rem",
              }}
            >
              <div>
                <p style={{
                  fontFamily: "var(--font-body)", fontSize: "1rem",
                  fontWeight: 500, color: "var(--color-on-surface)",
                }}>
                  {insight.label}
                </p>
                <p className="text-label-md" style={{
                  color: "var(--color-secondary-text)", marginTop: "0.125rem",
                }}>
                  {insight.document_title}
                </p>
              </div>
              <span style={{
                display: "inline-block", padding: "0.25rem 0.625rem",
                borderRadius: "var(--radius-full)", fontSize: "0.6875rem",
                fontWeight: 600, fontFamily: "var(--font-label)",
                textTransform: "uppercase",
                backgroundColor:
                  insight.confidence_state === "high"
                    ? "var(--color-primary-container)"
                    : insight.confidence_state === "medium"
                    ? "var(--color-secondary-container)"
                    : "var(--color-error-container)",
                color:
                  insight.confidence_state === "high"
                    ? "var(--color-primary-bright)"
                    : insight.confidence_state === "medium"
                    ? "var(--color-on-surface)"
                    : "var(--color-error)",
              }}>
                {insight.confidence_state}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
