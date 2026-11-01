"use client";

import { FileUp, Loader2, Upload } from "lucide-react";
import { useActionState, useState } from "react";
import { toast } from "sonner";
import { uploadDocsAction, type UploadDocsResult } from "@/app/actions/docs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function UploadDocsForm() {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<string[]>([]);
  const [state, action, pending] = useActionState(async (prev: UploadDocsResult | null, formData: FormData) => {
    const result = await uploadDocsAction(prev, formData);
    if (result.indexed.length > 0) {
      toast.success(`Indexed ${result.indexed.length} ${result.indexed.length === 1 ? "document" : "documents"}`, {
        description: result.indexed.map((d) => `${d.filename} (${d.chunks} chunks)`).join(", "),
      });
    }
    if (result.errors.length === 0) {
      setOpen(false);
      setFiles([]);
    }
    return result;
  }, null);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Upload /> Upload docs
      </Button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setFiles([]);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <form action={action} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Upload help docs</DialogTitle>
              <DialogDescription>Markdown or plain text. Each file is split by heading and indexed for retrieval.</DialogDescription>
            </DialogHeader>
            <label
              className={cn(
                "flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center transition-colors hover:bg-muted/50",
                files.length > 0 && "border-solid",
              )}
            >
              <div className="grid size-10 place-items-center rounded-lg bg-muted">
                <FileUp className="size-5 text-muted-foreground" />
              </div>
              <span className="text-sm font-medium">{files.length ? `${files.length} selected` : "Click to choose files"}</span>
              <span className="line-clamp-2 text-xs text-muted-foreground">{files.length ? files.join(", ") : ".md, .markdown or .txt"}</span>
              <input
                type="file"
                name="files"
                multiple
                required
                accept=".md,.markdown,.txt,text/markdown,text/plain"
                className="sr-only"
                onChange={(e) => setFiles(Array.from(e.target.files ?? []).map((f) => f.name))}
              />
            </label>
            {state && state.errors.length > 0 && (
              <div className="space-y-1 text-sm text-destructive">
                {state.errors.map((e) => (
                  <p key={e}>{e}</p>
                ))}
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending || files.length === 0}>
                {pending && <Loader2 className="animate-spin" />}
                {pending ? "Indexing..." : "Upload & index"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
