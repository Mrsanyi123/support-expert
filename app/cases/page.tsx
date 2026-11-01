import { Inbox, Search } from "lucide-react";
import Form from "next/form";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AreaTag, CaseStatusBadge, SplitBadge } from "@/components/badges";
import { LoadDemoButton } from "@/components/load-demo-button";
import { EmptyState, LinkTabs, LoadingRows, PageBody, PageHeader } from "@/components/page";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UrlSelect } from "@/components/url-select";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { ImportPanel } from "./import-panel";

export default function CasesPage(props: PageProps<"/cases">) {
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Cases" }]}
        title="Cases"
        description="Resolved support tickets. Train cases are drafted and reviewed; held-out cases are only used to test versions."
        actions={<ImportPanel />}
      />
      <PageBody>
        <Suspense fallback={<LoadingRows rows={10} />}>
          <CasesTable searchParams={props.searchParams} />
        </Suspense>
      </PageBody>
    </>
  );
}

const SPLITS = ["TRAIN", "EVAL"] as const;
const STATUSES = ["NEW", "DRAFTED", "APPROVED", "REJECTED"] as const;

async function CasesTable({ searchParams }: Pick<PageProps<"/cases">, "searchParams">) {
  await connection();
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const split = SPLITS.find((s) => s === one(sp.split));
  const status = STATUSES.find((s) => s === one(sp.status));
  const area = one(sp.area);
  const q = one(sp.q)?.trim();

  const where: Prisma.CaseWhereInput = {
    ...(split && { split }),
    ...(status && { status }),
    ...(area && { productArea: area }),
    ...(q && {
      OR: [
        { ticketId: { contains: q, mode: "insensitive" } },
        { customerQuestion: { contains: q, mode: "insensitive" } },
        { expertResolution: { contains: q, mode: "insensitive" } },
      ],
    }),
  };

  const [cases, totals, areas] = await Promise.all([
    db.case.findMany({ where, orderBy: { ticketId: "asc" } }),
    db.case.groupBy({ by: ["split"], _count: true }),
    db.case.groupBy({ by: ["productArea"], _count: true, orderBy: { productArea: "asc" } }),
  ]);

  const countFor = (s?: string) => totals.filter((t) => !s || t.split === s).reduce((sum, t) => sum + t._count, 0);
  const all = countFor();

  if (all === 0) {
    return (
      <EmptyState icon={Inbox} title="No cases yet" action={<LoadDemoButton variant="default" />}>
        Import a CSV of resolved tickets, or load the Relay demo dataset to see the full loop.
      </EmptyState>
    );
  }

  const href = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ split, status, area, q, ...patch })) if (v) next.set(k, v);
    const s = next.toString();
    return s ? `/cases?${s}` : "/cases";
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <LinkTabs
          items={[
            { href: href({ split: undefined }), label: "All", active: !split, count: all },
            { href: href({ split: "TRAIN" }), label: "Train", active: split === "TRAIN", count: countFor("TRAIN") },
            { href: href({ split: "EVAL" }), label: "Held-out", active: split === "EVAL", count: countFor("EVAL") },
          ]}
        />
        <UrlSelect
          param="status"
          placeholder="Any status"
          options={STATUSES.map((s) => ({ value: s, label: s[0] + s.slice(1).toLowerCase() }))}
        />
        <UrlSelect param="area" placeholder="All areas" options={areas.map((a) => ({ value: a.productArea, label: a.productArea }))} />
        <Form action="/cases" className="relative w-full sm:ml-auto sm:w-64">
          {split && <input type="hidden" name="split" value={split} />}
          {status && <input type="hidden" name="status" value={status} />}
          {area && <input type="hidden" name="area" value={area} />}
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={q} placeholder="Search tickets..." className="pl-8" aria-label="Search tickets" />
        </Form>
      </div>

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-24 pl-4">Ticket</TableHead>
              <TableHead>Question</TableHead>
              <TableHead className="hidden w-40 lg:table-cell">Area</TableHead>
              <TableHead className="w-28">Split</TableHead>
              <TableHead className="w-32 pr-4">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cases.map((c) => (
              <TableRow key={c.id} className="relative">
                <TableCell className="pl-4 align-top font-mono text-xs text-muted-foreground">{c.ticketId}</TableCell>
                <TableCell className="max-w-0 align-top whitespace-normal">
                  <Link href={`/review/${c.id}`} className="line-clamp-1 font-medium after:absolute after:inset-0">
                    {c.customerQuestion}
                  </Link>
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{c.expertResolution}</p>
                </TableCell>
                <TableCell className="hidden align-top lg:table-cell">
                  <AreaTag area={c.productArea} />
                </TableCell>
                <TableCell className="align-top">
                  <SplitBadge split={c.split} />
                </TableCell>
                <TableCell className="pr-4 align-top">
                  {c.split === "EVAL" ? <span className="text-xs text-muted-foreground">—</span> : <CaseStatusBadge status={c.status} />}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {cases.length === 0 && (
          <div className="border-t px-4 py-10 text-center text-sm text-muted-foreground">
            No cases match these filters.{" "}
            <Link href="/cases" className="text-foreground underline underline-offset-4">
              Clear filters
            </Link>
          </div>
        )}
      </Card>
      <p className="text-xs text-muted-foreground">
        Showing {cases.length} of {all} cases
      </p>
    </div>
  );
}
