import { diffWords } from "diff";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ExampleRef, SourceRef } from "@/lib/types";

/** Renders an answer with [D1]/[E1] citation chips. `blind` hides them so the rater can't infer the version. */
export function AnswerText({ text, blind = false, className }: { text: string; blind?: boolean; className?: string }) {
  const parts = text.split(/(\[[DE]\d+\])/g);
  return (
    <div className={cn("prose-answer", className)}>
      {parts.map((part, i) => {
        const m = part.match(/^\[([DE])(\d+)\]$/);
        if (!m) return <span key={i}>{part}</span>;
        if (blind) return null;
        return (
          <span key={i} className={cn("cite", m[1] === "E" && "cite-example")}>
            {m[1]}
            {m[2]}
          </span>
        );
      })}
    </div>
  );
}

export function WordDiff({ before, after, className }: { before: string; after: string; className?: string }) {
  const changes = diffWords(before, after);
  return (
    <div className={cn("prose-answer", className)}>
      {changes.map((c, i) =>
        c.added ? (
          <ins key={i} className="rounded-sm bg-success/15 text-foreground no-underline decoration-success">
            {c.value}
          </ins>
        ) : c.removed ? (
          <del key={i} className="rounded-sm bg-destructive/10 text-muted-foreground decoration-destructive/50">
            {c.value}
          </del>
        ) : (
          <span key={i}>{c.value}</span>
        ),
      )}
    </div>
  );
}

export function SourcesList({ sources, compact = false }: { sources: SourceRef[]; compact?: boolean }) {
  if (sources.length === 0) return <div className="text-xs text-muted-foreground">No matching documentation was retrieved.</div>;
  return (
    <ol className="space-y-2">
      {sources.map((s) => (
        <li key={s.ref} className="rounded-lg border bg-card p-3">
          <div className="flex items-start gap-2">
            <span className="cite mt-0.5 shrink-0">{s.ref}</span>
            <div className="min-w-0">
              <div className="text-sm leading-snug font-medium">{s.title}</div>
              {s.heading && <div className="text-xs text-muted-foreground">{s.heading}</div>}
            </div>
          </div>
          {!compact && <p className="mt-2 line-clamp-5 text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">{s.snippet}</p>}
        </li>
      ))}
    </ol>
  );
}

export type ExampleDetail = ExampleRef & { question: string; answer: string };

export function ExamplesList({ examples }: { examples: ExampleDetail[] }) {
  if (examples.length === 0) return null;
  return (
    <ol className="space-y-2">
      {examples.map((e) => (
        <li key={e.ref} className="rounded-lg border border-warning/30 bg-warning/5 p-3">
          <div className="flex items-center gap-2">
            <span className="cite cite-example">{e.ref}</span>
            <Link href={`/review/${e.caseId}`} className="font-mono text-xs text-muted-foreground hover:text-foreground hover:underline">
              {e.ticketId}
            </Link>
            <span className="ml-auto text-xs text-muted-foreground">Expert answer</span>
          </div>
          <p className="mt-2 line-clamp-2 text-sm font-medium">{e.question}</p>
          <p className="mt-1 line-clamp-4 text-xs leading-relaxed text-muted-foreground">{e.answer}</p>
        </li>
      ))}
    </ol>
  );
}
