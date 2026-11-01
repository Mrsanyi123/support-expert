import { ArrowRight, Download, GitCompare, PenLine } from "lucide-react";
import Form from "next/form";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AnswerText, WordDiff } from "@/components/answer";
import { AreaTag, DeltaBadge, RatingBadge, SourceBadge } from "@/components/badges";
import { EmptyState, LoadingRows, PageBody, PageHeader, StatCard } from "@/components/page";
import { RatingBar, RatingCountsText } from "@/components/rating-bar";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { db } from "@/lib/db";
import { buildTrainingRecords } from "@/lib/export/jsonl";
import { compareRuns, loadReviewStats, loadRunsForComparison, pickDefaultPair } from "@/lib/improvements";
import { isOffline } from "@/lib/llm/runner";
import { PROMPTS } from "@/lib/prompt";
import { defaultModelSettings } from "@/lib/seed/demo";
import { cn } from "@/lib/utils";
import { AddVersionForm } from "./add-version-form";

export default function ImprovementsPage(props: PageProps<"/improvements">) {
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Improvements" }]}
        title="Improvements"
        description="What expert reviews have produced, and whether each new version is actually better."
        actions={
          <a href="/api/export/jsonl" className={buttonVariants()} download>
            <Download /> Export JSONL
          </a>
        }
      />
      <PageBody className="space-y-8">
        <Suspense
          fallback={
            <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
          }
        >
          <Kpis />
        </Suspense>

        <Tabs defaultValue="comparison" className="gap-6">
          <TabsList variant="line" className="w-full justify-start overflow-x-auto border-b pb-px">
            <TabsTrigger value="comparison" className="flex-none px-3">
              Comparison
            </TabsTrigger>
            <TabsTrigger value="corrections" className="flex-none px-3">
              Corrections
            </TabsTrigger>
            <TabsTrigger value="versions" className="flex-none px-3">
              Versions
            </TabsTrigger>
            <TabsTrigger value="export" className="flex-none px-3">
              Training data
            </TabsTrigger>
          </TabsList>
          <TabsContent value="comparison">
            <Suspense fallback={<LoadingRows rows={10} />}>
              <Comparison searchParams={props.searchParams} />
            </Suspense>
          </TabsContent>
          <TabsContent value="corrections">
            <Suspense fallback={<LoadingRows rows={6} />}>
              <Corrections />
            </Suspense>
          </TabsContent>
          <TabsContent value="versions">
            <Suspense fallback={<LoadingRows rows={3} />}>
              <Versions />
            </Suspense>
          </TabsContent>
          <TabsContent value="export">
            <Suspense fallback={<LoadingRows rows={3} />}>
              <ExportPreview />
            </Suspense>
          </TabsContent>
        </Tabs>
      </PageBody>
    </>
  );
}

async function Kpis() {
  await connection();
  const stats = await loadReviewStats();
  const maxTotal = Math.max(1, ...stats.weeks.map((w) => w.total));

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <StatCard label="Approved examples" value={stats.approved} hint={`${stats.decided} reviews · ${stats.rejected} rejected`} />
      <StatCard label="Approved without edits" value={`${Math.round(stats.asIsRate * 100)}%`} hint="Share of reviewed drafts" />
      <StatCard label="Avg. draft rewritten" value={`${Math.round(stats.avgEditRatio * 100)}%`} hint="Edit distance ÷ length" />
      <Card className="gap-2 px-4 py-4">
        <div className="text-sm text-muted-foreground">Reviews per week</div>
        <div className="flex h-16 items-end gap-1.5">
          {stats.weeks.map((w) => (
            <div
              key={w.key}
              className="flex h-full flex-1 flex-col items-center justify-end gap-1"
              title={`${w.total} reviews · ${Math.round(w.avgEditRatio * 100)}% rewritten · ${Math.round(w.asIsRate * 100)}% approved as-is`}
            >
              <div className="text-[10px] font-medium tabular-nums">{w.total}</div>
              <div className="w-full rounded-sm bg-chart-1/80" style={{ height: `${4 + (w.total / maxTotal) * 32}px` }} />
              <div className="text-[10px] text-muted-foreground">{w.label}</div>
            </div>
          ))}
          {stats.weeks.length === 0 && <div className="text-xs text-muted-foreground">No reviews yet.</div>}
        </div>
      </Card>
    </div>
  );
}

