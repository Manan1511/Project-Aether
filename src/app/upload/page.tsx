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
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "calc(100dvh - 5rem)",
        padding: "2rem",
      }}
    >
      <div style={{ width: "100%", maxWidth: "560px" }}>
        <h1
          className="text-headline-md"
          style={{
            textAlign: "center",
            marginBottom: "0.5rem",
            color: "var(--color-on-surface)",
          }}
        >
          Upload a document
        </h1>
        <p
          className="text-body-lg"
          style={{
            textAlign: "center",
            color: "var(--color-on-surface-variant)",
            marginBottom: "2rem",
          }}
        >
          Drop a PDF and Aether will build your course
        </p>

        <button
          id="upload-drop-zone"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          disabled={isProcessing}
          className="glass-panel"
          style={{
            position: "relative",
            width: "100%",
            minHeight: "260px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1.25rem",
            padding: "2rem",
            overflow: "hidden",
            backgroundColor: isDragging
              ? "rgba(129, 140, 248, 0.08)"
              : "rgba(255, 255, 255, 0.02)",
            boxShadow: isDragging 
              ? "0 0 40px -10px rgba(129, 140, 248, 0.5), inset 0 0 20px rgba(129, 140, 248, 0.1)" 
              : "0 8px 32px -4px rgba(0, 0, 0, 0.1)",
            border: `1px solid ${
              isDragging
                ? "rgba(129, 140, 248, 0.6)"
                : status === "error" || status === "unsupported"
                ? "var(--color-error)"
                : "rgba(255, 255, 255, 0.08)"
            }`,
            cursor: isProcessing ? "wait" : "pointer",
          }}
        >
          {isProcessing && (
            <div style={{
              position: "absolute", top: 0, left: 0, width: "100%", height: "2px",
              backgroundColor: "rgba(255, 255, 255, 0.05)", zIndex: 10
            }}>
              <div className="progress-slide" style={{
                height: "100%", backgroundColor: "var(--color-primary)",
              }} />
            </div>
          )}

          {isProcessing ? (
            <>
              <p
                className="text-body-lg"
                style={{ color: "var(--color-on-surface)" }}
              >
                Processing document…
              </p>
              {file && (
                <p
                  className="text-label-md"
                  style={{ color: "var(--color-secondary-text)" }}
                >
                  {file.name}
                </p>
              )}
            </>
          ) : status === "error" || status === "unsupported" ? (
            <>
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--color-error)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              <p
                className="text-body-lg"
                style={{
                  color: "var(--color-error)",
                  maxWidth: "360px",
                  wordBreak: "break-word",
                  overflowWrap: "anywhere",
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.4,
                  fontSize: "0.875rem",
                }}
              >
                {errorMessage}
              </p>
              <button
                className="btn-secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  setStatus("idle");
                  setFile(null);
                  setErrorMessage(null);
                }}
                style={{ marginTop: "0.5rem" }}
              >
                Try another file
              </button>
            </>
          ) : (
            <>
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--color-primary)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <p
                className="text-body-lg"
                style={{ color: "var(--color-on-surface-variant)" }}
              >
                Drag & drop a PDF here
              </p>
              <p
                className="text-label-md"
                style={{ color: "var(--color-secondary-text)" }}
              >
                or click to browse · Max {MAX_FILE_SIZE_MB}MB
              </p>
            </>
          )}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleInputChange}
          style={{ display: "none" }}
          id="upload-file-input"
        />
      </div>
    </div>
  );
}
