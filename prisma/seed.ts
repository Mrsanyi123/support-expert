import "dotenv/config";
import { db } from "@/lib/db";
import { loadDemoDataset } from "@/lib/seed/demo";

loadDemoDataset()
  .then((summary) => {
    console.log("Seeded demo dataset:", summary);
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
