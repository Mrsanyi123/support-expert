"use client";

import { AlertTriangle, FileUp, Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { importCasesAction, type ImportResult } from "@/app/actions/cases";
import { SplitBadge } from "@/components/badges";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { parseTicketsCsv, REQUIRED_COLUMNS, type ParseResult } from "@/lib/import/csv";
import { cn } from "@/lib/utils";

export function ImportPanel({ variant = "default" }: { variant?: "default" | "outline" }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [preview, setPreview] = useState<ParseResult | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, startTransition] = useTransition();

  async function onFile(f: File | undefined) {
    if (!f) return;
    const text = await f.text();
    setFile({ name: f.name, text });
    setPreview(parseTicketsCsv(text));
    setResult(null);
  }

  function reset() {
    setFile(null);
    setPreview(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function commit() {
    if (!file) return;
    startTransition(async () => {
      const r = await importCasesAction(file.text);
      setResult(r);
      if (r.ok) {
        toast.success(`Imported ${r.created} new and updated ${r.updated} cases`, {
          description: `${r.heldOut} held out for evaluation.${r.skipped.length ? ` ${r.skipped.length} rows skipped.` : ""}`,
        });
        setOpen(false);
        reset();
        router.refresh();
      }
    });
  }

  const trainCount = preview?.rows.filter((r) => r.split === "TRAIN").length ?? 0;
  const evalCount = preview?.rows.filter((r) => r.split === "EVAL").length ?? 0;

  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        <Upload /> Import CSV
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import resolved tickets</DialogTitle>
            <DialogDescription>
              Needs columns{" "}
              {REQUIRED_COLUMNS.map((c, i) => (
                <span key={c}>
                  {i > 0 && ", "}
                  <code className="font-mono text-xs text-foreground">{c}</code>
                </span>
              ))}
              . An optional <code className="font-mono text-xs text-foreground">split</code> column sets TRAIN or EVAL; otherwise 30% of each
              product area is held out.
            </DialogDescription>
          </DialogHeader>

          {!file || !preview ? (
            <label
              className={cn(
                "flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-12 text-center transition-colors hover:bg-muted/50",
                dragging && "border-ring bg-muted/50",
              )}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                onFile(e.dataTransfer.files[0]);
              }}
            >
              <div className="grid size-10 place-items-center rounded-lg bg-muted">
                <FileUp className="size-5 text-muted-foreground" />
              </div>
              <span className="text-sm font-medium">Drop a CSV here or click to browse</span>
              <span className="text-xs text-muted-foreground">
                Try <code className="font-mono">seed/sample-import.csv</code> for five new tickets.
              </span>
              <input ref={inputRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
          ) : (
            <div className="min-w-0 space-y-4">
              <div className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
                <div className="min-w-0 truncate">
                  <span className="font-medium">{file.name}</span>
                  <span className="text-muted-foreground"> · {preview.totalRows} rows</span>
                </div>
                <Button variant="ghost" size="sm" onClick={reset}>
                  Change file
                </Button>
              </div>

              {preview.missingColumns.length > 0 ? (
                <Alert variant="destructive">
                  <AlertTriangle />
                  <AlertTitle>Missing required columns</AlertTitle>
                  <AlertDescription>{preview.missingColumns.join(", ")}</AlertDescription>
                </Alert>
              ) : (
                <div className="grid grid-cols-2 divide-x rounded-lg border sm:grid-cols-4">
                  <Stat label="Valid rows" value={preview.rows.length} />
                  <Stat label="Train" value={trainCount} />
                  <Stat label="Held-out" value={evalCount} />
                  <Stat label="Rejected" value={preview.errors.length} danger={preview.errors.length > 0} />
                </div>
              )}

              {preview.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle />
                  <AlertTitle>{preview.errors.length} rows will be skipped</AlertTitle>
                  <AlertDescription className="max-h-24 overflow-auto">
                    {preview.errors.map((e, i) => (
                      <div key={i}>
                        Line {e.line}
                        {e.ticketId ? ` (${e.ticketId})` : ""}: {e.message}
                      </div>
                    ))}
                  </AlertDescription>
                </Alert>
              )}

              {preview.rows.length > 0 && (
                <div className="max-h-64 overflow-auto rounded-lg border">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background">
                      <TableRow>
                        <TableHead className="pl-3">Ticket</TableHead>
                        <TableHead>Question</TableHead>
                        <TableHead>Area</TableHead>
                        <TableHead className="pr-3">Split</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.rows.slice(0, 50).map((r) => (
                        <TableRow key={r.ticketId}>
                          <TableCell className="pl-3 font-mono text-xs">{r.ticketId}</TableCell>
                          <TableCell className="max-w-64 truncate">{r.customerQuestion}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{r.productArea}</TableCell>
                          <TableCell className="pr-3">
                            <SplitBadge split={r.split} />
                            {r.splitSource === "auto" && <span className="ml-1.5 text-xs text-muted-foreground">auto</span>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}

          {result && !result.ok && (
            <Alert variant="destructive">
              <AlertTriangle />
              <AlertTitle>Import failed</AlertTitle>
              <AlertDescription>{result.error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={commit} disabled={pending || !preview || preview.rows.length === 0}>
              {pending && <Loader2 className="animate-spin" />}
              {pending ? "Importing..." : preview?.rows.length ? `Import ${preview.rows.length} cases` : "Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Stat({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="px-3 py-2.5">
      <div className={cn("text-lg font-semibold tabular-nums", danger && "text-destructive")}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
