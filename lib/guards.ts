import type { ChatMessage, RetrievedExample } from "@/lib/types";

export class LeakageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LeakageError";
  }
}

/**
 * The only way a case becomes model input. Picks the question and area by name, so an
 * expert resolution can never ride along through object spreading.
 */
export function promptFieldsFromCase(c: { customerQuestion: string; productArea: string }) {
  return { question: c.customerQuestion, productArea: c.productArea };
}

function normalize(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Throws if the expected resolution of the case being answered appears in the prompt. */
export function assertNoResolutionLeak(messages: ChatMessage[], expectedResolution: string) {
  const resolution = normalize(expectedResolution);
  if (resolution.length < 20) return;
  const prompt = normalize(messages.map((m) => m.content).join("\n"));
  if (prompt.includes(resolution)) {
    throw new LeakageError("The expected resolution of the case being answered was found in the prompt.");
  }
}

/** Throws if any few-shot example is the case itself or comes from the evaluation split. */
export function assertExamplesAllowed(
  examples: Pick<RetrievedExample, "caseId" | "ticketId">[],
  opts: { answeringCaseId?: string; evalCaseIds: Set<string> },
) {
  for (const e of examples) {
    if (opts.answeringCaseId && e.caseId === opts.answeringCaseId) {
      throw new LeakageError(`Example ${e.ticketId} is the case being answered.`);
    }
    if (opts.evalCaseIds.has(e.caseId)) {
      throw new LeakageError(`Example ${e.ticketId} belongs to the evaluation split.`);
    }
  }
}

export type SplitChange = { ticketId: string; from: "TRAIN" | "EVAL"; to: "TRAIN" | "EVAL" };

/** Once any evaluation set is locked, no existing case may move between splits. */
export function assertSplitsFrozen(changes: SplitChange[], hasLockedEvalSet: boolean) {
  if (!hasLockedEvalSet) return;
  const moved = changes.filter((c) => c.from !== c.to);
  if (moved.length > 0) {
    throw new LeakageError(
      `An evaluation set is locked, so splits are frozen. Cannot move: ${moved.map((m) => m.ticketId).join(", ")}.`,
    );
  }
}

export type ExportCandidate = {
  status: string;
  finalAnswer: string | null;
  case: { split: string };
};

/** Only approved reviews of TRAIN cases may leave the system as training data. */
export function isExportable(r: ExportCandidate) {
  return (
    r.case.split === "TRAIN" &&
    (r.status === "APPROVED" || r.status === "EDITED_APPROVED") &&
    !!r.finalAnswer?.trim()
  );
}

function shingles(text: string, n: number) {
  const words = normalize(text).split(" ").filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i + n <= words.length; i++) out.add(words.slice(i, i + n).join(" "));
  return out;
}

export type DocLeakWarning = { ticketId: string; documentTitle: string; overlap: number };

/**
 * Flags evaluation cases whose expected resolution is largely copied into a help
 * document, which would leak the answer through retrieval.
 */
export function findDocLeakage(
  evalCases: { ticketId: string; expertResolution: string }[],
  chunks: { documentTitle: string; text: string }[],
  opts = { n: 8, threshold: 0.35 },
): DocLeakWarning[] {
  const chunkShingles = chunks.map((c) => ({ title: c.documentTitle, set: shingles(c.text, opts.n) }));
  const warnings: DocLeakWarning[] = [];
  for (const ec of evalCases) {
    const target = shingles(ec.expertResolution, opts.n);
    if (target.size === 0) continue;
    let best = { title: "", overlap: 0 };
    for (const c of chunkShingles) {
      let hits = 0;
      for (const s of target) if (c.set.has(s)) hits++;
      const overlap = hits / target.size;
      if (overlap > best.overlap) best = { title: c.title, overlap };
    }
    if (best.overlap >= opts.threshold) {
      warnings.push({ ticketId: ec.ticketId, documentTitle: best.title, overlap: Math.round(best.overlap * 100) / 100 });
    }
  }
  return warnings;
}
