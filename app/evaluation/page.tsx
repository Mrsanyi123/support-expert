import { AlertTriangle, ArrowRight, EyeOff, FlaskConical, Lock } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { SourceBadge } from "@/components/badges";
import { EmptyState, LoadingRows, PageBody, PageHeader } from "@/components/page";
import { RatingBar, RatingCountsText } from "@/components/rating-bar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/lib/db";
import { findDocLeakage } from "@/lib/guards";
import { isOffline } from "@/lib/llm/runner";
import { countRatings } from "@/lib/metrics";
import { CreateEvalSetButton, LockEvalSetButton, RunVersionForm } from "./eval-controls";

export const maxDuration = 300;

export default function EvaluationPage() {
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Evaluation" }]}
        title="Evaluation"
        description="Test each version on held-out tickets it has never seen, then rate the answers blind."
      />
      <PageBody>
        <Suspense fallback={<LoadingRows rows={8} />}>
          <EvalSets />
        </Suspense>
      </PageBody>
    </>
  );
}

async function EvalSets() {
  await connection();
  const [sets, configs, evalCaseCount] = await Promise.all([
    db.evalSet.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        cases: { include: { case: { select: { ticketId: true, expertResolution: true } } } },
        runs: {
          orderBy: { createdAt: "desc" },
          include: { agentConfig: true, results: { select: { rating: true, error: true } } },
        },
      },
    }),
    db.agentConfig.findMany({ orderBy: { key: "asc" } }),
    db.case.count({ where: { split: "EVAL" } }),
  ]);

  if (sets.length === 0) {
    return (
      <EmptyState icon={FlaskConical} title="No evaluation set yet" action={<CreateEvalSetButton evalCaseCount={evalCaseCount} />}>
        Freeze your held-out cases into a set so every version is tested on exactly the same tickets.
      </EmptyState>
    );
  }

  const chunks = await db.chunk.findMany({ select: { text: true, document: { select: { title: true } } } });

  return (
    <div className="space-y-6">
      {sets.map((set) => {
        const warnings = findDocLeakage(
          set.cases.map((c) => c.case),
          chunks.map((c) => ({ documentTitle: c.document.title, text: c.text })),
        );
        const unrated = set.runs.reduce((n, r) => n + r.results.filter((x) => !x.rating && !x.error).length, 0);

        return (
          <Card key={set.id} className="pb-0">
            <CardHeader className="border-b">
              <CardTitle className="flex flex-wrap items-center gap-2">
                {set.name}
                {set.lockedAt ? (
                  <Badge variant="secondary" className="gap-1 font-normal">
                    <Lock /> Locked {set.lockedAt.toLocaleDateString()}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-dashed font-normal text-muted-foreground">
                    Not locked
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>{set.cases.length} held-out cases, never drafted, used as examples, or exported.</CardDescription>
              <CardAction className="flex gap-2">
                {unrated > 0 && (
                  <Link href={`/evaluation/rate?set=${set.id}`} className={buttonVariants({ variant: "outline" })}>
                    <EyeOff /> Rate blind
                    <Badge variant="secondary" className="ml-0.5 h-4.5 px-1.5 tabular-nums">
                      {unrated}
                    </Badge>
                  </Link>
                )}
                {!set.lockedAt && <LockEvalSetButton evalSetId={set.id} hasWarnings={warnings.length > 0} />}
              </CardAction>
            </CardHeader>

            {(warnings.length > 0 || set.lockedAt) && (
              <CardContent className="space-y-4">
                {warnings.length > 0 && (
                  <Alert>
                    <AlertTriangle className="text-warning!" />
                    <AlertTitle>Possible leakage through docs</AlertTitle>
                    <AlertDescription>
                      Expected answers for{" "}
                      {warnings.map((w) => `${w.ticketId} (${Math.round(w.overlap * 100)}% in "${w.documentTitle}")`).join(", ")} appear in
                      indexed documentation. Retrieval could hand the model the answer.
                    </AlertDescription>
                  </Alert>
                )}
                {set.lockedAt && (
                  <RunVersionForm
                    evalSetId={set.id}
                    caseCount={set.cases.length}
                    configs={configs.map((c) => ({ id: c.id, name: c.name }))}
                    offline={configs.some((c) => isOffline(c))}
                  />
                )}
              </CardContent>
            )}

            {set.runs.length === 0 ? (
              <div className="border-t px-4 py-10 text-center text-sm text-muted-foreground">
                No runs yet. {set.lockedAt ? "Pick a version above and run it." : "Lock the set to start running versions."}
              </div>
            ) : (
              <Table className="border-t">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-4">Version</TableHead>
                    <TableHead className="hidden lg:table-cell">Run</TableHead>
                    <TableHead className="w-[32%]">Results</TableHead>
                    <TableHead className="w-24 pr-4 text-right">Correct</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {set.runs.map((run) => {
                    const counts = countRatings(run.results);
                    const failed = run.results.filter((r) => r.error).length;
                    return (
                      <TableRow key={run.id} className="relative">
                        <TableCell className="pl-4">
                          <Link href={`/evaluation/${run.id}`} className="font-medium after:absolute after:inset-0">
                            {run.agentConfig.name}
                          </Link>
                          <div className="font-mono text-xs text-muted-foreground">
                            {run.agentConfig.model.split("/").pop()} ·{" "}
                            {run.agentConfig.useExamples ? `${run.examplePoolSize} examples` : "no examples"}
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="flex items-center gap-2">
                            <SourceBadge source={run.source} />
                            <span className="text-xs text-muted-foreground">{run.createdAt.toLocaleString()}</span>
                          </div>
                          {failed > 0 && <div className="mt-1 text-xs text-destructive">{failed} cases failed to generate</div>}
                        </TableCell>
                        <TableCell className="space-y-1.5">
                          <RatingBar counts={counts} />
                          <RatingCountsText counts={counts} />
                        </TableCell>
                        <TableCell className="pr-4 text-right">
                          <span className="text-base font-semibold tabular-nums">{counts.CORRECT}</span>
                          <span className="text-muted-foreground tabular-nums">/{counts.total}</span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Card>
        );
      })}

      {sets.some((s) => s.runs.length > 1) && (
        <Link href="/improvements" className={buttonVariants({ variant: "outline" })}>
          Compare runs case by case <ArrowRight />
        </Link>
      )}
    </div>
  );
}
