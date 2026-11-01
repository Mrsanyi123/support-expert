import { CheckCircle2, FlaskConical } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { EmptyState, LoadingRows, PageBody, PageHeader } from "@/components/page";
import { buttonVariants } from "@/components/ui/button";
import { stableShuffleKey } from "@/lib/concurrency";
import { db } from "@/lib/db";
import { asSourceRefs } from "@/lib/queries";
import { BlindRater } from "./blind-rater";

export default function RatePage(props: PageProps<"/evaluation/rate">) {
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Evaluation", href: "/evaluation" }, { label: "Blind rating" }]}
        title="Blind rating"
        description="Answers from every version, shuffled. The version and citations are hidden so you judge only the content."
      />
      <PageBody className="max-w-5xl">
        <Suspense fallback={<LoadingRows rows={6} />}>
          <NextToRate searchParams={props.searchParams} />
        </Suspense>
      </PageBody>
    </>
  );
}

async function NextToRate({ searchParams }: Pick<PageProps<"/evaluation/rate">, "searchParams">) {
  await connection();
  const sp = await searchParams;
  const setId = typeof sp.set === "string" ? sp.set : undefined;
  const set = setId
    ? await db.evalSet.findUnique({ where: { id: setId } })
    : await db.evalSet.findFirst({ where: { lockedAt: { not: null } }, orderBy: { createdAt: "desc" } });
  if (!set)
    return (
      <EmptyState icon={FlaskConical} title="No evaluation set">
        Create and lock an evaluation set first.
      </EmptyState>
    );

  const unrated = await db.evalResult.findMany({
    where: { run: { evalSetId: set.id }, rating: null, error: null },
    select: { id: true },
  });
  const rated = await db.evalResult.count({ where: { run: { evalSetId: set.id }, rating: { not: null } } });

  if (unrated.length === 0) {
    return (
      <EmptyState
        icon={CheckCircle2}
        title={`All answers in ${set.name} are rated`}
        action={
          <>
            <Link href="/evaluation" className={buttonVariants({ variant: "outline" })}>
              Back to runs
            </Link>
            <Link href="/improvements" className={buttonVariants()}>
              Compare versions
            </Link>
          </>
        }
      >
        {rated} ratings recorded.
      </EmptyState>
    );
  }

  const nextId = [...unrated].sort((a, b) => stableShuffleKey(a.id) - stableShuffleKey(b.id))[0].id;
  const result = await db.evalResult.findUniqueOrThrow({ where: { id: nextId }, include: { case: true } });

  return (
    <BlindRater
      key={result.id}
      resultId={result.id}
      ticketId={result.case.ticketId}
      question={result.case.customerQuestion}
      expected={result.case.expertResolution}
      answer={result.answer}
      sourceTitles={asSourceRefs(result.sourceRefs).map((s) => `${s.title}${s.heading ? ` / ${s.heading}` : ""}`)}
      remaining={unrated.length}
      rated={rated}
    />
  );
}
