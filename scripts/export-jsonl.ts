import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { buildTrainingRecords, toJsonl } from "@/lib/export/jsonl";

/** Writes approved TRAIN examples to exports/approved-examples.jsonl for ml/finetune.py. */
async function main() {
  const records = await buildTrainingRecords();
  const out = path.join(process.cwd(), "exports", "approved-examples.jsonl");
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, toJsonl(records), "utf8");
  console.log(`Wrote ${records.length} approved examples to ${out}`);
}

main().finally(() => db.$disconnect());
