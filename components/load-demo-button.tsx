"use client";

import { Database, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { loadDemoDatasetAction } from "@/app/actions/cases";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

/** Confirm dialog for resetting the workspace to the seeded demo. Controlled so menus can open it. */
export function ResetDemoDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      await loadDemoDatasetAction();
      onOpenChange(false);
      toast.success("Demo dataset loaded");
      router.refresh();
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Load the demo dataset?</AlertDialogTitle>
          <AlertDialogDescription>
            This replaces every case, review, and evaluation run in the workspace with the seeded Relay demo. It can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button variant="destructive" onClick={confirm} disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            {pending ? "Loading..." : "Replace workspace data"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function LoadDemoButton({ variant = "outline" }: { variant?: "outline" | "default" | "ghost" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        <Database /> Load demo dataset
      </Button>
      <ResetDemoDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
