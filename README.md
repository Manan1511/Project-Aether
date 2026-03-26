# Aether 

Aether is an accessibility-first, AI-driven learning platform designed to help students master complex material by breaking down textbooks and PDFs into dyslexic-friendly, interactive audio-visual courses.

## Features

- **Retrieval-Augmented Generation (RAG):** Uploads and parses complex PDFs using PyMuPDF, recursively chunks the text, and computes local semantic embeddings to retrieve concepts.
- **Adaptive Microlearning:** Generates bite-sized, digestible "flashcard" lessons from heavy course material using Google Gemini 2.0 Flash.
- **Accessibility First:** 
  - One-click toggle for `OpenDyslexic` font.
  - Generous kerning/letter spacing options.
  - High-contrast Dark and Light mode themes.
- **Seamless Text-to-Speech:** Native browser-based Web Speech API integration for instant, lightweight audio reading.
- **Knowledge Tracking:** Tracks confidence scores (Strong, Developing, Needs Review) across all extracted concepts to focus your study time dynamically.

## Tech Stack

The platform is split into a modern frontend and a heavy AI-processing Python microservice.

- **Frontend:** Next.js 14 (App Router), React, responsive CSS variables.
- **Database & Auth:** Supabase (PostgreSQL, Row Level Security, Storage).
- **RAG Backend:** Python 3.11+, FastAPI.
- **Vector Search:** `FAISS` (in-memory) + `HuggingFaceEmbeddings` (`all-MiniLM-L6-v2` running entirely locally).
- **LLM Engine:** `langchain-google-genai` (Gemini 2.0 Flash) with automatic `tenacity` exponential backoff for aggressive rate-limit handling.

---

## Local Setup

Running Aether locally requires starting both the Python RAG backend and the Next.js frontend.

### 1. Clone the repository
```bash
git clone https://github.com/Manan1511/Project-Aether.git
cd Project-Aether
```

### 2. Environment Variables
You will need a Supabase project and a Google AI Studio account.

**Frontend (`.env.local` in the root)**
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

GEMINI_API_KEY=your_google_gemini_api_key
RAG_BACKEND_URL=http://localhost:8000
```

**Backend (`backend/.env` in the backend folder)**
```env
GEMINI_API_KEY=your_google_gemini_api_key
```

### 3. Start the Python RAG Backend
The backend utilizes PyTorch for the local HuggingFace embeddings. **Note:** The first time you run this, it will download a ~2GB PyTorch binary.

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```
> The backend will now be running at `http://localhost:8000`. Leave this terminal open.

### 4. Start the Next.js Frontend
Open a **new terminal** in the project root:

```bash
npm install
npm run dev
```
> The web app will now be available at `http://localhost:3000`.

---

## Supabase Schema Requirements

The platform expects the following tables to exist with appropriate Row Level Security (RLS) policies:
1. `users` (managed by Supabase Auth)
2. `documents` (id, user_id, title, status, total_concepts, file_path)
3. `concepts` (id, document_id, label, explanation)
4. `concept_performance` (user_id, concept_id, document_id, confidence_state)
5. `user_preferences` (user_id, theme, font, letter_spacing, etc.)
6. `user_stats` (user_id, sessions_completed, total_session_seconds)
7. `questions` (concept_id, question_text, options, correct_option_index, etc.)
8. Storage Bucket: `pdf-uploads`