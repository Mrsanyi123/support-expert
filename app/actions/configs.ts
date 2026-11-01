"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { PROMPTS } from "@/lib/prompt";

const configSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(80),
  description: z.string().trim().max(300).optional(),
  baseUrl: z.url("Base URL must be a URL"),
  model: z.string().trim().min(1, "Model is required"),
  apiKeyEnv: z
    .string()
    .trim()
    .regex(/^[A-Z][A-Z0-9_]*$/, "Use an env var name like VLLM_API_KEY"),
  promptVersion: z.string().refine((v) => v in PROMPTS, "Unknown prompt version"),
  useExamples: z.boolean(),
  temperature: z.coerce.number().min(0).max(2),
});

export type CreateConfigState = { ok: boolean; error?: string } | null;

export async function createConfigAction(_prev: CreateConfigState, formData: FormData): Promise<CreateConfigState> {
  const parsed = configSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    baseUrl: formData.get("baseUrl"),
    model: formData.get("model"),
    apiKeyEnv: formData.get("apiKeyEnv"),
    promptVersion: formData.get("promptVersion"),
    useExamples: formData.get("useExamples") === "on",
    temperature: formData.get("temperature") ?? 0.2,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };

  const keys = (await db.agentConfig.findMany({ select: { key: true } })).map((c) => c.key);
  let key = "C";
  while (keys.includes(key)) key = String.fromCharCode(key.charCodeAt(0) + 1);

  await db.agentConfig.create({ data: { ...parsed.data, key, name: parsed.data.name.startsWith(`${key}:`) ? parsed.data.name : `${key}: ${parsed.data.name}` } });
  revalidatePath("/", "layout");
  return { ok: true };
}
