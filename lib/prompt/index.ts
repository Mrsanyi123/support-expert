import type { ChatMessage, RetrievedChunk, RetrievedExample } from "@/lib/types";

/**
 * Everything the model may see for one ticket. Deliberately has no field for the
 * expert resolution: callers build it from the question alone (see lib/guards.ts).
 */
export type PromptInput = {
  question: string;
  productArea?: string;
  sources: RetrievedChunk[];
  examples: RetrievedExample[];
};

type PromptTemplate = {
  version: string;
  description: string;
  system: (productName: string) => string;
};

const SUPPORT_V1: PromptTemplate = {
  version: "support-v1",
  description: "Docs-grounded answer with inline citations; follows resolved examples when present.",
  system: (productName) =>
    [
      `You are a senior technical support engineer for ${productName}.`,
      "Answer the customer's ticket using only the provided sources and resolved examples.",
      "Cite documentation inline as [D1], [D2].",
      "Resolved examples are past tickets answered by our support experts. They contain internal knowledge that is not in the docs. When one covers the same issue, follow it and cite it as [E1].",
      "If the sources do not answer the question, say what is missing and what information you need instead of guessing.",
      "Write directly to the customer in 2 to 6 sentences with concrete steps. No greetings or sign-offs.",
    ].join(" "),
};

export const PROMPTS: Record<string, PromptTemplate> = {
  [SUPPORT_V1.version]: SUPPORT_V1,
};

export const DEFAULT_PROMPT_VERSION = SUPPORT_V1.version;

export function productName() {
  return process.env.PRODUCT_NAME ?? "Relay";
}

export function buildMessages(promptVersion: string, input: PromptInput): ChatMessage[] {
  const template = PROMPTS[promptVersion];
  if (!template) throw new Error(`Unknown prompt version: ${promptVersion}`);
  return [
    { role: "system", content: template.system(productName()) },
    { role: "user", content: buildUserTurn(input) },
  ];
}

export function buildUserTurn(input: PromptInput): string {
  const parts: string[] = [];

  const sources = input.sources
    .map((s, i) => `[D${i + 1}] ${s.title}${s.heading ? ` - ${s.heading}` : ""}\n${s.text.trim()}`)
    .join("\n\n");
  parts.push(`<sources>\n${sources || "(no matching documentation)"}\n</sources>`);

  if (input.examples.length > 0) {
    const examples = input.examples
      .map((e, i) => `[E${i + 1}] ${e.ticketId} (${e.productArea})\nTicket: ${e.question.trim()}\nResolution: ${e.answer.trim()}`)
      .join("\n\n");
    parts.push(`<resolved_examples>\n${examples}\n</resolved_examples>`);
  }

  const area = input.productArea ? ` product_area="${input.productArea}"` : "";
  parts.push(`<ticket${area}>\n${input.question.trim()}\n</ticket>`);
  return parts.join("\n\n");
}
