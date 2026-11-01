import { db } from "@/lib/db";
import type { AgentConfig } from "@/lib/generated/prisma/client";
import { assertExamplesAllowed, assertNoResolutionLeak, promptFieldsFromCase } from "@/lib/guards";
import { runnerFor } from "@/lib/llm/runner";
import { buildMessages } from "@/lib/prompt";
import { postgresRetriever, type Retriever } from "@/lib/retrieval";
import type { ChatMessage, ExampleRef, RetrievedChunk, RetrievedExample, SourceRef } from "@/lib/types";

export type CaseForAnswer = {
  id: string;
  customerQuestion: string;
  expertResolution: string;
  productArea: string;
};

export type ContextResult = {
  messages: ChatMessage[];
  sources: RetrievedChunk[];
  examples: RetrievedExample[];
  sourceRefs: SourceRef[];
  exampleRefs: ExampleRef[];
};

/**
 * Retrieves docs (and approved TRAIN examples when the config uses them) and builds the
 * prompt. The expected resolution is used only to verify it did not leak in.
 */
export async function buildContext(
  config: Pick<AgentConfig, "promptVersion" | "topK" | "useExamples" | "maxExamples">,
  c: CaseForAnswer,
  opts: { evalCaseIds: Set<string>; retriever?: Retriever },
): Promise<ContextResult> {
  const retriever = opts.retriever ?? postgresRetriever;
  const fields = promptFieldsFromCase(c);

  const [sources, examples] = await Promise.all([
    retriever.searchDocs(`${fields.question} ${fields.productArea}`, config.topK),
    config.useExamples
      ? retriever.searchExamples(fields.question, {
          k: config.maxExamples,
          productArea: fields.productArea,
          excludeCaseId: c.id,
        })
      : Promise.resolve([]),
  ]);

  assertExamplesAllowed(examples, { answeringCaseId: c.id, evalCaseIds: opts.evalCaseIds });

  const messages = buildMessages(config.promptVersion, { ...fields, sources, examples });
  assertNoResolutionLeak(messages, c.expertResolution);

  return {
    messages,
    sources,
    examples,
    sourceRefs: sources.map((s, i) => ({
      ref: `D${i + 1}`,
      chunkId: s.chunkId,
      documentId: s.documentId,
      title: s.title,
      heading: s.heading,
      snippet: s.text.length > 420 ? `${s.text.slice(0, 420).trimEnd()}...` : s.text,
    })),
    exampleRefs: examples.map((e, i) => ({ ref: `E${i + 1}`, reviewId: e.reviewId, caseId: e.caseId, ticketId: e.ticketId })),
  };
}

export async function answerCase(config: AgentConfig, c: CaseForAnswer, opts: { evalCaseIds: Set<string> }) {
  const context = await buildContext(config, c, opts);
  const runner = runnerFor(config);
  const result = await runner.generate(context.messages, { temperature: config.temperature, maxTokens: 600 });
  return { ...context, text: result.text, latencyMs: result.latencyMs, modelName: runner.model, offline: runner.offline };
}

/** Ids of every case in any evaluation set plus every EVAL-split case. */
export async function loadEvalCaseIds(): Promise<Set<string>> {
  const rows = await db.case.findMany({ where: { split: "EVAL" }, select: { id: true } });
  const inSets = await db.evalSetCase.findMany({ select: { caseId: true } });
  return new Set([...rows.map((r) => r.id), ...inSets.map((r) => r.caseId)]);
}
