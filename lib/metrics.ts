import { distance } from "fastest-levenshtein";

/** Character-level Levenshtein distance between the AI draft and the expert's final answer. */
export function editDistance(draft: string, final: string) {
  return distance(draft.trim(), final.trim());
}

/** 0 = untouched, 1 = fully rewritten. */
export function editRatio(draft: string, final: string) {
  const longest = Math.max(draft.trim().length, final.trim().length, 1);
  return Math.min(1, editDistance(draft, final) / longest);
}

export type RatingCounts = { CORRECT: number; INCOMPLETE: number; WRONG: number; unrated: number; total: number };

export function countRatings(results: { rating: "CORRECT" | "INCOMPLETE" | "WRONG" | null }[]): RatingCounts {
  const counts: RatingCounts = { CORRECT: 0, INCOMPLETE: 0, WRONG: 0, unrated: 0, total: results.length };
  for (const r of results) {
    if (r.rating) counts[r.rating]++;
    else counts.unrated++;
  }
  return counts;
}

const RATING_SCORE = { WRONG: 0, INCOMPLETE: 1, CORRECT: 2 } as const;

export type CaseDelta = "improved" | "regressed" | "unchanged" | "unrated";

export function compareRatings(
  a: "CORRECT" | "INCOMPLETE" | "WRONG" | null | undefined,
  b: "CORRECT" | "INCOMPLETE" | "WRONG" | null | undefined,
): CaseDelta {
  if (!a || !b) return "unrated";
  const diff = RATING_SCORE[b] - RATING_SCORE[a];
  return diff > 0 ? "improved" : diff < 0 ? "regressed" : "unchanged";
}
