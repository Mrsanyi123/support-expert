import { db } from "@/lib/db";
import { isExportable } from "@/lib/guards";
import { buildMessages, DEFAULT_PROMPT_VERSION, PROMPTS } from "@/lib/prompt";
import { asSourceRefs } from "@/lib/queries";
import { postgresRetriever } from "@/lib/retrieval";
import type { ChatMessage, RetrievedChunk } from "@/lib/types";

export type TrainingRecord = {
  messages: ChatMessage[];
  metadata: {
    ticket_id: string;
    product_area: string;
    review_status: string;
    source_config: string;
    source_model: string;
    prompt_version: string;
    reviewer: string | null;
    reviewed_at: string | null;
    edit_distance: number | null;
    example_id: string;
  };
};

/**
 * Approved TRAIN reviews in chat format for TRL's SFTTrainer. The user turn is rebuilt
 * with the inference prompt template (docs only, no few-shot examples), so the
 * fine-tuned model learns to answer from sources the way it will be called.
 */
export async function buildTrainingRecords(): Promise<TrainingRecord[]> {
  const reviews = await db.review.findMany({
    where: { status: { in: ["APPROVED", "EDITED_APPROVED"] }, finalAnswer: { not: null }, case: { split: "TRAIN" } },
    orderBy: [{ reviewedAt: "asc" }, { createdAt: "asc" }],
    include: { case: true, agentConfig: { select: { key: true } } },
  });

  const exportable = reviews.filter(isExportable);
  const chunkIds = [...new Set(exportable.flatMap((r) => asSourceRefs(r.sourceRefs).map((s) => s.chunkId)))];
  const chunks = await db.chunk.findMany({
    where: { id: { in: chunkIds } },
    include: { document: { select: { title: true } } },
  });
  const chunkById = new Map(chunks.map((c) => [c.id, c]));

  const records: TrainingRecord[] = [];
  for (const r of exportable) {
    let sources: RetrievedChunk[] = asSourceRefs(r.sourceRefs)
      .map((s) => chunkById.get(s.chunkId))
      .filter((c) => c !== undefined)
      .map((c) => ({ chunkId: c.id, documentId: c.documentId, title: c.document.title, heading: c.heading, text: c.text, rank: 0 }));
    if (sources.length === 0) {
      sources = await postgresRetriever.searchDocs(`${r.case.customerQuestion} ${r.case.productArea}`, 4);
    }

    const promptVersion = PROMPTS[r.promptVersion] ? r.promptVersion : DEFAULT_PROMPT_VERSION;
    const messages = buildMessages(promptVersion, {
      question: r.case.customerQuestion,
      productArea: r.case.productArea,
      sources,
      examples: [],
    });

    records.push({
      messages: [...messages, { role: "assistant", content: r.finalAnswer!.trim() }],
      metadata: {
        ticket_id: r.case.ticketId,
        product_area: r.case.productArea,
        review_status: r.status,
        source_config: r.agentConfig.key,
        source_model: r.modelName,
        prompt_version: promptVersion,
        reviewer: r.reviewer,
        reviewed_at: r.reviewedAt?.toISOString() ?? null,
        edit_distance: r.editDistance,
        example_id: r.id,
      },
    });
  }
  return records;
}

export function toJsonl(records: TrainingRecord[]) {
  return records.map((r) => JSON.stringify(r)).join("\n") + (records.length ? "\n" : "");
}
