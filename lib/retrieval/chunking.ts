export type ChunkDraft = { ordinal: number; heading: string | null; text: string };

const MAX_CHARS = 1400;

/** Splits Markdown or plain text into heading-scoped chunks, keeping code blocks intact. */
export function chunkDocument(content: string): ChunkDraft[] {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const sections: { heading: string | null; lines: string[] }[] = [{ heading: null, lines: [] }];
  let inFence = false;
  for (const line of normalized.split("\n")) {
    if (line.trim().startsWith("```")) inFence = !inFence;
    const heading = !inFence ? line.match(/^#{1,3}\s+(.*)$/) : null;
    if (heading && line.startsWith("#")) {
      const level = line.match(/^#+/)![0].length;
      if (level === 1) {
        sections[0].heading ??= heading[1].trim();
        continue;
      }
      sections.push({ heading: heading[1].trim(), lines: [] });
      continue;
    }
    sections[sections.length - 1].lines.push(line);
  }

  const chunks: ChunkDraft[] = [];
  for (const section of sections) {
    const body = section.lines.join("\n").trim();
    if (!body) continue;
    for (const piece of splitLong(body)) {
      chunks.push({ ordinal: chunks.length, heading: section.heading, text: piece });
    }
  }
  return chunks;
}

function splitLong(text: string): string[] {
  if (text.length <= MAX_CHARS) return [text];
  const paragraphs = text.split(/\n{2,}/);
  const out: string[] = [];
  let current = "";
  for (const p of paragraphs) {
    if (current && current.length + p.length + 2 > MAX_CHARS) {
      out.push(current);
      current = p;
    } else {
      current = current ? `${current}\n\n${p}` : p;
    }
  }
  if (current) out.push(current);
  return out;
}

export function titleFromContent(content: string, filename: string) {
  const h1 = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (h1) return h1;
  return filename
    .replace(/\.(md|markdown|txt)$/i, "")
    .replace(/^\d+[-_]/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
