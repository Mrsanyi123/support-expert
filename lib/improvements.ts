import { db } from "@/lib/db";
import type { Rating } from "@/lib/generated/prisma/client";
import { compareRatings, countRatings, editRatio, type CaseDelta } from "@/lib/metrics";

export async function loadRunsForComparison() {
  return db.evalRun.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      agentConfig: true,
      evalSet: { select: { id: true, name: true } },
      results: { include: { case: { select: { id: true, ticketId: true, customerQuestion: true, expertResolution: true, productArea: true } } } },
    },
  });
}

type Runs = Awaited<ReturnType<typeof loadRunsForComparison>>;
type Run = Runs[number];

export function pickDefaultPair(runs: Runs, baseId?: string, candId?: string) {
  const base = runs.find((r) => r.id === baseId) ?? runs.find((r) => !r.agentConfig.useExamples) ?? runs[runs.length - 1];
  const cand =
    runs.find((r) => r.id === candId) ??
    runs.find((r) => r.id !== base?.id && r.evalSetId === base?.evalSetId && r.agentConfig.id !== base?.agentConfig.id) ??
    runs.find((r) => r.id !== base?.id);
  return { base, cand };
}

export type ComparisonRow = {
  caseId: string;
  ticketId: string;
  question: string;
  expected: string;
  productArea: string;
  base: { rating: Rating | null; answer: string; note: string | null } | null;
  cand: { rating: Rating | null; answer: string; note: string | null } | null;
  delta: CaseDelta;
};

const DELTA_ORDER: Record<CaseDelta, number> = { regressed: 0, improved: 1, unrated: 2, unchanged: 3 };

export function compareRuns(base: Run, cand: Run) {
  const byCase = new Map<string, ComparisonRow>();
  const ensure = (r: Run["results"][number]) => {
    const row = byCase.get(r.caseId) ?? {
      caseId: r.caseId,
      ticketId: r.case.ticketId,
      question: r.case.customerQuestion,
      expected: r.case.expertResolution,
      productArea: r.case.productArea,
      base: null,
      cand: null,
      delta: "unrated" as CaseDelta,
    };
    byCase.set(r.caseId, row);
    return row;
  };
  for (const r of base.results) ensure(r).base = { rating: r.rating, answer: r.answer || r.error || "", note: r.note };
  for (const r of cand.results) ensure(r).cand = { rating: r.rating, answer: r.answer || r.error || "", note: r.note };

  const rows = [...byCase.values()].map((row) => ({ ...row, delta: compareRatings(row.base?.rating, row.cand?.rating) }));
  rows.sort((a, b) => DELTA_ORDER[a.delta] - DELTA_ORDER[b.delta] || a.ticketId.localeCompare(b.ticketId));

  return {
    rows,
    baseCounts: countRatings(base.results),
    candCounts: countRatings(cand.results),
    improved: rows.filter((r) => r.delta === "improved").length,
    regressed: rows.filter((r) => r.delta === "regressed").length,
    unchanged: rows.filter((r) => r.delta === "unchanged").length,
    sameSet: base.evalSetId === cand.evalSetId,
  };
}

export async function loadReviewStats() {
  const decided = await db.review.findMany({
    where: { status: { not: "PENDING" }, case: { split: "TRAIN" } },
    orderBy: { reviewedAt: "asc" },
    select: { status: true, aiDraft: true, finalAnswer: true, reviewedAt: true, createdAt: true },
  });

  const approved = decided.filter((r) => r.status === "APPROVED" || r.status === "EDITED_APPROVED");
  const asIs = decided.filter((r) => r.status === "APPROVED").length;
  const rejected = decided.filter((r) => r.status === "REJECTED").length;
  const ratios = approved.map((r) => editRatio(r.aiDraft, r.finalAnswer ?? ""));

  const weeks = new Map<string, { label: string; total: number; asIs: number; rejected: number; ratios: number[] }>();
  for (const r of decided) {
    const d = r.reviewedAt ?? r.createdAt;
    const monday = new Date(d);
    monday.setUTCHours(0, 0, 0, 0);
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
    const key = monday.toISOString().slice(0, 10);
    const w = weeks.get(key) ?? { label: monday.toLocaleDateString("en-US", { month: "short", day: "numeric" }), total: 0, asIs: 0, rejected: 0, ratios: [] };
    w.total++;
    if (r.status === "APPROVED") w.asIs++;
    if (r.status === "REJECTED") w.rejected++;
    if (r.finalAnswer) w.ratios.push(editRatio(r.aiDraft, r.finalAnswer));
    weeks.set(key, w);
  }

  return {
    decided: decided.length,
    approved: approved.length,
    asIs,
    rejected,
    asIsRate: decided.length ? asIs / decided.length : 0,
    avgEditRatio: ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : 0,
    weeks: [...weeks.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, w]) => ({
        key,
        label: w.label,
        total: w.total,
        asIsRate: w.total ? w.asIs / w.total : 0,
        avgEditRatio: w.ratios.length ? w.ratios.reduce((a, b) => a + b, 0) / w.ratios.length : 0,
      })),
  };
}
