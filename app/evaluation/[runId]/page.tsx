import { EyeOff } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AnswerText, ExamplesList, SourcesList } from "@/components/answer";
import { AreaTag, ErrorBadge, RatingBadge, SourceBadge } from "@/components/badges";
import { Eyebrow, LoadingPage, PageBody, PageHeader } from "@/components/page";
import { RatingBar, RatingCountsText } from "@/components/rating-bar";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/lib/db";
import { countRatings } from "@/lib/metrics";
import { asExampleRefs, asSourceRefs, loadExampleDetails } from "@/lib/queries";
import { DeleteRunButton } from "./delete-run-button";

const ORDER = { WRONG: 0, INCOMPLETE: 1, null: 2, CORRECT: 3 } as const;

export default function RunPage(props: PageProps<"/evaluation/[runId]">) {
  return (
    <Suspense fallback={<LoadingPage crumbs={[{ label: "Evaluation", href: "/evaluation" }, { label: "Run" }]} />}>
      <Run params={props.params} />
    </Suspense>
  );
}

async function Run({ params }: Pick<PageProps<"/evaluation/[runId]">, "params">) {
  await connection();
  const { runId } = await params;
  const run = await db.evalRun.findUnique({
    where: { id: runId },
    include: {
      agentConfig: true,
      evalSet: { select: { id: true, name: true } },
      results: { include: { case: true } },
    },
  });
  if (!run) notFound();

  const counts = countRatings(run.results);
  const results = [...run.results].sort(
    (a, b) =>
      ORDER[(a.rating ?? "null") as keyof typeof ORDER] - ORDER[(b.rating ?? "null") as keyof typeof ORDER] ||
      a.case.ticketId.localeCompare(b.case.ticketId),
  );
  const examplesByResult = new Map(
    await Promise.all(results.map(async (r) => [r.id, await loadExampleDetails(asExampleRefs(r.exampleRefs))] as const)),
  );
  const pct = counts.total ? Math.round((counts.CORRECT / counts.total) * 100) : 0;

  return (
    <>
      <PageHeader
        crumbs={[
          { label: "Evaluation", href: "/evaluation" },
          { label: run.evalSet.name, href: "/evaluation" },
          { label: run.agentConfig.name },
        ]}
        title={
          <span className="flex items-center gap-3">
            {run.agentConfig.name} <SourceBadge source={run.source} />
          </span>
        }
        description={
          <span className="font-mono text-xs">
            {run.agentConfig.model} · {run.agentConfig.promptVersion} · t={run.agentConfig.temperature} ·{" "}
            {run.agentConfig.useExamples ? `${run.examplePoolSize} expert examples` : "no examples"} · {run.createdAt.toLocaleString()}
          </span>
        }
        actions={
          <>
            {counts.unrated > 0 && (
              <Link href={`/evaluation/rate?set=${run.evalSet.id}`} className={buttonVariants()}>
                <EyeOff /> Rate blind
              </Link>
            )}
            <DeleteRunButton runId={run.id} />
          </>
        }
      />
      <PageBody className="space-y-6">
        <Card>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-8">
            <div className="shrink-0">
              <div className="text-4xl font-semibold tracking-tight tabular-nums">{pct}%</div>
              <div className="text-sm text-muted-foreground">
                {counts.CORRECT} of {counts.total} correct
              </div>
            </div>
            <div className="flex-1 space-y-2">
              <RatingBar counts={counts} className="h-3" />
              <RatingCountsText counts={counts} />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Wrong answers are listed first so a good score can&apos;t hide a serious mistake.</p>
          <Card className="py-0">
            <Accordion multiple defaultValue={results.filter((r) => r.rating === "WRONG").map((r) => r.id)}>
              {results.map((r) => (
                <AccordionItem key={r.id} value={r.id}>
                  <AccordionTrigger className="items-center gap-3 rounded-none px-4 py-3 hover:bg-muted/40 hover:no-underline">
                    <span className="w-14 shrink-0 font-mono text-xs font-normal text-muted-foreground">{r.case.ticketId}</span>
                    <span className="line-clamp-1 flex-1 font-normal">{r.case.customerQuestion}</span>
                    <AreaTag area={r.case.productArea} className="hidden md:inline" />
                    {r.error ? <ErrorBadge /> : <RatingBadge rating={r.rating} />}
                  </AccordionTrigger>
                  <AccordionContent className="border-t bg-muted/20 px-4 pt-4 pb-5">
                    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
                      <div className="space-y-5">
                        <div>
                          <Eyebrow>Customer question</Eyebrow>
                          <p className="text-sm leading-relaxed">{r.case.customerQuestion}</p>
                        </div>
                        <div>
                          <Eyebrow>Model answer</Eyebrow>
                          {r.error ? <p className="text-sm text-destructive">{r.error}</p> : <AnswerText text={r.answer} />}
                        </div>
                        <div>
                          <Eyebrow>Expected resolution</Eyebrow>
                          <p className="text-sm leading-relaxed text-muted-foreground">{r.case.expertResolution}</p>
                        </div>
                        {r.note && (
                          <div className="rounded-lg border bg-background px-3 py-2 text-sm">
                            <span className="text-muted-foreground">Rater note{r.ratedBy ? ` (${r.ratedBy})` : ""}: </span>
                            {r.note}
                          </div>
                        )}
                      </div>
                      <div className="space-y-5">
                        <div>
                          <Eyebrow>Sources</Eyebrow>
                          <SourcesList sources={asSourceRefs(r.sourceRefs)} compact />
                        </div>
                        {(examplesByResult.get(r.id)?.length ?? 0) > 0 && (
                          <div>
                            <Eyebrow>Expert examples used</Eyebrow>
                            <ExamplesList examples={examplesByResult.get(r.id) ?? []} />
                          </div>
                        )}
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Card>
        </div>
      </PageBody>
    </>
  );
}
