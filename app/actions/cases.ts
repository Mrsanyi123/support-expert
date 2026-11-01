"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { assertSplitsFrozen, LeakageError, type SplitChange } from "@/lib/guards";
import { parseTicketsCsv, type RowError } from "@/lib/import/csv";
import { loadDemoDataset } from "@/lib/seed/demo";

export type ImportResult =
  | { ok: true; created: number; updated: number; skipped: RowError[]; heldOut: number }
  | { ok: false; error: string };

export async function importCasesAction(csvText: string): Promise<ImportResult> {
  if (csvText.length > 5_000_000) return { ok: false, error: "File is larger than 5 MB." };
  const parsed = parseTicketsCsv(csvText);
  if (parsed.missingColumns.length > 0) {
    return { ok: false, error: `Missing required columns: ${parsed.missingColumns.join(", ")}` };
  }
  if (parsed.rows.length === 0) return { ok: false, error: "No valid rows to import." };

  const locked = (await db.evalSet.count({ where: { lockedAt: { not: null } } })) > 0;
  const existing = await db.case.findMany({
    where: { ticketId: { in: parsed.rows.map((r) => r.ticketId) } },
    select: { ticketId: true, split: true },
  });
  const existingSplit = new Map(existing.map((e) => [e.ticketId, e.split]));

  const skipped: RowError[] = [...parsed.errors];
  let created = 0;
  let updated = 0;
  let heldOut = 0;

  for (const row of parsed.rows) {
    const current = existingSplit.get(row.ticketId);
    // Auto-assigned splits never move an existing case; only an explicit CSV split can.
    const targetSplit = current && row.splitSource === "auto" ? current : row.split;
    if (current) {
      const change: SplitChange = { ticketId: row.ticketId, from: current, to: targetSplit };
      try {
        assertSplitsFrozen([change], locked);
      } catch (e) {
        if (e instanceof LeakageError) {
          skipped.push({ line: 0, ticketId: row.ticketId, message: e.message });
          continue;
        }
        throw e;
      }
      await db.case.update({
        where: { ticketId: row.ticketId },
        data: {
          customerQuestion: row.customerQuestion,
          expertResolution: row.expertResolution,
          productArea: row.productArea,
          split: targetSplit,
        },
      });
      updated++;
    } else {
      await db.case.create({
        data: {
          ticketId: row.ticketId,
          customerQuestion: row.customerQuestion,
          expertResolution: row.expertResolution,
          productArea: row.productArea,
          split: row.split,
        },
      });
      created++;
    }
    if (targetSplit === "EVAL") heldOut++;
  }

  revalidatePath("/", "layout");
  return { ok: true, created, updated, skipped, heldOut };
}

export async function loadDemoDatasetAction() {
  const summary = await loadDemoDataset();
  revalidatePath("/", "layout");
  return summary;
}
