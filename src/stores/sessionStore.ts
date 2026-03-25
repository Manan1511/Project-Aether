import { create } from "zustand";
import type { PivotType } from "@/lib/adaptiveEngine";

/* ────────────────────────────────────────
   Types
   ──────────────────────────────────────── */

export interface Question {
  id: string;
  concept_id: string;
  question_type: "theoretical" | "applicative";
  question_text: string;
  options: string[];
  correct_option_index: number;
  explanation_excerpt: string;
  scaffold_steps: string[] | null;
}

export interface SessionState {
  // Session metadata
  sessionId: string | null;
  documentId: string | null;
  status: "idle" | "active" | "completed";

  // Question state
  questions: Question[];
  currentIndex: number;
  questionsPlanned: number;
  questionsAnswered: number;

  // Current question interaction
  selectedOptionIndex: number | null;
  answerChanges: number;
  answerSubmitted: boolean;
  isCorrect: boolean | null;

  // Pivot state
  pivotActive: PivotType;
  pivotAttempt: number; // attempts on current concept (1-based)
  currentScaffoldStep: number;

  // Audio
  audioSpeed: number;
  audioPlaying: boolean;

  // Actions
  startSession: (
    sessionId: string,
    documentId: string,
    questions: Question[],
    questionsPlanned: number
  ) => void;
  selectOption: (index: number) => void;
  submitAnswer: () => void;
  nextQuestion: () => void;
  triggerPivot: (type: PivotType) => void;
  advanceScaffold: () => void;
  setAudioSpeed: (speed: number) => void;
  setAudioPlaying: (playing: boolean) => void;
  completeSession: () => void;
  resetSession: () => void;
}

/* ────────────────────────────────────────
   Store
   ──────────────────────────────────────── */

export const useSessionStore = create<SessionState>((set, get) => ({
  sessionId: null,
  documentId: null,
  status: "idle",

  questions: [],
  currentIndex: 0,
  questionsPlanned: 0,
  questionsAnswered: 0,

  selectedOptionIndex: null,
  answerChanges: 0,
  answerSubmitted: false,
  isCorrect: null,

  pivotActive: null,
  pivotAttempt: 1,
  currentScaffoldStep: 0,

  audioSpeed: 1.0,
  audioPlaying: false,

  startSession: (sessionId, documentId, questions, questionsPlanned) =>
    set({
      sessionId,
      documentId,
      questions,
      questionsPlanned,
      status: "active",
      currentIndex: 0,
      questionsAnswered: 0,
      selectedOptionIndex: null,
      answerChanges: 0,
      answerSubmitted: false,
      isCorrect: null,
      pivotActive: null,
      pivotAttempt: 1,
      currentScaffoldStep: 0,
    }),

  selectOption: (index) => {
    const state = get();
    if (state.answerSubmitted) return;

    const changes =
      state.selectedOptionIndex !== null && state.selectedOptionIndex !== index
        ? state.answerChanges + 1
        : state.answerChanges;

    set({ selectedOptionIndex: index, answerChanges: changes });
  },

  submitAnswer: () => {
    const state = get();
    if (state.selectedOptionIndex === null || state.answerSubmitted) return;

    const question = state.questions[state.currentIndex];
    const correct = state.selectedOptionIndex === question.correct_option_index;

    set({
      answerSubmitted: true,
      isCorrect: correct,
      questionsAnswered: state.questionsAnswered + 1,
    });
  },

  nextQuestion: () => {
    const state = get();

    if (state.questionsAnswered >= state.questionsPlanned) {
      set({ status: "completed" });
      return;
    }

    const nextIndex = state.currentIndex + 1;
    if (nextIndex >= state.questions.length) {
      set({ status: "completed" });
      return;
    }

    set({
      currentIndex: nextIndex,
      selectedOptionIndex: null,
      answerChanges: 0,
      answerSubmitted: false,
      isCorrect: null,
      pivotActive: null,
      pivotAttempt: 1,
      currentScaffoldStep: 0,
    });
  },

  triggerPivot: (type) =>
    set((state) => ({
      pivotActive: type,
      pivotAttempt: state.pivotAttempt + 1,
      selectedOptionIndex: null,
      answerChanges: 0,
      answerSubmitted: false,
      isCorrect: null,
    })),

  advanceScaffold: () =>
    set((state) => ({
      currentScaffoldStep: state.currentScaffoldStep + 1,
    })),

  setAudioSpeed: (speed) => set({ audioSpeed: speed }),
  setAudioPlaying: (playing) => set({ audioPlaying: playing }),

  completeSession: () => set({ status: "completed" }),

  resetSession: () =>
    set({
      sessionId: null,
      documentId: null,
      status: "idle",
      questions: [],
      currentIndex: 0,
      questionsPlanned: 0,
      questionsAnswered: 0,
      selectedOptionIndex: null,
      answerChanges: 0,
      answerSubmitted: false,
      isCorrect: null,
      pivotActive: null,
      pivotAttempt: 1,
      currentScaffoldStep: 0,
    }),
}));
