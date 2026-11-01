import { ArrowRight, Check, ClipboardCheck, Database, FlaskConical, Inbox, TrendingUp } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AreaTag, ReviewStatusBadge } from "@/components/badges";
import { ImportPanel } from "@/app/cases/import-panel";
import { LoadDemoButton } from "@/components/load-demo-button";
import { EmptyState, PageBody, PageHeader, StatCard } from "@/components/page";
import { RatingBar, RatingCountsText } from "@/components/rating-bar";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/lib/db";
import { compareRuns, loadRunsForComparison, pickDefaultPair } from "@/lib/improvements";
import { countRatings, type RatingCounts } from "@/lib/metrics";
import { approvedExampleCount } from "@/lib/queries";
import { cn } from "@/lib/utils";

export default function OverviewPage() {
  return (
    <Suspense fallback={<OverviewSkeleton />}>
      <Overview />
    </Suspense>
  );
}

function OverviewSkeleton() {
  return (
    <>
      <PageHeader crumbs={[{ label: "Overview" }]} title="Overview" />
      <PageBody className="space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          <Skeleton className="h-72 rounded-xl xl:col-span-2" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </PageBody>
    </>
  );
}

async function Overview() {
  await connection();
  const [cases, openCount, nextCase, examples, runs, recent, demoTicket, demoEval] = await Promise.all([
    db.case.groupBy({ by: ["split"], _count: true }),
    db.case.count({ where: { split: "TRAIN", status: { in: ["NEW", "DRAFTED"] } } }),
    db.case.findFirst({
      where: { split: "TRAIN", status: { in: ["NEW", "DRAFTED"] } },
      orderBy: [{ status: "desc" }, { ticketId: "asc" }],
      select: { id: true },
    }),
    approvedExampleCount(),
    loadRunsForComparison(),
    db.review.findMany({
      where: { status: { not: "PENDING" } },
      orderBy: { reviewedAt: "desc" },
      take: 6,
      include: { case: { select: { id: true, ticketId: true, customerQuestion: true, productArea: true } } },
    }),
    db.case.findUnique({ where: { ticketId: "T-1018" }, select: { id: true } }),
    db.case.findUnique({ where: { ticketId: "T-1067" }, select: { id: true } }),
  ]);

  const train = cases.find((c) => c.split === "TRAIN")?._count ?? 0;
  const held = cases.find((c) => c.split === "EVAL")?._count ?? 0;
  const { base, cand } = pickDefaultPair(runs);
  const cmp = base && cand ? compareRuns(base, cand) : null;
  const latestRun = cand ?? runs[0];
  const latest = latestRun ? countRatings(latestRun.results) : null;

  const header = (
    <PageHeader
      crumbs={[{ label: "Overview" }]}
      title="Overview"
      description="How expert reviews are improving your support AI."
      actions={
        nextCase && (
          <Link href={`/review/${nextCase.id}`} className={buttonVariants()}>
            Continue reviewing <ArrowRight />
          </Link>
        )
      }
    />
  );

  if (train + held === 0) {
    return (
      <>
        {header}
        <PageBody>
          <EmptyState
            icon={Inbox}
            title="Start with some resolved tickets"
            action={
              <>
                <LoadDemoButton variant="default" />
                <ImportPanel variant="outline" />
              </>
            }
          >
            Import a CSV of resolved support tickets, or load the Relay demo dataset to see the whole loop in action.
          </EmptyState>
        </PageBody>
      </>
    );
  }

  const delta = cmp ? cmp.candCounts.CORRECT - cmp.baseCounts.CORRECT : 0;
  const steps = [
    { label: "Import resolved tickets", done: train + held > 0, href: "/cases" },
    { label: "Review and correct AI drafts", done: examples > 0, href: nextCase ? `/review/${nextCase.id}` : "/review" },
    { label: "Run a version on held-out tickets", done: runs.length > 0, href: "/evaluation" },
    { label: "Compare versions and export", done: runs.length > 1, href: "/improvements" },
  ];

  return (
    <>
      {header}
      <PageBody className="space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <StatCard label="Cases" icon={Inbox} value={train + held} hint={`${train} train · ${held} held out`} href="/cases" />
          <StatCard
            label="Awaiting review"
            icon={ClipboardCheck}
            value={openCount}
            hint={openCount ? "Train tickets without a decision" : "Queue is clear"}
            href="/review"
          />
          <StatCard label="Approved examples" icon={Database} value={examples} hint="Ready to export for fine-tuning" href="/improvements" />
          <StatCard
            label="Held-out accuracy"
            icon={FlaskConical}
            value={latest ? `${pct(latest.CORRECT, latest.total)}%` : "–"}
            hint={
              cmp ? (
                <span className={cn(delta > 0 && "text-success", delta < 0 && "text-destructive")}>
                  {delta > 0 ? "+" : ""}
                  {delta} correct vs. {base?.agentConfig.name}
                </span>
              ) : (
                "Run a version to measure"
              )
            }
            href="/evaluation"
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>Results on unseen tickets</CardTitle>
              <CardDescription>
                {cmp && base && cand
                  ? `Both versions answered the same ${cmp.candCounts.total} held-out tickets, rated blind.`
                  : "Run versions on the locked evaluation set to compare them here."}
              </CardDescription>
              {cmp && (
                <CardAction>
                  <Link href="/improvements" className={buttonVariants({ variant: "outline", size: "sm" })}>
                    Compare cases
                  </Link>
                </CardAction>
              )}
            </CardHeader>
            <CardContent>
              {cmp && base && cand ? (
                <div className="space-y-6">
                  <div className="space-y-4">
                    <RunResult label={base.agentConfig.name} counts={cmp.baseCounts} />
                    <RunResult label={cand.agentConfig.name} counts={cmp.candCounts} highlight />
                  </div>
                  <div className="grid grid-cols-3 divide-x rounded-lg border">
                    <Delta value={cmp.improved} label="Improved" className="text-success" />
                    <Delta value={cmp.regressed} label="Regressed" className={cmp.regressed ? "text-destructive" : undefined} />
                    <Delta value={cmp.unchanged} label="Unchanged" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Same model and prompt. The difference is {cand.examplePoolSize} approved expert corrections, retrieved as examples.
                  </p>
                </div>
              ) : (
                <EmptyState
                  icon={TrendingUp}
                  title="No comparison yet"
                  className="py-8"
                  action={
                    <Link href="/evaluation" className={buttonVariants({ variant: "outline" })}>
                      Go to evaluation
                    </Link>
                  }
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>The improvement loop</CardTitle>
              <CardDescription>
                {steps.filter((s) => s.done).length} of {steps.length} steps done
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              {steps.map((s, i) => (
                <Link
                  key={s.label}
                  href={s.href}
                  className="group/step -mx-2 flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-muted"
                >
                  <span
                    className={cn(
                      "grid size-6 shrink-0 place-items-center rounded-full border text-xs font-medium",
                      s.done ? "border-transparent bg-primary text-primary-foreground" : "text-muted-foreground",
                    )}
                  >
                    {s.done ? <Check className="size-3.5" /> : i + 1}
                  </span>
                  <span className={cn("flex-1", s.done && "text-muted-foreground")}>{s.label}</span>
                  <ArrowRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover/step:opacity-100" />
                </Link>
              ))}
              {demoTicket && demoEval && (
                <p className="mt-3 rounded-lg bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
                  <span className="font-medium text-foreground">Demo tip:</span> held-out{" "}
                  <Link href={`/review/${demoEval.id}`} className="font-mono text-foreground underline-offset-2 hover:underline">
                    T-1067
                  </Link>{" "}
                  is wrong for both versions. Correct{" "}
                  <Link href={`/review/${demoTicket.id}`} className="font-mono text-foreground underline-offset-2 hover:underline">
                    T-1018
                  </Link>
                  , re-run version B, and watch it flip.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="pb-0">
          <CardHeader>
            <CardTitle>Recent decisions</CardTitle>
            <CardDescription>Expert reviews that become examples and training data.</CardDescription>
            <CardAction>
              <Link href="/review" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                View queue <ArrowRight />
              </Link>
            </CardAction>
          </CardHeader>
          {recent.length === 0 ? (
            <CardContent className="pb-6 text-sm text-muted-foreground">No decisions yet.</CardContent>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-24 pl-4">Ticket</TableHead>
                  <TableHead>Question</TableHead>
                  <TableHead className="hidden w-40 md:table-cell">Area</TableHead>
                  <TableHead className="w-40">Decision</TableHead>
                  <TableHead className="hidden w-28 pr-4 text-right sm:table-cell">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map((r) => (
                  <TableRow key={r.id} className="relative">
                    <TableCell className="pl-4 font-mono text-xs text-muted-foreground">{r.case.ticketId}</TableCell>
                    <TableCell className="max-w-0 truncate">
                      <Link href={`/review/${r.case.id}`} className="after:absolute after:inset-0">
                        {r.case.customerQuestion}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <AreaTag area={r.case.productArea} />
                    </TableCell>
                    <TableCell>
                      <ReviewStatusBadge status={r.status} />
                    </TableCell>
                    <TableCell className="hidden pr-4 text-right text-xs text-muted-foreground sm:table-cell">
                      {r.reviewedAt?.toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </PageBody>
    </>
  );
}

const pct = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);

function RunResult({ label, counts, highlight }: { label: string; counts: RatingCounts; highlight?: boolean }) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className={cn("truncate text-sm", highlight ? "font-medium" : "text-muted-foreground")}>{label}</span>
        <span className="shrink-0 text-sm tabular-nums">
          <span className="font-semibold">{pct(counts.CORRECT, counts.total)}%</span>
          <span className="text-muted-foreground">
            {" "}
            · {counts.CORRECT}/{counts.total}
          </span>
        </span>
      </div>
      <RatingBar counts={counts} className={highlight ? "h-2.5" : "h-2.5 opacity-70"} />
      {highlight && <RatingCountsText counts={counts} />}
    </div>
  );
}

function Delta({ value, label, className }: { value: number; label: string; className?: string }) {
  return (
    <div className="px-4 py-3">
      <div className={cn("text-xl font-semibold tabular-nums", className)}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
