"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { indexDocument } from "@/lib/retrieval";

export type UploadDocsResult = { ok: boolean; indexed: { filename: string; chunks: number }[]; errors: string[] };

const MAX_BYTES = 1_000_000;

export async function uploadDocsAction(_prev: UploadDocsResult | null, formData: FormData): Promise<UploadDocsResult> {
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  const indexed: UploadDocsResult["indexed"] = [];
  const errors: string[] = [];

  if (files.length === 0) return { ok: false, indexed, errors: ["Choose at least one .md or .txt file."] };

  for (const file of files) {
    if (!/\.(md|markdown|txt)$/i.test(file.name)) {
      errors.push(`${file.name}: only Markdown and plain text are supported for now.`);
      continue;
    }
    if (file.size > MAX_BYTES) {
      errors.push(`${file.name}: larger than 1 MB.`);
      continue;
    }
    const content = await file.text();
    const { chunkCount } = await indexDocument({ filename: file.name, content });
    indexed.push({ filename: file.name, chunks: chunkCount });
  }

  revalidatePath("/docs");
  return { ok: errors.length === 0, indexed, errors };
}

export async function deleteDocumentAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (id) await db.document.delete({ where: { id } });
  revalidatePath("/docs");
}
