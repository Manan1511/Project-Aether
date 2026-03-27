"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import InsightsLoading from "./loading";

function CircularProgress({ value, max, color, label }: { value: number, max: number, color: string, label: string }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const percentage = max === 0 ? 0 : value / max;
  const [offset, setOffset] = useState(circumference);

  useEffect(() => {
    // animate in
    const timer = setTimeout(() => {
      setOffset(circumference - percentage * circumference);
    }, 100);
    return () => clearTimeout(timer);
  }, [percentage, circumference]);

  return (
    <div className="glass-card" style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "1.5rem" }}>
      <div style={{ position: "relative", width: "96px", height: "96px", marginBottom: "1rem" }}>
        <svg fill="none" viewBox="0 0 96 96" style={{ transform: "rotate(-90deg)", width: "100%", height: "100%" }}>
          <circle cx="48" cy="48" r={radius} stroke="var(--color-outline-variant)" strokeWidth="8" />
          <circle
            cx="48" cy="48" r={radius} stroke={color} strokeWidth="8"
            strokeDasharray={circumference} strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 1.5s cubic-bezier(0.16, 1, 0.3, 1)" }}
          />
        </svg>
        <div style={{
          position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "var(--font-headline)", fontSize: "1.75rem", fontWeight: 700, color: "var(--color-on-surface)"
        }}>
          {value}
        </div>
      </div>
      <div className="text-label-md" style={{ color: "var(--color-on-surface-variant)" }}>
        {label}
      </div>
    </div>
  );
}

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
      {/* Summary cards */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
        gap: "1.25rem", marginBottom: "2.5rem",
      }}>
        <CircularProgress value={counts.high} max={insights.length} color="var(--color-success)" label="Strong" />
        <CircularProgress value={counts.medium} max={insights.length} color="var(--color-primary-bright)" label="Developing" />
        <CircularProgress value={counts.low} max={insights.length} color="var(--color-error)" label="Needs review" />
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
              className="glass-card"
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
