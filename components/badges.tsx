import { ArrowDown, ArrowUp, Lock, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type Tone = "neutral" | "success" | "warning" | "danger" | "info";

const DOT: Record<Tone, string> = {
  neutral: "bg-muted-foreground/50",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  info: "bg-info",
};

/** Outline badge with a colored status dot: readable in both themes without tinted backgrounds. */
export function StatusBadge({ tone, children, className }: { tone: Tone; children: React.ReactNode; className?: string }) {
  return (
    <Badge variant="outline" className={cn("gap-1.5 font-normal", className)}>
      <span className={cn("size-1.5 rounded-full", DOT[tone])} />
      {children}
    </Badge>
  );
}

export function SplitBadge({ split }: { split: "TRAIN" | "EVAL" }) {
  return split === "EVAL" ? (
    <Badge variant="secondary" className="gap-1 font-normal">
      <Lock /> Held-out
    </Badge>
  ) : (
    <Badge variant="outline" className="font-normal text-muted-foreground">
      Train
    </Badge>
  );
}

const CASE_STATUS: Record<string, { label: string; tone: Tone }> = {
  NEW: { label: "New", tone: "neutral" },
  DRAFTED: { label: "Drafted", tone: "warning" },
  APPROVED: { label: "Approved", tone: "success" },
  REJECTED: { label: "Rejected", tone: "danger" },
};

export function CaseStatusBadge({ status }: { status: string }) {
  const s = CASE_STATUS[status] ?? CASE_STATUS.NEW;
  return <StatusBadge tone={s.tone}>{s.label}</StatusBadge>;
}

const REVIEW_STATUS: Record<string, { label: string; tone: Tone }> = {
  PENDING: { label: "Awaiting review", tone: "warning" },
  APPROVED: { label: "Approved", tone: "success" },
  EDITED_APPROVED: { label: "Edited & approved", tone: "info" },
  REJECTED: { label: "Rejected", tone: "danger" },
};

export function ReviewStatusBadge({ status }: { status: string }) {
  const s = REVIEW_STATUS[status] ?? REVIEW_STATUS.PENDING;
  return <StatusBadge tone={s.tone}>{s.label}</StatusBadge>;
}

export const RATING_STYLE = {
  CORRECT: { label: "Correct", tone: "success", bar: "bg-success" },
  INCOMPLETE: { label: "Incomplete", tone: "warning", bar: "bg-warning" },
  WRONG: { label: "Wrong", tone: "danger", bar: "bg-destructive" },
} as const;

export function RatingBadge({ rating }: { rating: "CORRECT" | "INCOMPLETE" | "WRONG" | null | undefined }) {
  if (!rating)
    return (
      <Badge variant="outline" className="border-dashed font-normal text-muted-foreground">
        Unrated
      </Badge>
    );
  const s = RATING_STYLE[rating];
  return <StatusBadge tone={s.tone}>{s.label}</StatusBadge>;
}

export function ErrorBadge() {
  return <StatusBadge tone="danger">Error</StatusBadge>;
}

export function SourceBadge({ source }: { source: string }) {
  return source === "seed" ? (
    <Badge variant="outline" className="border-dashed font-normal text-muted-foreground">
      Sample
    </Badge>
  ) : (
    <StatusBadge tone="success">Live</StatusBadge>
  );
}

export function DeltaBadge({ delta }: { delta: string }) {
  if (delta === "improved")
    return (
      <Badge variant="outline" className="gap-1 font-normal text-success">
        <ArrowUp /> Improved
      </Badge>
    );
  if (delta === "regressed")
    return (
      <Badge variant="outline" className="gap-1 border-destructive/40 font-normal text-destructive">
        <ArrowDown /> Regressed
      </Badge>
    );
  return (
    <Badge variant="outline" className={cn("gap-1 font-normal text-muted-foreground", delta === "unrated" && "border-dashed")}>
      <Minus /> {delta === "unrated" ? "Unrated" : "Same"}
    </Badge>
  );
}

export function AreaTag({ area, className }: { area: string; className?: string }) {
  return <span className={cn("font-mono text-xs text-muted-foreground", className)}>{area}</span>;
}
