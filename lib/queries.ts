import { db } from "@/lib/db";
import type { ExampleRef, SourceRef } from "@/lib/types";

export function asSourceRefs(value: unknown): SourceRef[] {
  return Array.isArray(value) ? (value as SourceRef[]) : [];
}

export function asExampleRefs(value: unknown): ExampleRef[] {
  return Array.isArray(value) ? (value as ExampleRef[]) : [];
}

/** Resolves stored example refs into the question and approved answer they pointed to. */
export async function loadExampleDetails(refs: ExampleRef[]) {
  if (refs.length === 0) return [];
  const reviews = await db.review.findMany({
    where: { id: { in: refs.map((r) => r.reviewId) } },
    select: { id: true, finalAnswer: true, case: { select: { customerQuestion: true } } },
  });
  const byId = new Map(reviews.map((r) => [r.id, r]));
  return refs.map((ref) => ({
    ...ref,
    question: byId.get(ref.reviewId)?.case.customerQuestion ?? "(case deleted)",
    answer: byId.get(ref.reviewId)?.finalAnswer ?? "",
  }));
}

export async function approvedExampleCount() {
  return db.review.count({
    where: { status: { in: ["APPROVED", "EDITED_APPROVED"] }, finalAnswer: { not: null }, case: { split: "TRAIN" } },
  });
}
