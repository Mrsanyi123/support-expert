import Papa from "papaparse";
import { z } from "zod";

export const REQUIRED_COLUMNS = ["ticket_id", "customer_question", "expert_resolution", "product_area"] as const;

const rowSchema = z.object({
  ticket_id: z.string().trim().min(1, "ticket_id is empty").max(64),
  customer_question: z.string().trim().min(10, "customer_question is too short"),
  expert_resolution: z.string().trim().min(10, "expert_resolution is too short"),
  product_area: z
    .string()
    .trim()
    .min(1, "product_area is empty")
    .transform((v) => v.toLowerCase().replace(/\s+/g, "-")),
  split: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v.toUpperCase() : undefined))
    .refine((v) => v === undefined || v === "TRAIN" || v === "EVAL", "split must be TRAIN or EVAL"),
});

export type TicketRow = {
  ticketId: string;
  customerQuestion: string;
  expertResolution: string;
  productArea: string;
  split: "TRAIN" | "EVAL";
  splitSource: "csv" | "auto";
};

export type RowError = { line: number; ticketId?: string; message: string };

export type ParseResult = {
  rows: TicketRow[];
  errors: RowError[];
  missingColumns: string[];
  totalRows: number;
};

export function parseTicketsCsv(text: string, opts: { evalFraction?: number } = {}): ParseResult {
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^\uFEFF/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
  });

  const fields = parsed.meta.fields ?? [];
  const missingColumns = REQUIRED_COLUMNS.filter((c) => !fields.includes(c));
  if (missingColumns.length > 0) {
    return { rows: [], errors: [], missingColumns, totalRows: parsed.data.length };
  }

  const errors: RowError[] = parsed.errors.map((e) => ({ line: (e.row ?? 0) + 2, message: e.message }));
  const seen = new Set<string>();
  const valid: Omit<TicketRow, "split" | "splitSource">[] = [];
  const explicitSplit = new Map<string, "TRAIN" | "EVAL">();

  parsed.data.forEach((raw, index) => {
    const line = index + 2;
    const result = rowSchema.safeParse(raw);
    if (!result.success) {
      errors.push({ line, ticketId: raw.ticket_id, message: result.error.issues.map((i) => i.message).join("; ") });
      return;
    }
    const r = result.data;
    if (seen.has(r.ticket_id)) {
      errors.push({ line, ticketId: r.ticket_id, message: "duplicate ticket_id in file" });
      return;
    }
    seen.add(r.ticket_id);
    if (r.split) explicitSplit.set(r.ticket_id, r.split as "TRAIN" | "EVAL");
    valid.push({
      ticketId: r.ticket_id,
      customerQuestion: r.customer_question,
      expertResolution: r.expert_resolution,
      productArea: r.product_area,
    });
  });

  const auto = assignSplits(
    valid.filter((r) => !explicitSplit.has(r.ticketId)),
    opts.evalFraction ?? 0.3,
  );

  const rows: TicketRow[] = valid.map((r) => {
    const csvSplit = explicitSplit.get(r.ticketId);
    return csvSplit
      ? { ...r, split: csvSplit, splitSource: "csv" }
      : { ...r, split: auto.get(r.ticketId) ?? "TRAIN", splitSource: "auto" };
  });

  return { rows, errors, missingColumns: [], totalRows: parsed.data.length };
}

/** Deterministic per-area split: the same file always produces the same held-out set. */
export function assignSplits(rows: { ticketId: string; productArea: string }[], evalFraction: number) {
  const byArea = new Map<string, { ticketId: string; productArea: string }[]>();
  for (const r of rows) byArea.set(r.productArea, [...(byArea.get(r.productArea) ?? []), r]);

  const out = new Map<string, "TRAIN" | "EVAL">();
  for (const group of byArea.values()) {
    const sorted = [...group].sort((a, b) => hash(a.ticketId) - hash(b.ticketId));
    const evalCount = group.length >= 3 ? Math.round(group.length * evalFraction) : 0;
    sorted.forEach((r, i) => out.set(r.ticketId, i < evalCount ? "EVAL" : "TRAIN"));
  }
  return out;
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
