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
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    async function loadDocuments() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth/login"); return; }

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
  }, []);

  const handleDelete = async (e: React.MouseEvent, docId: string) => {
    e.stopPropagation();
    e.preventDefault();
    
    // First click to confirm
    if (confirmDeleteId !== docId) {
      setConfirmDeleteId(docId);
      // reset confirm after 3 seconds
      setTimeout(() => {
        setConfirmDeleteId((prev) => (prev === docId ? null : prev));
      }, 3000);
      return;
    }

    // Set optimistic UI immediately on second click
    setDocuments((prev) => prev.filter((d) => d.id !== docId));
    setConfirmDeleteId(null);

    try {
      // Explicit sequential deletion to emulate CASCADE if missing
      await supabase.from("concept_performance").delete().eq("document_id", docId);
      await supabase.from("concepts").delete().eq("document_id", docId);
      await supabase.from("documents").delete().eq("id", docId);
    } catch (err) {
      console.error("Failed to delete session:", err);
      alert("There was an error deleting the session. Please refresh and try again.");
    }
  };

  if (loading) return <LibraryLoading />;

  return (
    <div style={{
      maxWidth: "720px", margin: "0 auto", padding: "2rem",
      minHeight: "calc(100dvh - 5rem)",
    }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: "2rem",
      }}>
        <h1 className="text-headline-md">Your library</h1>
        <button
          className="btn-primary"
          onClick={() => router.push("/upload")}
          style={{ fontSize: "0.8125rem" }}
        >
          + Upload
        </button>
      </div>

      {documents.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "4rem 2rem",
          color: "var(--color-on-surface-variant)",
        }}>
          <svg
            width="64" height="64" viewBox="0 0 24 24" fill="none"
            stroke="var(--color-outline-variant)" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round"
            style={{ margin: "0 auto 1rem" }}
          >
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
          <p className="text-body-lg">No documents yet</p>
          <p style={{ fontSize: "0.875rem", marginTop: "0.5rem" }}>
            Upload a PDF to get started
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {documents.map((doc) => (
            <div
              key={doc.id}
              id={`doc-${doc.id}`}
              role="button"
              tabIndex={0}
              onClick={() => {
                if (doc.status === "ready") router.push(`/session/${doc.id}`);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && doc.status === "ready") {
                  router.push(`/session/${doc.id}`);
                }
              }}
              className="aether-card"
              style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "center", textAlign: "left",
                cursor: doc.status === "ready" ? "pointer" : "default",
                border: "none", width: "100%", padding: "1rem 1.25rem",
                opacity: doc.status === "ready" ? 1 : 0.6,
              }}
            >
              <div style={{ flex: 1 }}>
                <h3 style={{
                  fontFamily: "var(--font-body)", fontSize: "1.0625rem",
                  fontWeight: 500, marginBottom: "0.25rem",
                  color: "var(--color-on-surface)",
                }}>
                  {doc.title}
                </h3>
                <div style={{
                  display: "flex", gap: "1rem", alignItems: "center",
                }}>
                  <span className="text-label-md" style={{ color: "var(--color-secondary-text)" }}>
                    {new Date(doc.created_at).toLocaleDateString("en-US", {
                      month: "short", day: "numeric",
                    })}
                  </span>
                  {doc.status === "ready" && doc.total_concepts > 0 && (
                    <span className="text-label-md" style={{ color: "var(--color-primary-bright)" }}>
                      {doc.concepts_covered} of {doc.total_concepts} concepts
                    </span>
                  )}
                  {doc.status === "processing" && (
                    <span className="text-label-md" style={{ color: "var(--color-secondary-text)" }}>
                      Processing…
                    </span>
                  )}
                  {doc.status === "failed" && (
                    <span className="text-label-md" style={{ color: "var(--color-error)" }}>
                      Failed
                    </span>
                  )}
                  {doc.status === "unsupported" && (
                    <span className="text-label-md" style={{ color: "var(--color-error)" }}>
                      Unsupported
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
                <button
                  onClick={(e) => handleDelete(e, doc.id)}
                  style={{
                    background: confirmDeleteId === doc.id ? "var(--color-error-container)" : "none",
                    border: "none",
                    cursor: "pointer",
                    padding: confirmDeleteId === doc.id ? "0.375rem 0.75rem" : "0.25rem",
                    borderRadius: "var(--radius-input)",
                    color: confirmDeleteId === doc.id ? "var(--color-error)" : "var(--color-error)",
                    opacity: confirmDeleteId === doc.id ? 1 : 0.8,
                    transition: "all 120ms ease",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.25rem"
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.opacity = "1")}
                  onMouseOut={(e) => (e.currentTarget.style.opacity = confirmDeleteId === doc.id ? "1" : "0.8")}
                  title="Delete session"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                  </svg>
                  {confirmDeleteId === doc.id && (
                    <span style={{ fontSize: "0.75rem", fontWeight: 600 }}>Confirm</span>
                  )}
                </button>
                {doc.status === "ready" && (
                  <span style={{
                    fontFamily: "var(--font-label)", fontSize: "0.8125rem",
                    fontWeight: 600, color: "var(--color-primary)",
                  }}>
                    {doc.concepts_covered > 0 ? "Continue →" : "Start →"}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
