import { ArrowRight, Lock } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AnswerText } from "@/components/answer";
import { AreaTag, CaseStatusBadge, RatingBadge, SourceBadge, SplitBadge } from "@/components/badges";
import { LoadingPage, PageBody, PageHeader, Section } from "@/components/page";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { asExampleRefs, asSourceRefs, loadExampleDetails } from "@/lib/queries";
import { ReviewWorkspace, type LastDecision } from "./review-workspace";

export default function ReviewCasePage(props: PageProps<"/review/[caseId]">) {
  return (
    <Suspense fallback={<LoadingPage crumbs={[{ label: "Review", href: "/review" }, { label: "Case" }]} />}>
      <ReviewCase params={props.params} />
    </Suspense>
  );
}

async function ReviewCase({ params }: Pick<PageProps<"/review/[caseId]">, "params">) {
  await connection();
  const { caseId } = await params;
  const c = await db.case.findUnique({
    where: { id: caseId },
    include: { reviews: { orderBy: { createdAt: "desc" }, include: { agentConfig: { select: { name: true } } } } },
  });
  if (!c) notFound();

  if (c.split === "EVAL") {
    return (
      <>
        <PageHeader
          crumbs={[
            { label: "Cases", href: "/cases?split=EVAL" },
            { label: c.ticketId },
          ]}
          title={
            <span className="flex items-center gap-3">
              <span className="font-mono">{c.ticketId}</span>
              <SplitBadge split={c.split} />
            </span>
          }
        />
        <EvalCaseView caseId={c.id} question={c.customerQuestion} resolution={c.expertResolution} productArea={c.productArea} />
      </>
    );
  }

  const configs = await db.agentConfig.findMany({ orderBy: { key: "asc" } });
  const pending = c.reviews.find((r) => r.status === "PENDING");
  const decided = c.reviews.find((r) => r.status !== "PENDING");

  const initialDraft = pending
    ? {
        id: pending.id,
        aiDraft: pending.aiDraft,
        sourceRefs: asSourceRefs(pending.sourceRefs),
        examples: await loadExampleDetails(asExampleRefs(pending.exampleRefs)),
        modelName: pending.modelName,
        promptVersion: pending.promptVersion,
        configName: pending.agentConfig.name,
        latencyMs: pending.latencyMs,
        offline: pending.modelName.startsWith("offline-stub"),
      }
    : null;

  const lastDecision: LastDecision | null = decided
    ? {
        status: decided.status,
        aiDraft: decided.aiDraft,
        finalAnswer: decided.finalAnswer,
        reviewer: decided.reviewer,
        reviewedAt: decided.reviewedAt?.toISOString() ?? null,
        rejectReason: decided.rejectReason,
        editDistance: decided.editDistance,
        configName: decided.agentConfig.name,
      }
    : null;

  const queue = await db.case.findMany({
    where: { split: "TRAIN", status: { in: ["NEW", "DRAFTED"] }, id: { not: c.id } },
    orderBy: { ticketId: "asc" },
    select: { id: true, ticketId: true },
  });
  const next = queue.find((q) => q.ticketId > c.ticketId) ?? queue[0] ?? null;
  const defaultConfig = configs.find((x) => x.isDefault) ?? configs[0];

  return (
    <>
      <PageHeader
        crumbs={[
          { label: "Review", href: "/review" },
          { label: c.ticketId },
        ]}
        title={
          <span className="flex items-center gap-3">
            <span className="font-mono">{c.ticketId}</span>
            <CaseStatusBadge status={c.status} />
          </span>
        }
        actions={
          next && (
            <Link href={`/review/${next.id}`} className={buttonVariants({ variant: "ghost" })}>
              Skip to {next.ticketId} <ArrowRight />
            </Link>
          )
        }
      />
      <ReviewWorkspace
        key={c.id}
        caseData={{
          id: c.id,
          ticketId: c.ticketId,
          question: c.customerQuestion,
          resolution: c.expertResolution,
          productArea: c.productArea,
        }}
        configs={configs.map((x) => ({ id: x.id, name: x.name, description: x.description, useExamples: x.useExamples, model: x.model }))}
        defaultConfigId={pending?.agentConfigId ?? defaultConfig?.id ?? ""}
        initialDraft={initialDraft}
        lastDecision={lastDecision}
        nextCaseId={next?.id ?? null}
        defaultReviewer={process.env.DEFAULT_REVIEWER ?? "Support Expert"}
      />
    </>
  );
}

async function EvalCaseView({
  caseId,
  question,
  resolution,
  productArea,
}: {
  caseId: string;
  question: string;
  resolution: string;
  productArea: string;
}) {
  const results = await db.evalResult.findMany({
    where: { caseId },
    orderBy: { run: { createdAt: "desc" } },
    include: { run: { include: { agentConfig: { select: { name: true } } } } },
  });

  return (
    <PageBody className="max-w-5xl space-y-6">
      <Alert>
        <Lock />
        <AlertTitle>Held-out ticket</AlertTitle>
        <AlertDescription>
          Never drafted for review, used as an example, or exported. Scores on it show how a version handles tickets it hasn&apos;t seen.
        </AlertDescription>
      </Alert>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardDescription>Customer question</CardDescription>
            <CardAction>
              <AreaTag area={productArea} />
            </CardAction>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{question}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Expected resolution (raters only)</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground">{resolution}</p>
          </CardContent>
        </Card>
      </div>
      <Section title="Answers from evaluation runs">
        {results.length === 0 && <p className="text-sm text-muted-foreground">No runs include this case yet.</p>}
        {results.map((r) => (
          <Card key={r.id}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
                {r.run.agentConfig.name}
                <SourceBadge source={r.run.source} />
                <RatingBadge rating={r.rating} />
              </CardTitle>
              <CardAction>
                <Link href={`/evaluation/${r.runId}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                  Open run
                </Link>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-2">
              <AnswerText text={r.answer} />
              {r.note && <p className="text-xs text-muted-foreground">Rater note: {r.note}</p>}
            </CardContent>
          </Card>
        ))}
      </Section>
    </PageBody>
  );
}
