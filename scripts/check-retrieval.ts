import "dotenv/config";
import { db } from "@/lib/db";
import { postgresRetriever } from "@/lib/retrieval";

/** Prints what the model would see for each EVAL case: top docs and (for B) examples. */
async function main() {
  const cases = await db.case.findMany({ where: { split: "EVAL" }, orderBy: { ticketId: "asc" } });
  for (const c of cases) {
    const docs = await postgresRetriever.searchDocs(`${c.customerQuestion} ${c.productArea}`, 4);
    const examples = await postgresRetriever.searchExamples(c.customerQuestion, {
      k: 3,
      productArea: c.productArea,
      excludeCaseId: c.id,
    });
    console.log(`\n${c.ticketId} [${c.productArea}] ${c.customerQuestion.slice(0, 80)}`);
    for (const d of docs) console.log(`  D ${d.rank.toFixed(3)} ${d.title} / ${d.heading}`);
    for (const e of examples) console.log(`  E ${e.rank.toFixed(3)} ${e.ticketId} ${e.question.slice(0, 60)}`);
  }
}

main().finally(() => db.$disconnect());
