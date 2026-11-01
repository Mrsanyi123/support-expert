import OpenAI from "openai";
import type { ChatMessage } from "@/lib/types";
import { OfflineStubRunner } from "./offline-stub";

export type GenerateOptions = { temperature: number; maxTokens: number };

export type GenerateResult = {
  text: string;
  latencyMs: number;
  usage?: { input: number; output: number };
};

export interface ModelRunner {
  readonly model: string;
  readonly offline: boolean;
  generate(messages: ChatMessage[], opts: GenerateOptions): Promise<GenerateResult>;
}

/** Works for Together, Fireworks, OpenRouter, Groq and vLLM's OpenAI-compatible server. */
export class OpenAICompatibleRunner implements ModelRunner {
  readonly offline = false;
  private client: OpenAI;

  constructor(
    private opts: { baseUrl: string; apiKey: string; model: string },
  ) {
    this.client = new OpenAI({ baseURL: opts.baseUrl, apiKey: opts.apiKey, maxRetries: 2, timeout: 60_000 });
  }

  get model() {
    return this.opts.model;
  }

  async generate(messages: ChatMessage[], opts: GenerateOptions): Promise<GenerateResult> {
    const started = performance.now();
    const completion = await this.client.chat.completions.create({
      model: this.opts.model,
      messages,
      temperature: opts.temperature,
      max_tokens: opts.maxTokens,
    });
    const text = completion.choices[0]?.message?.content?.trim() ?? "";
    return {
      text,
      latencyMs: Math.round(performance.now() - started),
      usage: completion.usage
        ? { input: completion.usage.prompt_tokens, output: completion.usage.completion_tokens }
        : undefined,
    };
  }
}

export type RunnerConfig = { baseUrl: string; model: string; apiKeyEnv: string };

export function runnerFor(config: RunnerConfig): ModelRunner {
  const apiKey = process.env[config.apiKeyEnv];
  if (!apiKey) return new OfflineStubRunner(config.model);
  return new OpenAICompatibleRunner({ baseUrl: config.baseUrl, apiKey, model: config.model });
}

export function isOffline(config: Pick<RunnerConfig, "apiKeyEnv">) {
  return !process.env[config.apiKeyEnv];
}
