import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { buildContext } from "@/lib/engine";
import type { Rating, ReviewStatus } from "@/lib/generated/prisma/client";
import { parseTicketsCsv } from "@/lib/import/csv";
import { editDistance } from "@/lib/metrics";
import { DEFAULT_PROMPT_VERSION } from "@/lib/prompt";
import { indexDocument } from "@/lib/retrieval";

const SEED_DIR = path.join(process.cwd(), "seed");
const DAY = 24 * 60 * 60 * 1000;
const SEED_REVIEWER = "Maya Chen (Support Lead)";
const SEED_RATER = "Maya Chen (blind rating)";

type DemoReview = {
  ticketId: string;
  status: ReviewStatus;
  daysAgo: number;
  draft: string | null;
  final?: string | null;
  rejectReason?: string;
};

type DemoEval = {
  runs: Record<"A" | "B", { label: string; daysAgo: number }>;
  results: Record<string, Record<"A" | "B", { rating: Rating; answer: string; note?: string }>>;
};

export function defaultModelSettings() {
  return {
    baseUrl: process.env.LLM_BASE_URL || "https://api.together.xyz/v1",
    model: process.env.LLM_MODEL || "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
  };
}

export async function ensureDefaultConfigs() {
  const { baseUrl, model } = defaultModelSettings();
  const a = await db.agentConfig.upsert({
    where: { key: "A" },
    update: {},
    create: {
      key: "A",
      name: "A: Base model + docs",
      description: "Open-weight base model answering from retrieved help docs only.",
      baseUrl,
      model,
      promptVersion: DEFAULT_PROMPT_VERSION,
      useExamples: false,
    },
  });
  const b = await db.agentConfig.upsert({
    where: { key: "B" },
    update: {},
    create: {
      key: "B",
      name: "B: + expert examples",
      description: "Same model and prompt, plus up to 3 approved expert corrections retrieved as few-shot examples.",
      baseUrl,
      model,
      promptVersion: DEFAULT_PROMPT_VERSION,
      useExamples: true,
      maxExamples: 3,
      isDefault: true,
    },
  });
  return { a, b };
}

export async function wipeAll() {
  await db.$transaction([
    db.evalResult.deleteMany(),
    db.evalRun.deleteMany(),
    db.evalSetCase.deleteMany(),
    db.evalSet.deleteMany(),
    db.review.deleteMany(),
    db.chunk.deleteMany(),
    db.document.deleteMany(),
    db.case.deleteMany(),
    db.agentConfig.deleteMany(),
  ]);
}

export async function loadDemoDataset() {
  const now = Date.now();
  await wipeAll();

  const docFiles = (await readdir(path.join(SEED_DIR, "docs"))).filter((f) => /\.(md|txt)$/i.test(f)).sort();
  for (const filename of docFiles) {
    const content = await readFile(path.join(SEED_DIR, "docs", filename), "utf8");
    await indexDocument({ filename, content });
  }

  const csv = await readFile(path.join(SEED_DIR, "tickets.csv"), "utf8");
  const parsed = parseTicketsCsv(csv);
  if (parsed.errors.length || parsed.missingColumns.length) {
    throw new Error(`Seed CSV invalid: ${JSON.stringify(parsed.errors.slice(0, 3))} ${parsed.missingColumns.join(",")}`);
  }
  await db.case.createMany({
    data: parsed.rows.map((r, i) => ({
      ticketId: r.ticketId,
      customerQuestion: r.customerQuestion,
      expertResolution: r.expertResolution,
      productArea: r.productArea,
      split: r.split,
      createdAt: new Date(now - 40 * DAY + i * 60_000),
    })),
  });

  const { a, b } = await ensureDefaultConfigs();
  const cases = await db.case.findMany();
  const byTicket = new Map(cases.map((c) => [c.ticketId, c]));
  const evalCaseIds = new Set(cases.filter((c) => c.split === "EVAL").map((c) => c.id));

  const { reviews } = JSON.parse(await readFile(path.join(SEED_DIR, "demo-reviews.json"), "utf8")) as {
    reviews: DemoReview[];
  };
  for (const r of reviews) {
    const c = byTicket.get(r.ticketId);
    if (!c) throw new Error(`Seed review references unknown ticket ${r.ticketId}`);
    if (c.split !== "TRAIN") throw new Error(`Seed review ${r.ticketId} must be a TRAIN case`);
    const context = await buildContext(a, c, { evalCaseIds });
    const draft = r.draft ?? c.expertResolution;
    const rejected = r.status === "REJECTED";
    const final = rejected ? null : (r.final ?? c.expertResolution);
    const createdAt = new Date(now - r.daysAgo * DAY);
    await db.review.create({
      data: {
        caseId: c.id,
        agentConfigId: a.id,
        aiDraft: draft,
        finalAnswer: final,
        status: r.status,
        rejectReason: r.rejectReason ?? null,
        sourceRefs: context.sourceRefs,
        exampleRefs: [],
        editDistance: final ? editDistance(draft, final) : null,
        reviewer: SEED_REVIEWER,
        modelName: a.model,
        promptVersion: a.promptVersion,
        latencyMs: 1800 + ((r.ticketId.charCodeAt(5) * 37) % 1400),
        createdAt,
        reviewedAt: new Date(createdAt.getTime() + 7 * 60_000),
      },
    });
    await db.case.update({ where: { id: c.id }, data: { status: rejected ? "REJECTED" : "APPROVED" } });
  }

  const evalCases = cases.filter((c) => c.split === "EVAL").sort((x, y) => x.ticketId.localeCompare(y.ticketId));
  const evalSet = await db.evalSet.create({
    data: {
      name: "Held-out v1",
      lockedAt: new Date(now - 10 * DAY),
      createdAt: new Date(now - 10 * DAY),
      cases: { create: evalCases.map((c) => ({ caseId: c.id })) },
    },
  });

  const demoEval = JSON.parse(await readFile(path.join(SEED_DIR, "demo-eval.json"), "utf8")) as DemoEval;
  const approvedCount = reviews.filter((r) => r.status !== "REJECTED").length;

  for (const [key, config] of [["A", a], ["B", b]] as const) {
    const meta = demoEval.runs[key];
    const startedAt = new Date(now - meta.daysAgo * DAY);
    const run = await db.evalRun.create({
      data: {
        evalSetId: evalSet.id,
        agentConfigId: config.id,
        label: meta.label,
        source: "seed",
        examplePoolSize: config.useExamples ? approvedCount : 0,
        createdAt: startedAt,
        finishedAt: new Date(startedAt.getTime() + 3 * 60_000),
      },
    });
    for (const c of evalCases) {
      const seeded = demoEval.results[c.ticketId]?.[key];
      if (!seeded) throw new Error(`Missing seeded ${key} answer for ${c.ticketId}`);
      const context = await buildContext(config, c, { evalCaseIds });
      await db.evalResult.create({
        data: {
          runId: run.id,
          caseId: c.id,
          answer: seeded.answer,
          sourceRefs: context.sourceRefs,
          exampleRefs: context.exampleRefs,
          latencyMs: 1500 + ((c.ticketId.charCodeAt(5) * 53) % 1600),
          rating: seeded.rating,
          note: seeded.note ?? null,
          ratedBy: SEED_RATER,
          ratedAt: new Date(startedAt.getTime() + DAY / 2),
        },
      });
    }
  }

  return {
    documents: docFiles.length,
    cases: cases.length,
    reviews: reviews.length,
    evalCases: evalCases.length,
  };
}
