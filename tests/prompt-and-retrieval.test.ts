import { describe, expect, it } from "vitest";
import { OfflineStubRunner } from "@/lib/llm/offline-stub";
import { compareRatings, countRatings, editDistance, editRatio } from "@/lib/metrics";
import { buildMessages, DEFAULT_PROMPT_VERSION } from "@/lib/prompt";
import { chunkDocument, titleFromContent } from "@/lib/retrieval/chunking";
import { toOrTsQuery } from "@/lib/retrieval/query";

const source = {
  chunkId: "c1",
  documentId: "d1",
  title: "Rate limits",
  heading: "Limits",
  text: "Live mode allows 100 requests per second. Test mode allows 25 requests per second.",
  rank: 0.5,
};
const example = {
  reviewId: "r1",
  caseId: "case1",
  ticketId: "T-1012",
  productArea: "rate-limits",
  question: "429s in test mode at 10 rps?",
  answer: "Test keys created before March 2024 are on a legacy 10 req/s pool. Roll the key.",
  rank: 0.2,
};

describe("chunkDocument", () => {
  it("splits on headings and keeps the H1 as the intro heading", () => {
    const chunks = chunkDocument("# Title\n\nIntro text.\n\n## Part A\n\nAlpha.\n\n## Part B\n\nBeta.");
    expect(chunks.map((c) => [c.heading, c.text])).toEqual([
      ["Title", "Intro text."],
      ["Part A", "Alpha."],
      ["Part B", "Beta."],
    ]);
  });

  it("does not treat # inside code fences as headings", () => {
    const chunks = chunkDocument("## Setup\n\n```bash\n# install\nnpm i\n```\n");
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toContain("# install");
  });

  it("derives a title from the filename when there is no H1", () => {
    expect(titleFromContent("plain text", "03-webhook_retries.txt")).toBe("Webhook Retries");
  });
});

describe("toOrTsQuery", () => {
  it("builds an OR query without stopwords or bare numbers", () => {
    expect(toOrTsQuery("Why are we getting 429 errors in test mode?")).toBe("getting | errors | test | mode");
  });

  it("returns null when nothing is searchable", () => {
    expect(toOrTsQuery("is it 42?")).toBeNull();
  });
});

describe("buildMessages", () => {
  it("numbers sources and examples and wraps the ticket", () => {
    const [system, user] = buildMessages(DEFAULT_PROMPT_VERSION, {
      question: "Why 429 in test mode?",
      productArea: "rate-limits",
      sources: [source],
      examples: [example],
    });
    expect(system.role).toBe("system");
    expect(system.content).toContain("[D1]");
    expect(user.content).toContain("[D1] Rate limits - Limits");
    expect(user.content).toContain("[E1] T-1012 (rate-limits)");
    expect(user.content).toContain('<ticket product_area="rate-limits">');
  });

  it("omits the examples block when there are none", () => {
    const [, user] = buildMessages(DEFAULT_PROMPT_VERSION, { question: "q?", sources: [source], examples: [] });
    expect(user.content).not.toContain("<resolved_examples>");
  });

  it("rejects unknown prompt versions", () => {
    expect(() => buildMessages("nope", { question: "q", sources: [], examples: [] })).toThrow();
  });
});

describe("OfflineStubRunner", () => {
  it("follows the top resolved example when one is present", async () => {
    const messages = buildMessages(DEFAULT_PROMPT_VERSION, { question: "q", sources: [source], examples: [example] });
    const result = await new OfflineStubRunner("m").generate(messages);
    expect(result.text).toContain("legacy 10 req/s pool");
    expect(result.text).toContain("[E1]");
  });

  it("falls back to extractive sentences from the sources", async () => {
    const messages = buildMessages(DEFAULT_PROMPT_VERSION, { question: "q", sources: [source], examples: [] });
    const result = await new OfflineStubRunner("m").generate(messages);
    expect(result.text).toContain("Live mode allows 100 requests per second.");
    expect(result.text).toContain("[D1]");
  });
});

describe("metrics", () => {
  it("measures edits", () => {
    expect(editDistance("abc", "abc")).toBe(0);
    expect(editDistance("abc", "abd")).toBe(1);
    expect(editRatio("abcd", "wxyz")).toBe(1);
  });

  it("counts ratings and compares versions per case", () => {
    expect(countRatings([{ rating: "CORRECT" }, { rating: "WRONG" }, { rating: null }])).toEqual({
      CORRECT: 1,
      INCOMPLETE: 0,
      WRONG: 1,
      unrated: 1,
      total: 3,
    });
    expect(compareRatings("WRONG", "CORRECT")).toBe("improved");
    expect(compareRatings("CORRECT", "INCOMPLETE")).toBe("regressed");
    expect(compareRatings("CORRECT", "CORRECT")).toBe("unchanged");
    expect(compareRatings(null, "CORRECT")).toBe("unrated");
  });
});
