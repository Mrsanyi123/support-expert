"use client";

import { Check, CircleDashed, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { rateResultAction } from "@/app/actions/evaluation";
import { AnswerText } from "@/components/answer";
import { Eyebrow } from "@/components/page";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import type { Rating } from "@/lib/generated/prisma/enums";
import { useStoredName } from "@/lib/use-stored-name";
import { cn } from "@/lib/utils";

const OPTIONS: { rating: Rating; label: string; hint: string; key: string; icon: typeof Check; className: string }[] = [
  {
    rating: "CORRECT",
    label: "Correct",
    hint: "Resolves the ticket; safe to send",
    key: "1",
    icon: Check,
    className: "hover:border-success/60 hover:bg-success/5 [&_[data-icon]]:bg-success/10 [&_[data-icon]]:text-success",
  },
  {
    rating: "INCOMPLETE",
    label: "Incomplete",
    hint: "Right direction, missing a key step",
    key: "2",
    icon: CircleDashed,
    className: "hover:border-warning/60 hover:bg-warning/5 [&_[data-icon]]:bg-warning/15 [&_[data-icon]]:text-warning",
  },
  {
    rating: "WRONG",
    label: "Wrong",
    hint: "Wrong cause or harmful advice",
    key: "3",
    icon: X,
    className: "hover:border-destructive/60 hover:bg-destructive/5 [&_[data-icon]]:bg-destructive/10 [&_[data-icon]]:text-destructive",
  },
];

export function BlindRater(props: {
  resultId: string;
  ticketId: string;
  question: string;
  expected: string;
  answer: string;
  sourceTitles: string[];
  remaining: number;
  rated: number;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [rater, setRater] = useStoredName("");
  const [pending, start] = useTransition();

  function rate(rating: Rating) {
    if (pending) return;
    start(async () => {
      await rateResultAction({ resultId: props.resultId, rating, note, rater: rater ? `${rater} (blind)` : "" });
      router.refresh();
    });
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      const option = OPTIONS.find((o) => o.key === e.key);
      if (option) rate(option.rating);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const total = props.remaining + props.rated;

  return (
    <div className={cn("space-y-6 transition-opacity", pending && "pointer-events-none opacity-60")}>
      <div className="flex items-center gap-4">
        <Progress value={(props.rated / Math.max(total, 1)) * 100} className="flex-1" />
        <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
          {props.rated} / {total} rated
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card size="sm">
          <CardHeader>
            <CardDescription className="flex items-center justify-between">
              Customer question <span className="font-mono text-xs">{props.ticketId}</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{props.question}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Expected resolution</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground">{props.expected}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="ring-2 ring-foreground/15">
        <CardHeader>
          <CardDescription>Answer to rate · version hidden</CardDescription>
        </CardHeader>
        <CardContent>
          <AnswerText text={props.answer} blind className="text-[15px]" />
          {props.sourceTitles.length > 0 && (
            <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">Docs retrieved: {props.sourceTitles.join(" · ")}</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        {OPTIONS.map((o) => (
          <button
            key={o.rating}
            onClick={() => rate(o.rating)}
            className={cn(
              "flex items-start gap-3 rounded-xl border bg-card p-4 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              o.className,
            )}
          >
            <span data-icon className="grid size-8 shrink-0 place-items-center rounded-lg">
              <o.icon className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between text-sm font-medium">
                {o.label}
                <Kbd>{o.key}</Kbd>
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{o.hint}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px]">
        <div>
          <Eyebrow>Note (optional)</Eyebrow>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="What's missing or wrong?" />
        </div>
        <div>
          <Eyebrow>Rater</Eyebrow>
          <Input value={rater} onChange={(e) => setRater(e.target.value)} placeholder="Your name" aria-label="Rater name" />
        </div>
      </div>
    </div>
  );
}
