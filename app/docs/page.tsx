import { BookOpen, FileText, Trash2 } from "lucide-react";
import { connection } from "next/server";
import { Suspense } from "react";
import { deleteDocumentAction } from "@/app/actions/docs";
import { EmptyState, LoadingRows, PageBody, PageHeader } from "@/components/page";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { db } from "@/lib/db";
import { UploadDocsForm } from "./upload-form";

export default function DocsPage() {
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Help docs" }]}
        title="Help docs"
        description="Your product documentation. The best-matching sections are passed to the model as numbered sources."
        actions={<UploadDocsForm />}
      />
      <PageBody>
        <Suspense fallback={<LoadingRows />}>
          <DocsList />
        </Suspense>
      </PageBody>
    </>
  );
}

async function DocsList() {
  await connection();
  const docs = await db.document.findMany({
    orderBy: { filename: "asc" },
    include: { chunks: { orderBy: { ordinal: "asc" }, select: { id: true, heading: true, text: true } } },
  });

  if (docs.length === 0) {
    return (
      <EmptyState icon={BookOpen} title="No documents indexed">
        Upload Markdown or text files so drafts can cite your documentation.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {docs.length} documents · {docs.reduce((n, d) => n + d.chunks.length, 0)} indexed sections
      </p>
      <Card className="py-0">
        <Accordion>
          {docs.map((d) => (
            <AccordionItem key={d.id} value={d.id}>
              <AccordionTrigger className="items-center gap-3 rounded-none px-4 py-3 hover:bg-muted/40 hover:no-underline">
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">
                  {d.title}
                  <span className="ml-2 hidden font-mono text-xs font-normal text-muted-foreground sm:inline">{d.filename}</span>
                </span>
                <Badge variant="secondary" className="font-normal tabular-nums">
                  {d.chunks.length} sections
                </Badge>
              </AccordionTrigger>
              <AccordionContent className="space-y-2 border-t bg-muted/20 px-4 pt-4 pb-4">
                {d.chunks.map((c, i) => (
                  <div key={c.id} className="rounded-lg border bg-background px-3 py-2.5">
                    <div className="mb-1 text-xs font-medium text-muted-foreground">
                      {i + 1}. {c.heading || "Untitled section"}
                    </div>
                    <pre className="font-sans text-xs leading-relaxed whitespace-pre-wrap">{c.text}</pre>
                  </div>
                ))}
                <form action={deleteDocumentAction} className="flex justify-end pt-2">
                  <input type="hidden" name="id" value={d.id} />
                  <Button type="submit" variant="destructive" size="sm">
                    <Trash2 /> Delete document
                  </Button>
                </form>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Card>
    </div>
  );
}
