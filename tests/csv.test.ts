import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assignSplits, parseTicketsCsv } from "@/lib/import/csv";

describe("parseTicketsCsv", () => {
  it("parses the seeded dataset with 50 TRAIN and 20 EVAL cases", () => {
    const csv = readFileSync(path.join(__dirname, "..", "seed", "tickets.csv"), "utf8");
    const result = parseTicketsCsv(csv);
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(70);
    expect(result.rows.filter((r) => r.split === "TRAIN")).toHaveLength(50);
    expect(result.rows.filter((r) => r.split === "EVAL")).toHaveLength(20);
  });

  it("reports missing columns", () => {
    const result = parseTicketsCsv("ticket_id,question\nT-1,hello");
    expect(result.missingColumns).toEqual(["customer_question", "expert_resolution", "product_area"]);
  });

  it("reports invalid and duplicate rows with line numbers", () => {
    const csv = [
      "ticket_id,customer_question,expert_resolution,product_area,split",
      "T-1,How do I rotate keys safely?,Use Roll key and keep the overlap.,auth,TRAIN",
      "T-1,How do I rotate keys safely?,Use Roll key and keep the overlap.,auth,TRAIN",
      "T-2,short,Use Roll key and keep the overlap.,auth,TRAIN",
      "T-3,How do I rotate keys safely?,Use Roll key and keep the overlap.,auth,TEST",
    ].join("\n");
    const result = parseTicketsCsv(csv);
    expect(result.rows.map((r) => r.ticketId)).toEqual(["T-1"]);
    expect(result.errors.map((e) => e.line)).toEqual([3, 4, 5]);
  });

  it("normalizes headers and product areas", () => {
    const csv = "Ticket ID,Customer Question,Expert Resolution,Product Area\nT-1,How do I rotate keys safely?,Use Roll key and keep the overlap.,Rate Limits";
    const result = parseTicketsCsv(csv);
    expect(result.rows[0]).toMatchObject({ ticketId: "T-1", productArea: "rate-limits", splitSource: "auto" });
  });
});

describe("assignSplits", () => {
  const rows = Array.from({ length: 10 }, (_, i) => ({ ticketId: `T-${i}`, productArea: i < 5 ? "auth" : "billing" }));

  it("holds out about 30% per product area", () => {
    const splits = assignSplits(rows, 0.3);
    const evalAuth = rows.filter((r) => r.productArea === "auth" && splits.get(r.ticketId) === "EVAL");
    const evalBilling = rows.filter((r) => r.productArea === "billing" && splits.get(r.ticketId) === "EVAL");
    expect(evalAuth.length).toBe(2);
    expect(evalBilling.length).toBe(2);
  });

  it("is deterministic", () => {
    const forward = Object.fromEntries(assignSplits(rows, 0.3));
    const reversed = Object.fromEntries(assignSplits([...rows].reverse(), 0.3));
    expect(reversed).toEqual(forward);
  });
});
