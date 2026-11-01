"use server";

import { revalidatePath } from "next/cache";
import { mapLimit } from "@/lib/concurrency";
import { db } from "@/lib/db";
import { answerCase, loadEvalCaseIds } from "@/lib/engine";
import type { Rating } from "@/lib/generated/prisma/client";
import { LeakageError } from "@/lib/guards";
import { approvedExampleCount } from "@/lib/queries";

export async function createEvalSetAction(): Promise<{ ok: boolean; error?: string }> {
  const evalCases = await db.case.findMany({ where: { split: "EVAL" }, select: { id: true } });
  if (evalCases.length === 0) return { ok: false, error: "There are no held-out cases. Import cases with split=EVAL first." };
  const count = await db.evalSet.count();
  await db.evalSet.create({
    data: { name: `Held-out v${count + 1}`, cases: { create: evalCases.map((c) => ({ caseId: c.id })) } },
  });
  revalidatePath("/evaluation");
  return { ok: true };
}

export async function lockEvalSetAction(evalSetId: string) {
  await db.evalSet.update({ where: { id: evalSetId, lockedAt: null }, data: { lockedAt: new Date() } });
  revalidatePath("/", "layout");
}

export async function startRunAction(
  evalSetId: string,
  configId: string,
): Promise<{ ok: true; runId: string; errors: number } | { ok: false; error: string }> {
  const [set, config] = await Promise.all([
    db.evalSet.findUnique({ where: { id: evalSetId }, include: { cases: { include: { case: true } } } }),
    db.agentConfig.findUnique({ where: { id: configId } }),
  ]);
  if (!set || !config) return { ok: false, error: "Evaluation set or version not found." };
  if (!set.lockedAt) return { ok: false, error: "Lock the evaluation set before running it, so every version sees the same cases." };

  const evalCaseIds = await loadEvalCaseIds();
  const run = await db.evalRun.create({
    data: {
      evalSetId,
      agentConfigId: config.id,
      label: `${config.name} (live)`,
      source: "live",
      examplePoolSize: config.useExamples ? await approvedExampleCount() : 0,
    },
  });

  let errors = 0;
  await mapLimit(set.cases, 4, async ({ case: c }) => {
    try {
      const answer = await answerCase(config, c, { evalCaseIds });
      await db.evalResult.create({
        data: {
          runId: run.id,
          caseId: c.id,
          answer: answer.text,
          sourceRefs: answer.sourceRefs,
          exampleRefs: answer.exampleRefs,
          latencyMs: answer.latencyMs,
        },
      });
    } catch (e) {
      errors++;
      const message = e instanceof LeakageError ? `Blocked by leakage guard: ${e.message}` : e instanceof Error ? e.message : String(e);
      await db.evalResult.create({
        data: { runId: run.id, caseId: c.id, answer: "", sourceRefs: [], exampleRefs: [], error: message },
      });
    }
  });

  await db.evalRun.update({ where: { id: run.id }, data: { finishedAt: new Date() } });
  revalidatePath("/", "layout");
  return { ok: true, runId: run.id, errors };
}

export async function rateResultAction(input: { resultId: string; rating: Rating; note?: string; rater: string }) {
  await db.evalResult.update({
    where: { id: input.resultId },
    data: {
      rating: input.rating,
      note: input.note?.trim() || null,
      ratedBy: input.rater.trim() || process.env.DEFAULT_REVIEWER || "Support Expert",
      ratedAt: new Date(),
    },
  });
  revalidatePath("/", "layout");
}

export async function deleteRunAction(runId: string) {
  await db.evalRun.delete({ where: { id: runId } });
  revalidatePath("/", "layout");
}