async function Comparison({ searchParams }: Pick<PageProps<"/improvements">, "searchParams">) {
  await connection();
  const sp = await searchParams;
  const runs = await loadRunsForComparison();
  if (runs.length < 2) {
    return (
      <EmptyState
        icon={GitCompare}
        title="Need two evaluation runs"
        action={
          <Link href="/evaluation" className={buttonVariants({ variant: "outline" })}>
            Go to evaluation
          </Link>
        }
      >
        Run two versions on the same locked set to compare them case by case.
      </EmptyState>
    );
  }

  const { base, cand } = pickDefaultPair(runs, typeof sp.base === "string" ? sp.base : undefined, typeof sp.cand === "string" ? sp.cand : undefined);
  if (!base || !cand) return null;
  const cmp = compareRuns(base, cand);
  const delta = cmp.candCounts.CORRECT - cmp.baseCounts.CORRECT;
  const runItems = runs.map((r) => ({
    value: r.id,
    label: `${r.agentConfig.name} · ${r.createdAt.toLocaleDateString()}`,
  }));

  return (
    <div className="space-y-6">
      <Form action="/improvements" className="flex flex-wrap items-center gap-2">
        <RunSelect name="base" items={runItems} defaultValue={base.id} label="Baseline run" />
        <ArrowRight className="size-4 text-muted-foreground" />
        <RunSelect name="cand" items={runItems} defaultValue={cand.id} label="Candidate run" />
        <Button type="submit" variant="outline">
          Compare
        </Button>
      </Form>

      {!cmp.sameSet && (
        <Alert>
          <AlertDescription>These runs use different evaluation sets, so the scores aren&apos;t directly comparable.</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <RunSummary title="Baseline" run={base} counts={cmp.baseCounts} />
        <RunSummary title="Candidate" run={cand} counts={cmp.candCounts} highlight />
        <Card className="gap-1 px-4 py-4">
          <div className="text-sm text-muted-foreground">Change</div>
          <div className={cn("text-3xl font-semibold tracking-tight tabular-nums", delta > 0 && "text-success", delta < 0 && "text-destructive")}>
            {delta > 0 ? "+" : ""}
            {delta} correct
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <span>
              <span className="font-medium text-success tabular-nums">{cmp.improved}</span> <span className="text-muted-foreground">improved</span>
            </span>
            <span>
              <span className={cn("font-medium tabular-nums", cmp.regressed && "text-destructive")}>{cmp.regressed}</span>{" "}
              <span className="text-muted-foreground">regressed</span>
            </span>
            <span>
              <span className="font-medium tabular-nums">{cmp.unchanged}</span> <span className="text-muted-foreground">same</span>
            </span>
          </div>
        </Card>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Same {base.evalSet.name} cases, rated blind. Regressions are listed first.
        </p>
        <Card className="py-0">
          <Accordion multiple>
            {cmp.rows.map((row) => (
              <AccordionItem key={row.caseId} value={row.caseId}>
                <AccordionTrigger className="items-center gap-3 rounded-none px-4 py-3 hover:bg-muted/40 hover:no-underline">
                  <span className="w-14 shrink-0 font-mono text-xs font-normal text-muted-foreground">{row.ticketId}</span>
                  <span className="line-clamp-1 flex-1 font-normal">{row.question}</span>
                  <span className="hidden items-center gap-1.5 md:flex">
                    <RatingBadge rating={row.base?.rating} />
                    <ArrowRight className="size-3.5 text-muted-foreground" />
                    <RatingBadge rating={row.cand?.rating} />
                  </span>
                  <span className="w-24 shrink-0">
                    <DeltaBadge delta={row.delta} />
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 border-t bg-muted/20 px-4 pt-4 pb-5">
                  <div className="flex items-center gap-3 text-sm">
                    <AreaTag area={row.productArea} />
                    <Link href={`/review/${row.caseId}`} className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                      Open case
                    </Link>
                  </div>
                  <p className="text-sm font-medium">{row.question}</p>
                  <div className="grid gap-3 lg:grid-cols-3">
                    <AnswerColumn title={base.agentConfig.name} data={row.base} />
                    <AnswerColumn title={cand.agentConfig.name} data={row.cand} />
                    <Card size="sm">
                      <CardHeader>
                        <CardDescription>Expected resolution</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm leading-relaxed text-muted-foreground">{row.expected}</p>
                      </CardContent>
                    </Card>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Card>
      </div>
    </div>
  );
}

function RunSelect({
  name,
  items,
  defaultValue,
  label,
}: {
  name: string;
  items: { value: string; label: string }[];
  defaultValue: string;
  label: string;
}) {
  return (
    <Select name={name} items={items} defaultValue={defaultValue}>
      <SelectTrigger className="w-full sm:w-80" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((i) => (
          <SelectItem key={i.value} value={i.value}>
            {i.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function RunSummary({
  title,
  run,
  counts,
  highlight,
}: {
  title: string;
  run: Awaited<ReturnType<typeof loadRunsForComparison>>[number];
  counts: ReturnType<typeof compareRuns>["baseCounts"];
  highlight?: boolean;
}) {
  return (
    <Card className={cn("gap-3 px-4 py-4", highlight && "ring-2 ring-foreground/20")}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">{title}</div>
        <SourceBadge source={run.source} />
      </div>
      <div>
        <div className="truncate font-medium">{run.agentConfig.name}</div>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="text-3xl font-semibold tracking-tight tabular-nums">{counts.CORRECT}</span>
          <span className="text-muted-foreground tabular-nums">/ {counts.total} correct</span>
        </div>
      </div>
      <RatingBar counts={counts} />
      <RatingCountsText counts={counts} />
      <Link href={`/evaluation/${run.id}`} className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
        View all cases in this run
      </Link>
    </Card>
  );
}

function AnswerColumn({ title, data }: { title: string; data: { rating: string | null; answer: string; note: string | null } | null }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription className="truncate">{title}</CardDescription>
        <CardAction>
          <RatingBadge rating={data?.rating as "CORRECT" | "INCOMPLETE" | "WRONG" | null} />
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-2">
        {data ? <AnswerText text={data.answer} /> : <p className="text-sm text-muted-foreground">Not in this run.</p>}
        {data?.note && <p className="rounded-md bg-muted px-2 py-1.5 text-xs text-muted-foreground">Rater: {data.note}</p>}
      </CardContent>
    </Card>
  );
}

async function Corrections() {
  await connection();
  const reviews = await db.review.findMany({
    where: { status: "EDITED_APPROVED", case: { split: "TRAIN" } },
    orderBy: { reviewedAt: "desc" },
    take: 20,
    include: { case: { select: { id: true, ticketId: true, customerQuestion: true, productArea: true } }, agentConfig: { select: { name: true } } },
  });

  if (reviews.length === 0) {
    return (
      <EmptyState icon={PenLine} title="No edited approvals yet">
        Edit a draft on the Review screen before approving it, and the diff shows up here.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Where experts changed the AI draft before approving: the knowledge the docs were missing.</p>
      <div className="grid gap-4 lg:grid-cols-2">
        {reviews.map((r) => (
          <Card key={r.id}>
            <CardHeader>
              <CardTitle className="line-clamp-2 text-sm">{r.case.customerQuestion}</CardTitle>
              <CardDescription className="flex flex-wrap items-center gap-x-2 text-xs">
                <Link href={`/review/${r.case.id}`} className="font-mono hover:text-foreground hover:underline">
                  {r.case.ticketId}
                </Link>
                <AreaTag area={r.case.productArea} />
                <span>
                  · {r.reviewer} · {r.reviewedAt?.toLocaleDateString()}
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WordDiff before={r.aiDraft} after={r.finalAnswer ?? ""} className="text-[13px]" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

async function Versions() {
  await connection();
  const configs = await db.agentConfig.findMany({
    orderBy: { key: "asc" },
    include: { _count: { select: { reviews: true, evalRuns: true } } },
  });

  return (
    <Card className="pb-0">
      <CardHeader>
        <CardTitle>Versions</CardTitle>
        <CardDescription>A model endpoint plus a prompt and retrieval strategy. Any OpenAI-compatible server works, including vLLM.</CardDescription>
        <CardAction>
          <AddVersionForm promptVersions={Object.keys(PROMPTS)} defaults={defaultModelSettings()} />
        </CardAction>
      </CardHeader>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-4">Version</TableHead>
            <TableHead>Model</TableHead>
            <TableHead className="hidden md:table-cell">Prompt</TableHead>
            <TableHead className="hidden md:table-cell">Examples</TableHead>
            <TableHead className="pr-4 text-right">Usage</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {configs.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="max-w-72 pl-4 whitespace-normal">
                <div className="font-medium">{c.name}</div>
                {c.description && <div className="line-clamp-2 text-xs text-muted-foreground">{c.description}</div>}
              </TableCell>
              <TableCell className="font-mono text-xs">
                <div>{c.model}</div>
                <div className="text-muted-foreground">{c.baseUrl}</div>
                {isOffline(c) && (
                  <Badge variant="outline" className="mt-1 font-sans font-normal text-muted-foreground">
                    {c.apiKeyEnv} not set · offline
                  </Badge>
                )}
              </TableCell>
              <TableCell className="hidden font-mono text-xs md:table-cell">
                {c.promptVersion} · t={c.temperature}
              </TableCell>
              <TableCell className="hidden text-xs md:table-cell">{c.useExamples ? `Up to ${c.maxExamples}` : "None"}</TableCell>
              <TableCell className="pr-4 text-right text-xs text-muted-foreground">
                {c._count.reviews} drafts · {c._count.evalRuns} runs
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

async function ExportPreview() {
  await connection();
  const records = await buildTrainingRecords();
  const sample = records[records.length - 1];
  const preview = sample
    ? JSON.stringify(
        {
          messages: sample.messages.map((m) => ({ role: m.role, content: m.content.length > 260 ? `${m.content.slice(0, 260)}...` : m.content })),
          metadata: sample.metadata,
        },
        null,
        2,
      )
    : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Card className="gap-0 pb-0">
        <CardHeader className="border-b pb-4">
          <CardTitle>Training dataset</CardTitle>
          <CardDescription>Only approved reviews of train cases. Held-out cases and rejected drafts never leave the system.</CardDescription>
          <CardAction>
            <a href="/api/export/jsonl" className={buttonVariants({ variant: "outline" })} download>
              <Download /> {records.length} examples
            </a>
          </CardAction>
        </CardHeader>
        <pre className="max-h-96 overflow-auto bg-muted/40 p-4 font-mono text-xs leading-relaxed">{preview ?? "No approved examples yet."}</pre>
      </Card>
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Next: fine-tune and re-test</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 text-sm">
            {[
              <>
                Chat-style <code className="font-mono text-xs">messages</code>, ready for TRL&apos;s <code className="font-mono text-xs">SFTTrainer</code>.
              </>,
              <>
                Train a LoRA adapter with <code className="font-mono text-xs">ml/finetune.py</code> on the same base model.
              </>,
              <>Serve it with vLLM and add it as a new version.</>,
              <>Run it on the locked evaluation set and compare it here.</>,
            ].map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="grid size-5 shrink-0 place-items-center rounded-full border text-[11px] font-medium text-muted-foreground">
                  {i + 1}
                </span>
                <span className="text-muted-foreground">{step}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
