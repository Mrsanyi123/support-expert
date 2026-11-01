import { ArrowRight, CheckCheck } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AreaTag, CaseStatusBadge, ReviewStatusBadge } from "@/components/badges";
import { EmptyState, LoadingRows, PageBody, PageHeader } from "@/components/page";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/lib/db";

export default function ReviewQueuePage() {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader crumbs={[{ label: "Review" }]} title="Review queue" />
          <PageBody>
            <LoadingRows rows={8} />
          </PageBody>
        </>
      }
    >
      <Queue />
    </Suspense>
  );
}

async function Queue() {
  await connection();
  const [open, recent] = await Promise.all([
    db.case.findMany({
      where: { split: "TRAIN", status: { in: ["NEW", "DRAFTED"] } },
      orderBy: [{ status: "desc" }, { ticketId: "asc" }],
    }),
    db.review.findMany({
      where: { status: { not: "PENDING" } },
      orderBy: { reviewedAt: "desc" },
      take: 10,
      include: { case: { select: { id: true, ticketId: true, customerQuestion: true } } },
    }),
  ]);

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Review" }]}
        title="Review queue"
        description="Generate a draft, check it against the docs, then approve, edit, or reject it."
        actions={
          open[0] && (
            <Link href={`/review/${open[0].id}`} className={buttonVariants()}>
              Start reviewing <ArrowRight />
            </Link>
          )
        }
      />
      <PageBody>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Card className="pb-0">
            <CardHeader>
              <CardTitle>Needs review</CardTitle>
              <CardDescription>
                {open.length} train {open.length === 1 ? "ticket" : "tickets"} without a decision
              </CardDescription>
            </CardHeader>
            {open.length === 0 ? (
              <CardContent className="pb-4">
                <EmptyState icon={CheckCheck} title="You're all caught up" className="border-0">
                  Every train ticket has a decision. Import more cases to keep building examples.
                </EmptyState>
              </CardContent>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-24 pl-4">Ticket</TableHead>
                    <TableHead>Question</TableHead>
                    <TableHead className="hidden w-40 lg:table-cell">Area</TableHead>
                    <TableHead className="w-28 pr-4">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {open.map((c) => (
                    <TableRow key={c.id} className="relative">
                      <TableCell className="pl-4 font-mono text-xs text-muted-foreground">{c.ticketId}</TableCell>
                      <TableCell className="max-w-0 truncate">
                        <Link href={`/review/${c.id}`} className="after:absolute after:inset-0">
                          {c.customerQuestion}
                        </Link>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <AreaTag area={c.productArea} />
                      </TableCell>
                      <TableCell className="pr-4">
                        <CaseStatusBadge status={c.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>

          <Card className="h-fit gap-2">
            <CardHeader>
              <CardTitle>Recent decisions</CardTitle>
              <CardDescription>These become examples and training data.</CardDescription>
            </CardHeader>
            <CardContent className="px-2">
              {recent.length === 0 ? (
                <p className="px-2 py-4 text-sm text-muted-foreground">No decisions yet.</p>
              ) : (
                <ul>
                  {recent.map((r) => (
                    <li key={r.id}>
                      <Link href={`/review/${r.case.id}`} className="block rounded-lg px-2 py-2.5 transition-colors hover:bg-muted">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">{r.case.ticketId}</span>
                          <ReviewStatusBadge status={r.status} />
                          <span className="ml-auto text-xs text-muted-foreground">{r.reviewedAt?.toLocaleDateString()}</span>
                        </div>
                        <div className="mt-1 line-clamp-1 text-sm">{r.case.customerQuestion}</div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </PageBody>
    </>
  );
}
