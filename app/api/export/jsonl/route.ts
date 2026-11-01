import { connection } from "next/server";
import { buildTrainingRecords, toJsonl } from "@/lib/export/jsonl";

export async function GET() {
  await connection();
  const records = await buildTrainingRecords();
  const date = new Date().toISOString().slice(0, 10);
  return new Response(toJsonl(records), {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Content-Disposition": `attachment; filename="approved-examples-${date}.jsonl"`,
      "X-Example-Count": String(records.length),
    },
  });
}
