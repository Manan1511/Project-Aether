"""
Aether RAG Backend — FastAPI Server
=====================================
Exposes a ``POST /ingest`` endpoint that accepts either:
  • A JSON body with ``{ "text": "...", "documentId": "..." }``
  • A multipart form with a PDF file upload

Returns structured ``{ "concepts": [...], "questions": {...} }`` JSON
that the Next.js API route consumes and writes to Supabase.
"""

from __future__ import annotations

import logging
import os

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from rag_pipeline import run_pipeline

# ---------------------------------------------------------------------------
# Initialisation
# ---------------------------------------------------------------------------

load_dotenv()  # loads backend/.env

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
if not GEMINI_API_KEY:
    logger.warning("GEMINI_API_KEY is not set — LLM calls will fail.")

app = FastAPI(
    title="Aether RAG Backend",
    version="1.0.0",
    description="PDF → RAG → Concepts & Questions",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------


class TextIngestRequest(BaseModel):
    """JSON body when the Next.js frontend sends pre-extracted text."""
    documentId: str
    text: str
    pageCount: int | None = None


class IngestResponse(BaseModel):
    """Structured response returned to Next.js."""
    success: bool
    concepts: list[dict]
    questions: dict  # keyed by concept position
    conceptCount: int
    questionCount: int


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.get("/health")
async def health_check():
    """Simple liveness probe."""
    return {"status": "ok"}


@app.post("/ingest", response_model=IngestResponse)
def ingest_text(body: TextIngestRequest):
    """
    Process pre-extracted text through the RAG pipeline.

    The Next.js ``/api/ingest`` route calls this endpoint with the same
    ``{ documentId, text, pageCount }`` payload previously sent to Gemini
    directly.
    """
    if not GEMINI_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY is not configured in backend/.env",
        )

    if not body.text or len(body.text.strip()) < 200:
        raise HTTPException(
            status_code=400,
            detail="Document text is too short to process.",
        )

    logger.info(
        "Ingesting document %s (%d chars)…",
        body.documentId,
        len(body.text),
    )

    try:
        result = run_pipeline(
            pdf_bytes=None,
            text=body.text,
            api_key=GEMINI_API_KEY,
            page_count=body.pageCount or 1,
        )
    except Exception as exc:
        logger.exception("Pipeline failed for document %s", body.documentId)
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    total_questions = sum(len(qs) for qs in result["questions"].values())

    logger.info(
        "Pipeline complete for %s — %d concepts, %d questions.",
        body.documentId,
        len(result["concepts"]),
        total_questions,
    )

    return IngestResponse(
        success=True,
        concepts=result["concepts"],
        questions=result["questions"],
        conceptCount=len(result["concepts"]),
        questionCount=total_questions,
    )


@app.post("/ingest/pdf", response_model=IngestResponse)
def ingest_pdf(
    file: UploadFile = File(...),
    documentId: str = Form(...),
):
    """
    Alternative endpoint that accepts a raw PDF upload directly.

    Useful for future integrations that bypass the Next.js frontend.
    """
    if not GEMINI_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY is not configured in backend/.env",
        )

    if not file.content_type or "pdf" not in file.content_type:
        raise HTTPException(status_code=400, detail="File must be a PDF.")

    pdf_bytes = file.file.read()  # Synchronous read
    logger.info(
        "Ingesting PDF %s (%d bytes)…",
        documentId,
        len(pdf_bytes),
    )

    try:
        import fitz
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        page_count = doc.page_count
        doc.close()

        result = run_pipeline(
            pdf_bytes=pdf_bytes,
            text=None,
            api_key=GEMINI_API_KEY,
            page_count=page_count,
        )
    except Exception as exc:
        logger.exception("Pipeline failed for PDF %s", documentId)
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    total_questions = sum(len(qs) for qs in result["questions"].values())

    return IngestResponse(
        success=True,
        concepts=result["concepts"],
        questions=result["questions"],
        conceptCount=len(result["concepts"]),
        questionCount=total_questions,
    )
