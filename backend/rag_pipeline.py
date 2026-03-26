"""
Aether RAG Pipeline
====================
Core logic for PDF extraction, chunking, embedding, retrieval, and
LLM-based concept/question generation.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

import fitz  # PyMuPDF
from langchain.schema import Document
from langchain_community.vectorstores import FAISS
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
import google.generativeai as genai
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from google.api_core.exceptions import ResourceExhausted

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200
EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"
LLM_MODEL_NAME = "models/gemini-flash-latest"
RETRIEVAL_TOP_K = 4

# Singleton for the embedding model (heavy — only load once)
_embeddings: HuggingFaceEmbeddings | None = None

def _get_embeddings() -> HuggingFaceEmbeddings:
    """Lazy-load the HuggingFace embedding model."""
    global _embeddings
    if _embeddings is None:
        logger.info("Loading HuggingFace embedding model '%s'...", EMBEDDING_MODEL_NAME)
        _embeddings = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL_NAME)
    return _embeddings

# ---------------------------------------------------------------------------
# 1. PDF Text Extraction
# ---------------------------------------------------------------------------

def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extract all text from a PDF binary using PyMuPDF."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    pages: list[str] = []
    for page in doc:
        pages.append(page.get_text("text"))
    doc.close()
    return "\n\n".join(pages)

# ---------------------------------------------------------------------------
# 2. Text Chunking
# ---------------------------------------------------------------------------

def chunk_text(text: str) -> list[Document]:
    """Split extracted text into overlapping chunks for embedding."""
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        length_function=len,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    return splitter.create_documents([text])

# ---------------------------------------------------------------------------
# 3. FAISS Vector Store
# ---------------------------------------------------------------------------

def build_vector_store(chunks: list[Document]) -> FAISS:
    """Embed chunks locally and load into an in-memory FAISS index."""
    embeddings = _get_embeddings()
    vector_store = FAISS.from_documents(chunks, embeddings)
    logger.info("FAISS index built with %d chunks.", len(chunks))
    return vector_store

# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------

CONCEPT_PROMPT = """You are analysing only the provided text. Do not use any external knowledge.

Analyse the following document text and extract the key concepts a student should learn.
For each concept, provide:
- label: A short, clear name
- source_chunk: The relevant excerpt from the text
- position: An integer starting from 0, indicating learning order
- prerequisite_positions: An array of position integers that must be learned first (empty array if none)

Document text:
{text}

Return ONLY a valid JSON array. No markdown fences, no explanation."""

BATCH_QUESTION_PROMPT = """You are analysing only the provided text. Do not use any external knowledge.

For each of the concepts provided in the JSON list below, generate exactly 2 multiple-choice questions (1 theoretical, 1 applicative).

Concepts to process:
{concepts_json}

For each question provide:
- question_type: "theoretical" or "applicative"
- question_text: The question
- options: Array of exactly 4 answer options
- correct_option_index: Index (0-3) of the correct option
- explanation_excerpt: A short excerpt from the text explaining why the answer is correct
- scaffold_steps: For applicative questions, an array of 3-4 step-by-step hints. For theoretical, null.

Source text:
{context}

