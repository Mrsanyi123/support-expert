import { db } from "@/lib/db";
import type { RetrievedChunk, RetrievedExample } from "@/lib/types";
import { chunkDocument, titleFromContent } from "./chunking";
import { toOrTsQuery } from "./query";

export interface Retriever {
  searchDocs(question: string, k: number): Promise<RetrievedChunk[]>;
  searchExamples(question: string, opts: { k: number; productArea?: string; excludeCaseId?: string }): Promise<RetrievedExample[]>;
}

/** Postgres full-text search. Swap for a pgvector retriever behind the same interface later. */
export const postgresRetriever: Retriever = {
  async searchDocs(question, k) {
    const query = toOrTsQuery(question);
    if (!query) return [];
    const rows = await db.$queryRaw<
      { chunkId: string; documentId: string; title: string; heading: string | null; text: string; rank: number }[]
    >`
      SELECT c.id AS "chunkId", c."documentId", d.title, c.heading, c.text,
             ts_rank(c.tsv, q, 1)::float8 AS rank
      FROM "Chunk" c
      JOIN "Document" d ON d.id = c."documentId",
           to_tsquery('english', ${query}) q
      WHERE c.tsv @@ q
      ORDER BY rank DESC, c.ordinal ASC
      LIMIT ${k}
    `;
    return rows;
  },

  /**
   * Few-shot pool. Only approved reviews of TRAIN cases are eligible; EVAL cases can
   * never be examples. The split and status filters are in SQL so no caller can skip them.
   */
  async searchExamples(question, { k, productArea, excludeCaseId }) {
    const query = toOrTsQuery(question);
    if (!query || k <= 0) return [];
    const rows = await db.$queryRaw<RetrievedExample[]>`
      SELECT * FROM (
        SELECT DISTINCT ON (c.id)
               r.id AS "reviewId", c.id AS "caseId", c."ticketId", c."productArea",
               c."customerQuestion" AS question, r."finalAnswer" AS answer,
               (ts_rank(to_tsvector('english', c."customerQuestion"), q, 1)
                 * CASE WHEN c."productArea" = ${productArea ?? ""} THEN 1.5 ELSE 1 END)::float8 AS rank
        FROM "Review" r
        JOIN "Case" c ON c.id = r."caseId",
             to_tsquery('english', ${query}) q
        WHERE c.split = 'TRAIN'
          AND r.status IN ('APPROVED', 'EDITED_APPROVED')
          AND r."finalAnswer" IS NOT NULL
          AND c.id <> ${excludeCaseId ?? ""}
          AND to_tsvector('english', c."customerQuestion") @@ q
        ORDER BY c.id, r."reviewedAt" DESC NULLS LAST
      ) pool
      ORDER BY rank DESC
      LIMIT ${k}
    `;
    const top = rows[0]?.rank ?? 0;
    return rows.filter((r) => r.rank >= Math.max(MIN_EXAMPLE_RANK, top * RELATIVE_EXAMPLE_CUTOFF));
  },
};

/** Weak lexical matches make few-shot examples misleading, so drop them. */
const MIN_EXAMPLE_RANK = 0.0015;
const RELATIVE_EXAMPLE_CUTOFF = 0.5;

export async function indexDocument(input: { filename: string; content: string; title?: string }) {
  const title = input.title ?? titleFromContent(input.content, input.filename);
  const chunks = chunkDocument(input.content);

  const doc = await db.$transaction(async (tx) => {
    const existing = await tx.document.findUnique({ where: { filename: input.filename } });
    if (existing) await tx.document.delete({ where: { id: existing.id } });
    return tx.document.create({
      data: {
        filename: input.filename,
        title,
        content: input.content,
        chunks: { create: chunks.map((c) => ({ ordinal: c.ordinal, heading: c.heading, text: c.text })) },
      },
    });
  });

  await db.$executeRaw`
    UPDATE "Chunk" c
    SET tsv = setweight(to_tsvector('english', d.title || ' ' || coalesce(c.heading, '')), 'A')
           || setweight(to_tsvector('english', c.text), 'B')
    FROM "Document" d
    WHERE d.id = c."documentId" AND c."documentId" = ${doc.id}
  `;

  return { document: doc, chunkCount: chunks.length };
}
