"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import LibraryLoading from "./loading";

interface DocumentWithProgress {
  id: string;
  title: string;
  status: string;
  total_concepts: number;
  created_at: string;
  concepts_covered: number;
}

export default function LibraryPage() {
  const router = useRouter();
  const supabase = createClient();
  const [documents, setDocuments] = useState<DocumentWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string>("there");

  useEffect(() => {
    async function loadDocuments() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth/login"); return; }

      // Extract name from email (e.g., "jane.doe@example.com" -> "Jane Doe" or just "Jane")
      if (user.email) {
        const emailName = user.email.split("@")[0];
        // Capitalize first letter
        const formattedName = emailName.charAt(0).toUpperCase() + emailName.slice(1).replace(/[^a-zA-Z0-9]/g, ' ');
        setUserName(formattedName);
      }

      const { data: docs } = await supabase
        .from("documents")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!docs) { setLoading(false); return; }

      // Get concept performance counts
      const docsWithProgress: DocumentWithProgress[] = [];
      for (const doc of docs) {
        const { count } = await supabase
          .from("concept_performance")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("document_id", doc.id)
          .in("confidence_state", ["medium", "high"]);

        docsWithProgress.push({
          ...doc,
          concepts_covered: count ?? 0,
        });
      }

      setDocuments(docsWithProgress);
      setLoading(false);
    }

    loadDocuments();
  }, [router, supabase]);



  if (loading) return <LibraryLoading />;

  return (
    <div style={{
      maxWidth: "860px", margin: "0 auto", padding: "2rem",
      minHeight: "calc(100dvh - 5rem)",
      paddingBottom: "100px" // give extra breathing room for BottomNav
    }}>
      {/* Hero Section */}
      <div style={{ marginTop: "5.5rem", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <h2 style={{ fontFamily: "var(--font-headline)", fontSize: "2.75rem", fontWeight: 600, color: "var(--color-on-surface)", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
          Good morning, <span style={{ color: "var(--color-primary-bright)", textShadow: "0 2px 12px rgba(156, 163, 255, 0.2)" }}>{userName}</span>.
        </h2>
        <p style={{ color: "var(--color-secondary-text)", marginTop: "1rem", fontSize: "1.125rem", maxWidth: "400px", lineHeight: 1.5 }}>
          What would you like to focus on today?
        </p>
      </div>

      {/* Primary CTA */}
      <div style={{ marginTop: "3.5rem", display: "flex", justifyContent: "center" }}>
        <button
          onClick={() => router.push("/upload")}
          style={{
            backgroundColor: "var(--color-primary-bright)",
            background: "linear-gradient(135deg, #9CA3FF 0%, #818CF8 100%)",
            color: "#0F0F1A", // deep contrast text
            borderRadius: "100px",
            padding: "1.125rem 2.5rem",
            width: "100%",
            maxWidth: "380px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.75rem",
            fontFamily: "var(--font-label)",
            fontWeight: 700,
            fontSize: "1.0625rem",
            border: "none",
            cursor: "pointer",
            boxShadow: "0 8px 32px rgba(156, 163, 255, 0.25), inset 0 1px 0 rgba(255,255,255,0.4)",
            transition: "transform 250ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 250ms ease"
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.boxShadow = "0 12px 40px rgba(156, 163, 255, 0.35), inset 0 1px 0 rgba(255,255,255,0.5)";
            e.currentTarget.style.transform = "translateY(-2px)";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.boxShadow = "0 8px 32px rgba(156, 163, 255, 0.25), inset 0 1px 0 rgba(255,255,255,0.4)";
            e.currentTarget.style.transform = "translateY(0)";
          }}
          onMouseDown={(e) => e.currentTarget.style.transform = "scale(0.97)"}
          onMouseUp={(e) => e.currentTarget.style.transform = "translateY(-2px)"}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" />
          </svg>
          Start a New Session
        </button>
      </div>

      {/* Recent Archives */}
      <div style={{ marginTop: "4.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "1.5rem" }}>
          <h3 style={{ fontFamily: "var(--font-headline)", fontSize: "1.125rem", fontWeight: 600 }}>
            Recent Archives
          </h3>
          <span style={{ fontSize: "0.8125rem", color: "var(--color-primary-bright)", fontWeight: 600, cursor: "pointer" }}>
            See all
          </span>
        </div>

        {documents.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "var(--color-on-surface-variant)" }}>
            <p>No archives found.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {documents.slice(0, 5).map((doc, idx) => {
              // Cycle placeholder colors for UI accuracy
              const iconColors = ["#FB7185", "#C084FC", "#818CF8", "#34D399", "#FBBF24"]; // expanded palette
              const bgColors = [
                "rgba(251, 113, 133, 0.1)", "rgba(192, 132, 252, 0.1)", "rgba(129, 140, 248, 0.1)",
                "rgba(52, 211, 153, 0.1)", "rgba(251, 191, 36, 0.1)"
              ];
              const icons = [
                <path key="document" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />,
                <path key="audio" d="M9 18V5l12-2v13M9 9l12-2M6 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm15-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
                <path key="notes" d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              ];
              
              const color = iconColors[idx % 3];
              const bg = bgColors[idx % 3];
              const icon = icons[idx % 3];

              // Mock times corresponding to the screenshot layout
              const mockTimes = ["Edited 2 hours ago", "Created yesterday", "Last viewed 3 days ago"];

              return (
                <div
                  key={doc.id}
                  onClick={() => router.push(`/session/${doc.id}`)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    backgroundColor: "rgba(25, 25, 32, 0.6)", // Deeper, more glassmorphic
                    border: "1px solid rgba(255,255,255,0.03)",
                    borderRadius: "20px",
                    padding: "1.25rem 1.5rem",
                    cursor: "pointer",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
                    backdropFilter: "blur(12px)",
                    transition: "all 250ms ease"
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = "rgba(35, 35, 45, 0.8)";
                    e.currentTarget.style.border = "1px solid rgba(255,255,255,0.08)";
                    e.currentTarget.style.transform = "translateY(-2px)";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = "rgba(25, 25, 32, 0.6)";
                    e.currentTarget.style.border = "1px solid rgba(255,255,255,0.03)";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
                    {/* Icon wrapper */}
                    <div style={{
                      width: "48px", height: "48px", borderRadius: "14px",
                      backgroundColor: bg, color: color,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: `inset 0 0 0 1px ${color}33`,
                    }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        {icon}
                      </svg>
                    </div>

                    {/* Titles */}
                    <div>
                      <h4 style={{ fontFamily: "var(--font-headline)", fontSize: "0.9375rem", fontWeight: 600, color: "var(--color-on-surface)", marginBottom: "0.25rem" }}>
                        {doc.title}
                      </h4>
                      <p style={{ fontSize: "0.75rem", color: "var(--color-secondary-text)" }}>
                        {mockTimes[idx % 3]}
                      </p>
                    </div>
                  </div>

                  {/* Chevron Right */}
                  <div style={{ color: "var(--color-on-surface-variant)" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
