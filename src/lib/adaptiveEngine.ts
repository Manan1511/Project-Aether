/**
 * Adaptive Engine — confidence state calculator and question planner.
 *
 * Confidence state transitions:
 * - answer_changes=0, is_correct=true → first_attempt_correct_count++
 *   → if 2+ first-attempt corrects → "high"
 * - answer_changes>0, is_correct=true → corrected_to_correct_count++ → "medium"
 * - is_correct=false → incorrect_count++ → "low"
 *
 * State only changes after 2+ events for a concept.
 */

export interface ConceptPerformance {
  concept_id: string;
  confidence_state: "unseen" | "high" | "medium" | "low";
  first_attempt_correct_count: number;
  corrected_to_correct_count: number;
  incorrect_count: number;
}

export type PivotType = "simplified_text" | "scaffold" | "source_excerpt" | null;

export interface AnswerResult {
  isCorrect: boolean;
  answerChanges: number;
}

/**
 * Calculate the new confidence state after an answer event.
 * Returns the updated performance and any pivot triggered.
 */
export function calculateConfidenceUpdate(
  current: ConceptPerformance,
  result: AnswerResult
): { updated: ConceptPerformance; pivotTriggered: PivotType } {
  const updated = { ...current };
  let pivotTriggered: PivotType = null;

  const totalEvents =
    current.first_attempt_correct_count +
    current.corrected_to_correct_count +
    current.incorrect_count;

  if (result.isCorrect && result.answerChanges === 0) {
    updated.first_attempt_correct_count++;
    if (totalEvents >= 1 && updated.first_attempt_correct_count >= 2) {
      updated.confidence_state = "high";
    }
  } else if (result.isCorrect && result.answerChanges > 0) {
    updated.corrected_to_correct_count++;
    if (totalEvents >= 1) {
      updated.confidence_state = "medium";
    }
  } else {
    updated.incorrect_count++;
    if (totalEvents >= 1) {
      updated.confidence_state = "low";
    }
  }

  // Determine if a pivot should be triggered
  if (updated.confidence_state === "low" && updated.incorrect_count >= 2) {
    pivotTriggered = "simplified_text";
  }

  return { updated, pivotTriggered };
}

/**
 * Determine which pivot to show based on question type and attempt count.
 */
export function getPivotForAttempt(
  questionType: "theoretical" | "applicative",
  attemptNumber: number
): PivotType {
  if (attemptNumber === 2) {
    return questionType === "theoretical" ? "simplified_text" : "scaffold";
  }
  if (attemptNumber >= 3) {
    return "source_excerpt";
  }
  return null;
}

/**
 * Check if a concept's prerequisites are met.
 */
export function prerequisitesMet(
  conceptPrereqIds: string[],
  performanceMap: Map<string, ConceptPerformance>
): boolean {
  if (!conceptPrereqIds || conceptPrereqIds.length === 0) return true;

  return conceptPrereqIds.every((prereqId) => {
    const perf = performanceMap.get(prereqId);
    if (!perf) return false;
    return perf.confidence_state === "medium" || perf.confidence_state === "high";
  });
}

/**
 * Filter and order concepts for a session.
 * Respects prerequisites and skips "high" confidence concepts.
 */
export function planSessionConcepts(
  concepts: Array<{
    id: string;
    position: number;
    prerequisite_concept_ids: string[];
  }>,
  performanceMap: Map<string, ConceptPerformance>,
  includeHigh: boolean = false
): string[] {
  const sorted = [...concepts].sort((a, b) => a.position - b.position);

  return sorted
    .filter((c) => {
      const perf = performanceMap.get(c.id);
      // Skip high-confidence unless full review
      if (!includeHigh && perf?.confidence_state === "high") return false;
      // Check prerequisites
      return prerequisitesMet(c.prerequisite_concept_ids, performanceMap);
    })
    .map((c) => c.id);
}
