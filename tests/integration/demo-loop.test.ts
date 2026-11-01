import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { db } = await import("@/lib/db");
const { loadDemoDataset } = await import("@/lib/seed/demo");
const { buildTrainingRecords } = await import("@/lib/export/jsonl");
const { generateDraftAction, submitReviewAction } = await import("@/app/actions/review");
const { rateResultAction, startRunAction } = await import("@/app/actions/evaluation");

const CLOUDFLARE_FIX =
  "That HTML page is Cloudflare's bot challenge: Bot Fight Mode challenges Relay deliveries because they are automated. On the Free plan turn Bot Fight Mode off for the zone or use a hostname without it. On Pro and higher, add a WAF custom rule that skips Super Bot Fight Mode for 34.120.15.0/28 and 35.201.88.0/28. IP Access allowlisting alone does not bypass it.";

// Runs against the real database and reloads the demo dataset before and after.
describe.skipIf(!process.env.RUN_DB_TESTS)("demo loop against the database", () => {
  beforeAll(async () => {
    await loadDemoDataset();
  }, 120_000);

  afterAll(async () => {
    await loadDemoDataset();
    await db.$disconnect();
  }, 120_000);

  it("turns one expert correction into a held-out improvement", { timeout: 120_000 }, async () => {
    const configB = await db.agentConfig.findUniqueOrThrow({ where: { key: "B" } });
    const trainCase = await db.case.findUniqueOrThrow({ where: { ticketId: "T-1018" } });
    const evalCase = await db.case.findUniqueOrThrow({ where: { ticketId: "T-1067" } });
    const set = await db.evalSet.findFirstOrThrow({ where: { lockedAt: { not: null } } });

    const blocked = await generateDraftAction(evalCase.id, configB.id);
    expect(blocked.ok).toBe(false);

    const drafted = await generateDraftAction(trainCase.id, configB.id);
    if (!drafted.ok) throw new Error(drafted.error);
    expect(drafted.draft.sourceRefs.length).toBeGreaterThan(0);
    expect(drafted.draft.aiDraft).not.toContain("Bot Fight Mode");

    const submitted = await submitReviewAction({ reviewId: drafted.draft.id, decision: "approve", finalAnswer: CLOUDFLARE_FIX, reviewer: "Test Expert" });
    if (!submitted.ok) throw new Error(submitted.error);
    expect(submitted.status).toBe("EDITED_APPROVED");
    expect(submitted.editDistance).toBeGreaterThan(0);

    const records = await buildTrainingRecords();
    const exported = records.map((r) => r.metadata.ticket_id);
    expect(exported).toContain("T-1018");
    const evalTickets = (await db.case.findMany({ where: { split: "EVAL" }, select: { ticketId: true } })).map((c) => c.ticketId);
    expect(exported.filter((t) => evalTickets.includes(t))).toEqual([]);
    for (const r of records) for (const m of r.messages) expect(m.content).not.toContain(evalCase.expertResolution);

    const run = await startRunAction(set.id, configB.id);
    if (!run.ok) throw new Error(run.error);
    expect(run.errors).toBe(0);

    const result = await db.evalResult.findUniqueOrThrow({ where: { runId_caseId: { runId: run.runId, caseId: evalCase.id } } });
    const exampleTickets = (result.exampleRefs as { ticketId: string }[]).map((e) => e.ticketId);
    expect(exampleTickets).toContain("T-1018");
    expect(exampleTickets.filter((t) => evalTickets.includes(t))).toEqual([]);
    expect(result.answer).toContain("Bot Fight Mode");

    await rateResultAction({ resultId: result.id, rating: "CORRECT", rater: "Test Expert" });
    const rated = await db.evalResult.findUniqueOrThrow({ where: { id: result.id } });
    expect(rated.rating).toBe("CORRECT");
    expect(rated.ratedBy).toBe("Test Expert");
  });
});