Return ONLY a valid JSON object where keys are the concept 'position' strings and values are the arrays of 2 questions.
Return ONLY valid JSON."""

# ---------------------------------------------------------------------------
# 4. LLM Generation - RAG Methods
# ---------------------------------------------------------------------------

@retry(stop=stop_after_attempt(5), wait=wait_exponential(multiplier=2, min=4, max=30), retry=retry_if_exception_type(ResourceExhausted))
def generate_concepts(vector_store: FAISS, full_text: str, api_key: str) -> list[dict[str, Any]]:
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(LLM_MODEL_NAME)
    initial_context = full_text[:12000]
    prompt = CONCEPT_PROMPT.format(text=initial_context)
    response = model.generate_content(prompt)
    return _parse_json_array(response.text)

@retry(stop=stop_after_attempt(5), wait=wait_exponential(multiplier=2, min=4, max=30), retry=retry_if_exception_type(ResourceExhausted))
def generate_all_questions(vector_store: FAISS, concepts: list[dict[str, Any]], api_key: str) -> dict[int, list[dict[str, Any]]]:
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(LLM_MODEL_NAME)
    combined_context_chunks = []
    seen = set()
    for concept in concepts:
        query = f"{concept['label']}: {concept.get('source_chunk', '')[:300]}"
        docs = vector_store.similarity_search(query, k=3)
        for doc in docs:
            if doc.page_content not in seen:
                combined_context_chunks.append(doc.page_content)
                seen.add(doc.page_content)
    context = "\n\n---\n\n".join(combined_context_chunks)
    concepts_json = json.dumps([{ "label": c["label"], "position": c["position"] } for c in concepts])
    prompt = BATCH_QUESTION_PROMPT.format(concepts_json=concepts_json, context=context)
    response = model.generate_content(prompt)
    parsed = _parse_json_dict(response.text)
    return {int(k): v for k, v in parsed.items()}

# ---------------------------------------------------------------------------
# 5. LLM Generation - Direct Grounding (Adaptive Optimization)
# ---------------------------------------------------------------------------

@retry(stop=stop_after_attempt(5), wait=wait_exponential(multiplier=2, min=4, max=30), retry=retry_if_exception_type(ResourceExhausted))
def generate_concepts_direct(full_text: str, api_key: str) -> list[dict[str, Any]]:
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(LLM_MODEL_NAME)
    prompt = CONCEPT_PROMPT.format(text=full_text)
    response = model.generate_content(prompt)
    return _parse_json_array(response.text)

@retry(stop=stop_after_attempt(5), wait=wait_exponential(multiplier=2, min=4, max=30), retry=retry_if_exception_type(ResourceExhausted))
def generate_all_questions_direct(concepts: list[dict[str, Any]], full_text: str, api_key: str) -> dict[int, list[dict[str, Any]]]:
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(LLM_MODEL_NAME)
    concepts_json = json.dumps([{ "label": c["label"], "position": c["position"] } for c in concepts])
    prompt = BATCH_QUESTION_PROMPT.format(concepts_json=concepts_json, context=full_text)
    response = model.generate_content(prompt)
    parsed = _parse_json_dict(response.text)
    return {int(k): v for k, v in parsed.items()}

# ---------------------------------------------------------------------------
# 6. Pipeline Orchestrator
# ---------------------------------------------------------------------------

def run_pipeline(pdf_bytes: bytes | None, text: str | None, api_key: str, page_count: int = 1) -> dict[str, Any]:
    if pdf_bytes:
        full_text = extract_text_from_pdf(pdf_bytes)
    elif text:
        full_text = text
    else:
        raise ValueError("No input provided.")

    if len(full_text.strip()) < 200:
        raise ValueError("Text too short.")

    # Adaptive Logic: Use Direct Grounding if document is small.
    # This bypasses the slow embedding step and stays well within Gemini's 1M context window.
    if page_count <= 5:
        logger.info("Applying Direct Grounding optimization (Small document detected)...")
        concepts = generate_concepts_direct(full_text, api_key)
        
        if not concepts:
            return {"concepts": [], "questions": {}}

        # Significant pause to prevent hitting any 3 RPM or 15 RPM Rate Limit
        import time
        time.sleep(25)
        
        all_questions = generate_all_questions_direct(concepts, full_text, api_key)
        return {"concepts": concepts, "questions": all_questions}

    # Standard RAG Pipeline for large documents
    logger.info("Applying Standard RAG Pipeline (Large document detected)...")
    chunks = chunk_text(full_text)
    vector_store = build_vector_store(chunks)
    concepts = generate_concepts(vector_store, full_text, api_key)
    if not concepts: return {"concepts": [], "questions": {}}
    all_questions = generate_all_questions(vector_store, concepts, api_key)
    return {"concepts": concepts, "questions": all_questions}

# ---------------------------------------------------------------------------
# JSON Helpers
# ---------------------------------------------------------------------------

def _parse_json_array(raw: str) -> list[dict[str, Any]]:
    cleaned = re.sub(r"^```(?:json)?\s*\n?", "", raw.strip(), flags=re.IGNORECASE)
    cleaned = re.sub(r"\n?```\s*$", "", cleaned, flags=re.IGNORECASE)
    parsed = json.loads(cleaned)
    return [parsed] if isinstance(parsed, dict) else parsed

def _parse_json_dict(raw: str) -> dict[str, Any]:
    cleaned = re.sub(r"^```(?:json)?\s*\n?", "", raw.strip(), flags=re.IGNORECASE)
    cleaned = re.sub(r"\n?```\s*$", "", cleaned, flags=re.IGNORECASE)
    parsed = json.loads(cleaned)
    if not isinstance(parsed, dict): raise ValueError("Expected dict")
    return parsed
