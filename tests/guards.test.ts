import { describe, expect, it } from "vitest";
import {
  LeakageError,
  assertExamplesAllowed,
  assertNoResolutionLeak,
  assertSplitsFrozen,
  findDocLeakage,
  isExportable,
  promptFieldsFromCase,
} from "@/lib/guards";
import { buildMessages, DEFAULT_PROMPT_VERSION } from "@/lib/prompt";

const evalCase = {
  id: "case_eval",
  ticketId: "T-9",
  customerQuestion: "Why does verify fail for Japanese orders on SDK 3.2.1?",
  expertResolution: "Known bug in 3.2.0 to 3.2.2 with non-ASCII payloads. Upgrade to 3.2.3 or later.",
  productArea: "sdk-node",
};

describe("promptFieldsFromCase", () => {
  it("never carries the expert resolution", () => {
    const fields = promptFieldsFromCase(evalCase);
    expect(fields).toEqual({ question: evalCase.customerQuestion, productArea: "sdk-node" });
    expect(JSON.stringify(fields)).not.toContain("Upgrade to 3.2.3");
  });

  it("produces a prompt without the resolution", () => {
    const messages = buildMessages(DEFAULT_PROMPT_VERSION, {
      ...promptFieldsFromCase(evalCase),
      sources: [],
      examples: [],
    });
    expect(() => assertNoResolutionLeak(messages, evalCase.expertResolution)).not.toThrow();
  });
});

describe("assertNoResolutionLeak", () => {
  it("throws when the expected resolution is in the prompt, ignoring case and punctuation", () => {
    const leaked = [
      { role: "user" as const, content: `Ticket... KNOWN BUG in 3.2.0 to 3.2.2 with non ASCII payloads; upgrade to 3.2.3 or later!` },
    ];
    expect(() => assertNoResolutionLeak(leaked, evalCase.expertResolution)).toThrow(LeakageError);
  });
});

describe("assertExamplesAllowed", () => {
  const evalCaseIds = new Set(["case_eval", "case_eval_2"]);

  it("allows TRAIN examples", () => {
    expect(() =>
      assertExamplesAllowed([{ caseId: "case_train", ticketId: "T-1" }], { answeringCaseId: "case_eval", evalCaseIds }),
    ).not.toThrow();
  });

  it("rejects an EVAL case used as an example", () => {
    expect(() =>
      assertExamplesAllowed([{ caseId: "case_eval_2", ticketId: "T-2" }], { answeringCaseId: "case_eval", evalCaseIds }),
    ).toThrow(/evaluation split/);
  });

  it("rejects the case being answered", () => {
    expect(() =>
      assertExamplesAllowed([{ caseId: "case_train", ticketId: "T-1" }], {
        answeringCaseId: "case_train",
        evalCaseIds,
      }),
    ).toThrow(/case being answered/);
  });
});

describe("assertSplitsFrozen", () => {
  const moves = [{ ticketId: "T-1", from: "TRAIN" as const, to: "EVAL" as const }];

  it("allows split changes before any eval set is locked", () => {
    expect(() => assertSplitsFrozen(moves, false)).not.toThrow();
  });

  it("blocks split changes once an eval set is locked", () => {
    expect(() => assertSplitsFrozen(moves, true)).toThrow(/splits are frozen/);
  });

  it("allows re-importing a case with the same split", () => {
    expect(() => assertSplitsFrozen([{ ticketId: "T-1", from: "EVAL", to: "EVAL" }], true)).not.toThrow();
  });
});

describe("isExportable", () => {
  it("exports approved and edited-approved TRAIN reviews only", () => {
    expect(isExportable({ status: "APPROVED", finalAnswer: "ok", case: { split: "TRAIN" } })).toBe(true);
    expect(isExportable({ status: "EDITED_APPROVED", finalAnswer: "ok", case: { split: "TRAIN" } })).toBe(true);
    expect(isExportable({ status: "APPROVED", finalAnswer: "ok", case: { split: "EVAL" } })).toBe(false);
    expect(isExportable({ status: "REJECTED", finalAnswer: null, case: { split: "TRAIN" } })).toBe(false);
    expect(isExportable({ status: "PENDING", finalAnswer: "draft", case: { split: "TRAIN" } })).toBe(false);
    expect(isExportable({ status: "APPROVED", finalAnswer: "   ", case: { split: "TRAIN" } })).toBe(false);
  });
});

describe("findDocLeakage", () => {
  it("flags an eval resolution copied into a help document", () => {
    const warnings = findDocLeakage(
      [{ ticketId: "T-9", expertResolution: evalCase.expertResolution }],
      [
        { documentTitle: "Node SDK", text: "Install with npm. Then call verify on the raw body." },
        {
          documentTitle: "Internal notes",
          text: `Heads up: known bug in 3.2.0 to 3.2.2 with non-ASCII payloads. Upgrade to 3.2.3 or later.`,
        },
      ],
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0].documentTitle).toBe("Internal notes");
  });

  it("does not flag ordinary topical overlap", () => {
    const warnings = findDocLeakage(
      [{ ticketId: "T-9", expertResolution: evalCase.expertResolution }],
      [{ documentTitle: "Node SDK", text: "The Node SDK supports Node 18. Upgrade to the latest version for new features." }],
    );
    expect(warnings).toHaveLength(0);
  });
});
