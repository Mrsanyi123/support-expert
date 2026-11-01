"use server";

import { revalidatePath } from "next/cache";
import type { ExampleDetail } from "@/components/answer";
import { db } from "@/lib/db";
import { answerCase, loadEvalCaseIds } from "@/lib/engine";
import { LeakageError } from "@/lib/guards";
import { editDistance } from "@/lib/metrics";
import { approvedExampleCount, loadExampleDetails } from "@/lib/queries";
import type { SourceRef } from "@/lib/types";

export type DraftDTO = {
  id: string;
  aiDraft: string;
  sourceRefs: SourceRef[];
  examples: ExampleDetail[];
  modelName: string;
  promptVersion: string;
  configName: string;
  latencyMs: number | null;
  offline: boolean;
};

export async function generateDraftAction(
  caseId: string,
  configId: string,
): Promise<{ ok: true; draft: DraftDTO } | { ok: false; error: string }> {
  const [c, config] = await Promise.all([
    db.case.findUnique({ where: { id: caseId } }),
    db.agentConfig.findUnique({ where: { id: configId } }),
  ]);
  if (!c || !config) return { ok: false, error: "Case or version not found." };
  if (c.split !== "TRAIN") {
    return { ok: false, error: "This is a held-out evaluation case. Drafts are only generated for it inside an evaluation run." };
  }

  try {
    const answer = await answerCase(config, c, { evalCaseIds: await loadEvalCaseIds() });
    const review = await db.$transaction(async (tx) => {
      await tx.review.deleteMany({ where: { caseId, status: "PENDING" } });
      const created = await tx.review.create({
        data: {
          caseId,
          agentConfigId: config.id,
          aiDraft: answer.text,
          sourceRefs: answer.sourceRefs,
          exampleRefs: answer.exampleRefs,
          modelName: answer.modelName,
          promptVersion: config.promptVersion,
          latencyMs: answer.latencyMs,
        },
      });
      if (c.status !== "APPROVED") await tx.case.update({ where: { id: caseId }, data: { status: "DRAFTED" } });
      return created;
    });

    revalidatePath("/review");
    revalidatePath("/cases");
    return {
      ok: true,
      draft: {
        id: review.id,
        aiDraft: review.aiDraft,
        sourceRefs: answer.sourceRefs,
        examples: await loadExampleDetails(answer.exampleRefs),
        modelName: answer.modelName,
        promptVersion: config.promptVersion,
        configName: config.name,
        latencyMs: answer.latencyMs,
        offline: answer.offline,
      },
    };
  } catch (e) {
    if (e instanceof LeakageError) return { ok: false, error: `Blocked by leakage guard: ${e.message}` };
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Model call failed: ${message}` };
  }
}

export type SubmitReviewInput = {
  reviewId: string;
  decision: "approve" | "reject";
  finalAnswer: string;
  rejectReason?: string;
  reviewer: string;
};

export async function submitReviewAction(
  input: SubmitReviewInput,
): Promise<{ ok: true; status: string; editDistance: number | null; exampleCount: number } | { ok: false; error: string }> {
  const review = await db.review.findUnique({ where: { id: input.reviewId }, include: { case: true } });
  if (!review) return { ok: false, error: "Draft not found. Generate a new one." };
  if (review.status !== "PENDING") return { ok: false, error: "This draft was already reviewed." };
  if (review.case.split !== "TRAIN") return { ok: false, error: "Evaluation cases cannot be reviewed into examples." };

  const reviewer = input.reviewer.trim() || process.env.DEFAULT_REVIEWER || "Support Expert";
  const now = new Date();

  if (input.decision === "reject") {
    const reason = input.rejectReason?.trim();
    if (!reason) return { ok: false, error: "Add a short reason so the rejection is useful later." };
    await db.$transaction([
      db.review.update({
        where: { id: review.id },
        data: { status: "REJECTED", rejectReason: reason, reviewer, reviewedAt: now, finalAnswer: null, editDistance: null },
      }),
      db.case.update({ where: { id: review.caseId }, data: { status: "REJECTED" } }),
    ]);
    revalidatePath("/", "layout");
    return { ok: true, status: "REJECTED", editDistance: null, exampleCount: await approvedExampleCount() };
  }

  const finalAnswer = input.finalAnswer.trim();
  if (finalAnswer.length < 10) return { ok: false, error: "The final answer is empty." };
  const distance = editDistance(review.aiDraft, finalAnswer);
  const status = distance === 0 ? "APPROVED" : "EDITED_APPROVED";

  await db.$transaction([
    db.review.update({
      where: { id: review.id },
      data: { status, finalAnswer, editDistance: distance, reviewer, reviewedAt: now },
    }),
    db.case.update({ where: { id: review.caseId }, data: { status: "APPROVED" } }),
  ]);

  revalidatePath("/", "layout");
  return { ok: true, status, editDistance: distance, exampleCount: await approvedExampleCount() };
}
