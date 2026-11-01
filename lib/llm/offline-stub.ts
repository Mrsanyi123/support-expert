import type { ChatMessage } from "@/lib/types";
import type { GenerateResult, ModelRunner } from "./runner";

/**
 * Deterministic, extractive stand-in used when no API key is configured, so the
 * loop can be demonstrated offline. It is labelled as offline everywhere in the UI.
 */
export class OfflineStubRunner implements ModelRunner {
  readonly offline = true;

  constructor(private configuredModel: string) {}

  get model() {
    return `offline-stub (configured: ${this.configuredModel})`;
  }

  async generate(messages: ChatMessage[]): Promise<GenerateResult> {
    const started = performance.now();
    const user = messages.find((m) => m.role === "user")?.content ?? "";
    const sources = parseBlocks(user, "sources");
    const examples = parseBlocks(user, "resolved_examples");

    const parts: string[] = [];
    const example = examples[0];
    if (example) {
      const resolution = example.body.split(/Resolution:\s*/)[1]?.trim();
      if (resolution) parts.push(`${resolution} [${example.ref}]`);
    }
    if (parts.length === 0) {
      for (const source of sources.slice(0, 2)) {
        const sentence = firstSentences(stripMarkdown(source.body), 2);
        if (sentence) parts.push(`${sentence} [${source.ref}]`);
      }
    }
    const text =
      parts.length > 0
        ? parts.join("\n\n")
        : "I could not find this in the documentation. Could you share the exact error message and your SDK version?";

    return { text, latencyMs: Math.round(performance.now() - started) };
  }
}

function parseBlocks(input: string, tag: string) {
  const block = input.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))?.[1]?.trim();
  if (!block) return [];
  return block
    .split(/^(?=\[[DE]\d+\])/m)
    .map((entry) => {
      const ref = entry.match(/^\[([DE]\d+)\]/)?.[1];
      const body = entry.slice(entry.indexOf("\n") + 1).trim();
      return ref ? { ref, body } : null;
    })
    .filter((e): e is { ref: string; body: string } => e !== null);
}

function stripMarkdown(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^#+\s.*$/gm, " ")
    .replace(/^\|.*\|$/gm, " ")
    .replace(/[*`>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function firstSentences(text: string, count: number) {
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [];
  return sentences.slice(0, count).join(" ").trim();
}
