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
      {/* Avatar & System Controls */}
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", justifyContent: "flex-end", marginBottom: "3rem" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-dim)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ cursor: "pointer" }}>
            <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>
          </svg>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-dim)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ cursor: "pointer" }}>
            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          <div style={{
            width: "32px", height: "32px", borderRadius: "50%",
            backgroundColor: "rgba(255,255,255,0.05)",
            display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
      </div>

      <p style={{
        fontFamily: "var(--font-label)", fontSize: "0.6875rem", letterSpacing: "2px",
        fontWeight: 700, color: "#9CA3FF", textTransform: "uppercase", marginBottom: "0.5rem"
      }}>
        Performance Overview
      </p>
      <h1 className="text-headline-md" style={{ fontSize: "2.25rem", letterSpacing: "-0.01em", marginBottom: "3rem" }}>
        Insights
      </h1>

      {/* Summary cards */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
        gap: "1.25rem", marginBottom: "4rem",
      }}>
        {/* Strong Card */}
        <div style={{ backgroundColor: "rgba(22, 23, 30, 0.7)", borderRadius: "16px", padding: "2rem", display: "flex", flexDirection: "column", alignItems: "center" }}>
           <span style={{ fontFamily: "var(--font-headline)", fontSize: "2.5rem", color: "#9CA3FF", fontWeight: 500, lineHeight: 1 }}>
             {counts.high}
           </span>
           <span style={{ fontFamily: "var(--font-label)", fontSize: "0.75rem", letterSpacing: "1.5px", fontWeight: 700, color: "var(--color-primary-dim)", marginTop: "1rem", textTransform: "uppercase" }}>
             Strong
           </span>
           <div style={{ width: "24px", height: "2px", backgroundColor: "#9CA3FF", marginTop: "0.75rem", borderRadius: "2px" }} />
        </div>

        {/* Developing Card */}
        <div style={{ backgroundColor: "rgba(22, 23, 30, 0.7)", borderRadius: "16px", padding: "2rem", display: "flex", flexDirection: "column", alignItems: "center" }}>
           <span style={{ fontFamily: "var(--font-headline)", fontSize: "2.5rem", color: "#C084FC", fontWeight: 500, lineHeight: 1 }}>
             {counts.medium}
           </span>
           <span style={{ fontFamily: "var(--font-label)", fontSize: "0.75rem", letterSpacing: "1.5px", fontWeight: 700, color: "var(--color-primary-dim)", marginTop: "1rem", textTransform: "uppercase" }}>
             Developing
           </span>
           <div style={{ width: "24px", height: "2px", backgroundColor: "#C084FC", marginTop: "0.75rem", borderRadius: "2px" }} />
        </div>

        {/* Needs Review Card */}
        <div style={{ backgroundColor: "rgba(22, 23, 30, 0.7)", borderRadius: "16px", padding: "2rem", display: "flex", flexDirection: "column", alignItems: "center" }}>
           <span style={{ fontFamily: "var(--font-headline)", fontSize: "2.5rem", color: "#FB7185", fontWeight: 500, lineHeight: 1 }}>
             {counts.low}
           </span>
           <span style={{ fontFamily: "var(--font-label)", fontSize: "0.75rem", letterSpacing: "1.5px", fontWeight: 700, color: "var(--color-primary-dim)", marginTop: "1rem", textTransform: "uppercase" }}>
             Needs Review
           </span>
           <div style={{ width: "24px", height: "2px", backgroundColor: "#FB7185", marginTop: "0.75rem", borderRadius: "2px" }} />
        </div>
      </div>

      {/* Filter */}
      <div style={{
        display: "flex", justifyContent: "center", marginBottom: "2.5rem"
      }}>
        <div style={{
          display: "inline-flex", gap: "0.25rem", backgroundColor: "rgba(22, 23, 30, 0.8)",
          padding: "0.375rem", borderRadius: "99px"
        }}>
          {(["all", "high", "medium", "low"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                fontSize: "0.8125rem", padding: "0.5rem 1.25rem", textTransform: "capitalize",
                fontWeight: 600, borderRadius: "99px",
                backgroundColor: filter === f ? "#9CA3FF" : "transparent",
                color: filter === f ? "#111122" : "var(--color-secondary-text)",
                border: "none", cursor: "pointer",
                transition: "all 200ms ease"
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Concept list / Empty State */}
      {filtered.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "4rem 2rem",
          display: "flex", flexDirection: "column", alignItems: "center", justifyItems: "center"
        }}>
          <div style={{ width: "64px", height: "64px", borderRadius: "50%", backgroundColor: "rgba(35, 35, 45, 0.4)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1.5rem" }}>
             <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="8" y1="12" x2="8" y2="16"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="16" y1="14" x2="16" y2="16"/>
             </svg>
          </div>
          <h4 style={{ fontFamily: "var(--font-headline)", fontSize: "1.125rem", color: "var(--color-on-surface)", fontWeight: 600, marginBottom: "0.75rem" }}>
            No Data Found
          </h4>
          <p className="text-body-md" style={{ color: "var(--color-secondary-text)", maxWidth: "340px", lineHeight: 1.6 }}>
            {insights.length === 0
              ? "Complete a session to see your insights and begin tracking your progress within the atelier."
              : "No concepts found in this particular tier."}
          </p>
        </div>
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
