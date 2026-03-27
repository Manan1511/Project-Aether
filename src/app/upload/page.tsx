"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const MAX_FILE_SIZE_MB = 20;
const MIN_TEXT_LENGTH = 200;

export default function UploadPage() {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<
    "idle" | "extracting" | "uploading" | "processing" | "error" | "unsupported"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFile = useCallback(
    async (selectedFile: File) => {
      // Validate file type
      if (selectedFile.type !== "application/pdf") {
        setStatus("error");
        setErrorMessage("Please select a PDF file.");
        return;
      }

      // Validate file size
      if (selectedFile.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        setStatus("error");
        setErrorMessage(`File must be under ${MAX_FILE_SIZE_MB}MB.`);
        return;
      }

      setFile(selectedFile);
      setStatus("extracting");
      setErrorMessage(null);

      try {
        // Import pdfjs-dist dynamically
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

        const arrayBuffer = await selectedFile.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        let fullText = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item) => ("str" in item ? item.str : ""))
            .join(" ");
          fullText += pageText + "\n\n";
        }

        // Check minimum text length
        if (fullText.trim().length < MIN_TEXT_LENGTH) {
          setStatus("unsupported");
          setErrorMessage(
            "This PDF appears to be scanned or image-based. Aether can only process text-based PDFs. Please try a different document."
          );
          return;
        }

        // Generate file hash
        const hashBuffer = await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(fullText)
        );
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const fileHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

        setStatus("uploading");

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/auth/login");
          return;
        }

        // Upload to Supabase Storage
        const storagePath = `${user.id}/${fileHash}.pdf`;
        const { error: uploadError } = await supabase.storage
          .from("pdf-uploads")
          .upload(storagePath, selectedFile, {
            upsert: true,
            contentType: "application/pdf",
          });

        if (uploadError) {
          // Might already exist (duplicate)
          if (!uploadError.message.includes("already exists")) {
            throw uploadError;
          }
        }

        // Insert document row
        const title =
          selectedFile.name.replace(/\.pdf$/i, "").replace(/[_-]/g, " ") ||
          "Untitled Document";

        const { data: doc, error: dbError } = await supabase
          .from("documents")
          .upsert(
            {
              user_id: user.id,
              title,
              storage_path: storagePath,
              file_hash: fileHash,
              page_count: pdf.numPages,
              status: "processing",
            },
            { onConflict: "user_id,file_hash" }
          )
          .select("id")
          .single();

        if (dbError) throw dbError;

        setStatus("processing");

        // Call the ingest API
        const response = await fetch("/api/ingest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documentId: doc.id,
            text: fullText,
            pageCount: pdf.numPages,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Ingestion failed");
        }

        // Success — navigate to library
        router.push("/library");
        router.refresh();
      } catch (err) {
        console.error("Upload error:", err);
        setStatus("error");
        setErrorMessage(
          err instanceof Error ? err.message : "Something went wrong. Please try again."
        );
      }
    },
    [supabase, router]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) handleFile(droppedFile);
    },
    [handleFile]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) handleFile(selectedFile);
    },
    [handleFile]
  );

  const isProcessing = ["extracting", "uploading", "processing"].includes(status);

  return (
    <div style={{
      maxWidth: "960px",
      margin: "0 auto",
      padding: "2rem",
      paddingBottom: "100px", // breathing room for BottomNav
      minHeight: "calc(100dvh - 5rem)",
    }}>
      {/* Header */}
      <h1 style={{
        fontFamily: "var(--font-headline)", fontSize: "1.35rem",
        color: "var(--color-primary-bright)", fontWeight: 700, letterSpacing: "0.5px"
      }}>
        Aether
      </h1>

      {/* Hero Text */}
      <div style={{ textAlign: "center", marginTop: "4rem", marginBottom: "3rem" }}>
        <h2 style={{
          fontFamily: "var(--font-headline)", fontSize: "2.75rem",
          fontWeight: 500, color: "var(--color-on-surface)", letterSpacing: "-0.02em"
        }}>
          Upload a document
        </h2>
        <p style={{ color: "var(--color-secondary-text)", marginTop: "0.75rem", fontSize: "1.125rem" }}>
          Drop a PDF and Aether will build your course.
        </p>
      </div>

      {/* Main Dropzone Box */}
      <button
        id="upload-drop-zone"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        disabled={isProcessing}
        style={{
          position: "relative",
          width: "100%",
          minHeight: "360px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1.5rem",
          padding: "3rem",
          overflow: "hidden",
          borderRadius: "24px",
          backgroundColor: isDragging
            ? "rgba(129, 140, 248, 0.12)"
            : "rgba(22, 23, 30, 0.8)", // Deep navy surface variant
          boxShadow: isDragging 
            ? "0 0 50px -10px rgba(129, 140, 248, 0.3), inset 0 0 0 2px rgba(129, 140, 248, 0.5)" 
            : "0 12px 40px -10px rgba(0, 0, 0, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.05)",
          border: "none", // Using inset shadows instead of harsh borders
          cursor: isProcessing ? "wait" : "pointer",
          transition: "all 250ms ease"
        }}
        onMouseOver={(e) => {
          if (!isDragging && !isProcessing) {
            e.currentTarget.style.backgroundColor = "rgba(30, 31, 40, 0.9)";
            e.currentTarget.style.transform = "translateY(-2px)";
          }
        }}
        onMouseOut={(e) => {
          if (!isDragging && !isProcessing) {
            e.currentTarget.style.backgroundColor = "rgba(22, 23, 30, 0.8)";
            e.currentTarget.style.transform = "translateY(0)";
          }
        }}
      >
        {isProcessing && (
          <div style={{
            position: "absolute", top: 0, left: 0, width: "100%", height: "4px",
            backgroundColor: "rgba(255, 255, 255, 0.05)", zIndex: 10
          }}>
            <div className="progress-slide" style={{
              height: "100%", backgroundColor: "var(--color-primary-bright)",
              boxShadow: "0 0 10px var(--color-primary-bright)"
            }} />
          </div>
        )}

        {isProcessing ? (
          <>
            <div style={{
              width: "64px", height: "64px", borderRadius: "16px",
              backgroundColor: "rgba(129, 140, 248, 0.15)", color: "var(--color-primary-bright)",
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>
               <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="aether-pulse">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="17 8 12 3 7 8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <p style={{ fontFamily: "var(--font-headline)", fontSize: "1.25rem", color: "var(--color-on-surface)", fontWeight: 600 }}>
                Processing document...
              </p>
              {file && (
                <p style={{ color: "var(--color-primary-bright)", marginTop: "0.25rem", fontSize: "0.9375rem" }}>
                  {file?.name}
                </p>
              )}
            </div>
          </>
        ) : status === "error" || status === "unsupported" ? (
          <>
            <div style={{
              width: "64px", height: "64px", borderRadius: "16px",
              backgroundColor: "rgba(225, 29, 72, 0.15)", color: "#FB7185",
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <div style={{ maxWidth: "400px", textAlign: "center" }}>
              <p style={{ fontFamily: "var(--font-headline)", fontSize: "1.125rem", color: "#FB7185", fontWeight: 600, marginBottom: "0.5rem" }}>
                Upload Failed
              </p>
              <p style={{ color: "var(--color-secondary-text)", lineHeight: 1.5, fontSize: "0.875rem" }}>
                {errorMessage}
              </p>
            </div>
            <button
              className="btn-secondary"
              onClick={(e) => {
                e.stopPropagation();
                setStatus("idle");
                setFile(null);
                setErrorMessage(null);
              }}
              style={{ marginTop: "0.5rem", borderRadius: "99px", padding: "0.5rem 1.5rem" }}
            >
              Try another file
            </button>
          </>
        ) : (
          <>
            {/* Custom File Icon Wrapper */}
            <div style={{
              width: "72px", height: "72px", borderRadius: "50%",
              backgroundColor: "rgba(156, 163, 255, 0.08)", color: "#9CA3FF",
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm-1 13v4h-2v-4H8l4-4 4 4h-3zm-3-6V3.5L18.5 9H10z" />
              </svg>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontFamily: "var(--font-headline)", fontSize: "1.25rem", fontWeight: 600, color: "var(--color-on-surface)" }}>
                Drag & drop a PDF here
              </p>
              <p style={{ color: "var(--color-primary-dim)", marginTop: "0.5rem", fontSize: "0.75rem", letterSpacing: "1px", fontWeight: 700, textTransform: "uppercase" }}>
                Or click to browse · Max {MAX_FILE_SIZE_MB}MB
              </p>
            </div>
          </>
        )}

        {/* Triple Dot Decoration */}
        <div style={{ position: "absolute", bottom: "1.5rem", right: "2rem", display: "flex", gap: "0.25rem", opacity: 0.3 }}>
          <div style={{ width: "4px", height: "4px", borderRadius: "50%", backgroundColor: "var(--color-primary-bright)" }} />
          <div style={{ width: "4px", height: "4px", borderRadius: "50%", backgroundColor: "var(--color-primary-bright)" }} />
          <div style={{ width: "4px", height: "4px", borderRadius: "50%", backgroundColor: "var(--color-primary-bright)" }} />
        </div>
      </button>

      {/* Info Columns via CSS Grid */}
      <div style={{
        marginTop: "1.5rem",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
        gap: "1.5rem",
      }}>
        <div style={{ backgroundColor: "rgba(22, 23, 30, 0.5)", borderRadius: "16px", padding: "1.5rem" }}>
          <h4 style={{ color: "#C084FC", fontSize: "0.75rem", letterSpacing: "1px", fontWeight: 700, textTransform: "uppercase", marginBottom: "0.75rem" }}>Tip</h4>
          <p style={{ color: "var(--color-secondary-text)", fontSize: "0.875rem", lineHeight: 1.6 }}>
            Better course structures are built from documents with clear headings.
          </p>
        </div>
        <div style={{ backgroundColor: "rgba(22, 23, 30, 0.5)", borderRadius: "16px", padding: "1.5rem" }}>
          <h4 style={{ color: "#9CA3FF", fontSize: "0.75rem", letterSpacing: "1px", fontWeight: 700, textTransform: "uppercase", marginBottom: "0.75rem" }}>Recent</h4>
          <p style={{ color: "var(--color-secondary-text)", fontSize: "0.875rem", lineHeight: 1.6 }}>
            Continue with <br/> <span style={{ color: "var(--color-on-surface)", fontWeight: 500 }}>&apos;Neuroscience_Intro.pdf&apos;</span> <br/>
            uploaded 2h ago.
          </p>
        </div>
        <div style={{ backgroundColor: "rgba(22, 23, 30, 0.5)", borderRadius: "16px", padding: "1.5rem" }}>
          <h4 style={{ color: "#FB7185", fontSize: "0.75rem", letterSpacing: "1px", fontWeight: 700, textTransform: "uppercase", marginBottom: "0.75rem" }}>Aether AI</h4>
          <p style={{ color: "var(--color-secondary-text)", fontSize: "0.875rem", lineHeight: 1.6 }}>
            Processing takes ~30 seconds for a standard 50-page document.
          </p>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        onChange={handleInputChange}
        style={{ display: "none" }}
        id="upload-file-input"
      />
    </div>
  );
}
