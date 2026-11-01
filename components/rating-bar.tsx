import { RATING_STYLE } from "@/components/badges";
import type { RatingCounts } from "@/lib/metrics";
import { cn } from "@/lib/utils";

export function RatingBar({ counts, className }: { counts: RatingCounts; className?: string }) {
  const total = Math.max(counts.total, 1);
  const segments = [
    { key: "CORRECT", value: counts.CORRECT, className: RATING_STYLE.CORRECT.bar },
    { key: "INCOMPLETE", value: counts.INCOMPLETE, className: RATING_STYLE.INCOMPLETE.bar },
    { key: "WRONG", value: counts.WRONG, className: RATING_STYLE.WRONG.bar },
    { key: "unrated", value: counts.unrated, className: "bg-muted-foreground/20" },
  ];
  return (
    <div className={cn("flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-muted", className)}>
      {segments.map((s) =>
        s.value > 0 ? (
          <div key={s.key} className={cn("first:rounded-l-full last:rounded-r-full", s.className)} style={{ width: `${(s.value / total) * 100}%` }} />
        ) : null,
      )}
    </div>
  );
}

export function RatingCountsText({ counts, className }: { counts: RatingCounts; className?: string }) {
  const items = [
    { label: "correct", value: counts.CORRECT, dot: RATING_STYLE.CORRECT.bar },
    { label: "incomplete", value: counts.INCOMPLETE, dot: RATING_STYLE.INCOMPLETE.bar },
    { label: "wrong", value: counts.WRONG, dot: RATING_STYLE.WRONG.bar },
    ...(counts.unrated > 0 ? [{ label: "unrated", value: counts.unrated, dot: "bg-muted-foreground/30" }] : []),
  ];
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground tabular-nums", className)}>
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className={cn("size-1.5 rounded-full", i.dot)} />
          <span className="font-medium text-foreground">{i.value}</span> {i.label}
        </span>
      ))}
    </div>
  );
}
