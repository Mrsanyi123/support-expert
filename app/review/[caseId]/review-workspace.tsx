"use client";

import { AlertTriangle, ArrowRight, Check, CheckCircle2, FileText, Loader2, RotateCcw, Sparkles, X, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { generateDraftAction, submitReviewAction, type DraftDTO } from "@/app/actions/review";
import { AnswerText, ExamplesList, SourcesList, WordDiff } from "@/components/answer";
import { AreaTag, ReviewStatusBadge } from "@/components/badges";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useStoredName } from "@/lib/use-stored-name";

export type ConfigOption = { id: string; name: string; description: string | null; useExamples: boolean; model: string };

export type LastDecision = {
  status: string;
  aiDraft: string;
  finalAnswer: string | null;
  reviewer: string | null;
  reviewedAt: string | null;
  rejectReason: string | null;
  editDistance: number | null;
  configName: string;
};

type Props = {
  caseData: { id: string; ticketId: string; question: string; resolution: string; productArea: string };
  configs: ConfigOption[];
  defaultConfigId: string;
  initialDraft: DraftDTO | null;
  lastDecision: LastDecision | null;
  nextCaseId: string | null;
  defaultReviewer: string;
};

export function ReviewWorkspace({ caseData, configs, defaultConfigId, initialDraft, lastDecision, nextCaseId, defaultReviewer }: Props) {
  const router = useRouter();
  const [configId, setConfigId] = useState(defaultConfigId);
  const [draft, setDraft] = useState<DraftDTO | null>(initialDraft);
  const [text, setText] = useState(initialDraft?.aiDraft ?? "");
  const [mode, setMode] = useState<"edit" | "diff">("edit");
  const [reviewer, setReviewer] = useStoredName(defaultReviewer);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ status: string; editDistance: number | null; exampleCount: number } | null>(null);
  const [generating, startGenerate] = useTransition();
  const [submitting, startSubmit] = useTransition();

  const edited = draft ? text.trim() !== draft.aiDraft.trim() : false;
  const showDecision = !draft && !done && lastDecision;
  const selected = configs.find((c) => c.id === configId);

  function generate() {
    setError(null);
    setDone(null);
    startGenerate(async () => {
      const r = await generateDraftAction(caseData.id, configId);
      if (!r.ok) return setError(r.error);
      setDraft(r.draft);
      setText(r.draft.aiDraft);
      setMode("edit");
      router.refresh();
    });
  }

  function submit(decision: "approve" | "reject") {
    if (!draft) return;
    setError(null);
    startSubmit(async () => {
      const r = await submitReviewAction({ reviewId: draft.id, decision, finalAnswer: text, rejectReason, reviewer });
      if (!r.ok) return setError(r.error);
      setRejectOpen(false);
      setDone(r);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-6 px-4 py-6 md:px-8 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-6">
        {/* Ticket */}
        <Card>
          <CardHeader>
            <CardDescription>Customer question</CardDescription>
            <CardAction>
              <AreaTag area={caseData.productArea} />
            </CardAction>
          </CardHeader>
          <CardContent>
            <p className="text-[15px] leading-relaxed">{caseData.question}</p>
          </CardContent>
        </Card>

        {/* Draft */}
        <Card className={draft && !done ? "pb-0" : undefined}>
          <CardHeader className="border-b">
            <CardTitle>Reply</CardTitle>
            <CardDescription>
              {draft
                ? [draft.configName, draft.modelName, draft.latencyMs != null && `${(draft.latencyMs / 1000).toFixed(1)}s`].filter(Boolean).join(" · ")
                : "The model sees the ticket and retrieved docs, never the historical resolution."}
            </CardDescription>
            <CardAction className="flex items-center gap-2">
              <Select items={configs.map((c) => ({ value: c.id, label: c.name }))} value={configId} onValueChange={(v) => setConfigId(v as string)}>
                <SelectTrigger className="hidden w-48 sm:flex" aria-label="Version">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {configs.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={generate} disabled={generating} variant={draft || lastDecision ? "outline" : "default"}>
                {generating ? <Loader2 className="animate-spin" /> : <Sparkles />}
                {generating ? "Drafting..." : draft || lastDecision ? "Regenerate" : "Generate draft"}
              </Button>
            </CardAction>
          </CardHeader>

          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertTriangle />
                <AlertTitle>Something went wrong</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {draft?.offline && !done && (
              <Alert>
                <AlertTriangle className="text-warning!" />
                <AlertTitle>Offline stub</AlertTitle>
                <AlertDescription>
                  No <code className="font-mono text-xs">LLM_API_KEY</code> is set, so this draft is extractive, not from a language model.
                </AlertDescription>
              </Alert>
            )}

            {!draft && !lastDecision && !generating && (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <div className="grid size-10 place-items-center rounded-lg bg-muted">
                  <Sparkles className="size-5 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium">No draft yet</div>
                  <p className="max-w-sm text-sm text-muted-foreground">
                    Pick a version and generate a draft.{" "}
                    {selected?.useExamples ? "This version also learns from approved expert examples." : "This version uses docs only."}
                  </p>
                </div>
              </div>
            )}

            {generating && !draft && (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Retrieving docs and drafting a reply...
              </div>
            )}

            {showDecision && <DecisionSummary decision={lastDecision} />}

            {draft && !done && (
              <Tabs value={mode} onValueChange={(v) => setMode(v as "edit" | "diff")} className="gap-3">
                <div className="flex items-center gap-3">
                  <TabsList>
                    <TabsTrigger value="edit">Edit</TabsTrigger>
                    <TabsTrigger value="diff">Changes</TabsTrigger>
                  </TabsList>
                  {edited ? (
                    <Badge variant="secondary" className="font-normal">
                      Edited
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">Unchanged AI draft</span>
                  )}
                  {edited && (
                    <Button variant="ghost" size="sm" className="ml-auto text-muted-foreground" onClick={() => setText(draft.aiDraft)}>
                      <RotateCcw /> Revert
                    </Button>
                  )}
                </div>
                <TabsContent value="edit">
                  <Textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={Math.min(20, Math.max(10, Math.ceil(text.length / 75)))}
                    className="resize-y text-sm leading-relaxed"
                    aria-label="Reply text"
                  />
                </TabsContent>
                <TabsContent value="diff">
                  <div className="min-h-40 rounded-lg border bg-muted/30 p-3">
                    {edited ? <WordDiff before={draft.aiDraft} after={text} /> : <p className="text-sm text-muted-foreground">No changes yet.</p>}
                  </div>
                </TabsContent>
              </Tabs>
            )}

            {done && (
              <Alert>
                {done.status === "REJECTED" ? <XCircle className="text-destructive!" /> : <CheckCircle2 className="text-success!" />}
                <AlertTitle className="flex items-center gap-2">
                  {done.status === "REJECTED" ? "Draft rejected" : "Saved as an example"}
                  {done.editDistance != null && done.editDistance > 0 && (
                    <span className="text-xs font-normal text-muted-foreground">{done.editDistance} characters changed</span>
                  )}
                </AlertTitle>
                <AlertDescription>
                  {done.status === "REJECTED"
                    ? "Stored with your reason. It won't be used as an example or exported."
                    : `${done.exampleCount} approved examples now feed version B and the training export.`}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {nextCaseId && (
                      <Link href={`/review/${nextCaseId}`} className={buttonVariants({ size: "sm" })}>
                        Next case <ArrowRight />
                      </Link>
                    )}
                    <Link href="/review" className={buttonVariants({ variant: "outline", size: "sm" })}>
                      Back to queue
                    </Link>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>

          {draft && !done && (
            <CardFooter className="flex-wrap gap-2">
              <Input
                value={reviewer}
                onChange={(e) => setReviewer(e.target.value)}
                placeholder="Your name"
                className="w-full bg-background sm:w-48"
                aria-label="Reviewer name"
              />
              <div className="flex w-full gap-2 sm:ml-auto sm:w-auto">
                <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => setRejectOpen(true)} disabled={submitting}>
                  <X /> Reject
                </Button>
                <Button className="flex-1 sm:flex-none" onClick={() => submit("approve")} disabled={submitting || text.trim().length < 10}>
                  {submitting ? <Loader2 className="animate-spin" /> : <Check />}
                  {edited ? "Approve with edits" : "Approve"}
                </Button>
              </div>
            </CardFooter>
          )}
        </Card>
      </div>

      {/* Context rail */}
      <Card className="h-fit gap-3 xl:sticky xl:top-16">
        <Tabs defaultValue="reference" className="gap-4">
          <CardHeader>
            <TabsList className="w-full">
              <TabsTrigger value="reference">Reference</TabsTrigger>
              <TabsTrigger value="sources">
                Sources{draft ? <span className="text-muted-foreground tabular-nums">{draft.sourceRefs.length}</span> : null}
              </TabsTrigger>
              <TabsTrigger value="examples">
                Examples{draft ? <span className="text-muted-foreground tabular-nums">{draft.examples.length}</span> : null}
              </TabsTrigger>
            </TabsList>
          </CardHeader>
          <CardContent>
            <TabsContent value="reference" className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <FileText className="size-3.5" /> Historical expert resolution
              </div>
              <p className="text-sm leading-relaxed">{caseData.resolution}</p>
              <p className="pt-1 text-xs text-muted-foreground">For your reference only. The model never sees this.</p>
            </TabsContent>
            <TabsContent value="sources">
              {draft ? (
                <SourcesList sources={draft.sourceRefs} />
              ) : (
                <p className="text-sm text-muted-foreground">Retrieved documentation appears here after drafting.</p>
              )}
            </TabsContent>
            <TabsContent value="examples">
              {draft && draft.examples.length > 0 ? (
                <ExamplesList examples={draft.examples} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {draft ? "This version didn't use any expert examples." : "Expert examples used by the draft appear here."}
                </p>
              )}
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>

      <Dialog open={rejectOpen} onOpenChange={(o) => !submitting && setRejectOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject this draft?</DialogTitle>
            <DialogDescription>Rejected drafts are kept for analysis but never used as examples or exported.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
            autoFocus
            placeholder="What's wrong? e.g. wrong root cause, hallucinated setting, unsafe advice"
            aria-label="Reason for rejecting"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={submitting} onClick={() => submit("reject")}>
              {submitting && <Loader2 className="animate-spin" />}
              Reject draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DecisionSummary({ decision }: { decision: LastDecision }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <ReviewStatusBadge status={decision.status} />
        <span>
          by {decision.reviewer ?? "unknown"}
          {decision.reviewedAt && ` on ${new Date(decision.reviewedAt).toLocaleDateString()}`} · drafted by {decision.configName}
        </span>
      </div>
      {decision.status === "REJECTED" ? (
        <>
          <AnswerText text={decision.aiDraft} className="text-muted-foreground line-through decoration-destructive/40" />
          {decision.rejectReason && (
            <Alert variant="destructive">
              <XCircle />
              <AlertTitle>Reason</AlertTitle>
              <AlertDescription>{decision.rejectReason}</AlertDescription>
            </Alert>
          )}
        </>
      ) : decision.finalAnswer && decision.finalAnswer !== decision.aiDraft ? (
        <div className="rounded-lg border bg-muted/30 p-3">
          <div className="mb-2 text-xs text-muted-foreground">AI draft → expert&apos;s final answer</div>
          <WordDiff before={decision.aiDraft} after={decision.finalAnswer} />
        </div>
      ) : (
        <AnswerText text={decision.finalAnswer ?? decision.aiDraft} />
      )}
    </div>
  );
}
