"use client";

import { Loader2, Lock, Play, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createEvalSetAction, lockEvalSetAction, startRunAction } from "@/app/actions/evaluation";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function CreateEvalSetButton({ evalCaseCount }: { evalCaseCount: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        disabled={pending || evalCaseCount === 0}
        onClick={() =>
          start(async () => {
            const r = await createEvalSetAction();
            if (!r.ok) setError(r.error ?? "Failed");
            router.refresh();
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" /> : <Plus />} Create set from {evalCaseCount} held-out cases
      </Button>
      {error && <div className="text-xs text-destructive">{error}</div>}
    </div>
  );
}

export function LockEvalSetButton({ evalSetId, hasWarnings }: { evalSetId: string; hasWarnings: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <AlertDialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
      <AlertDialogTrigger render={<Button variant={hasWarnings ? "outline" : "default"} />}>
        <Lock /> Lock set
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{hasWarnings ? "Lock despite leakage warnings?" : "Lock this evaluation set?"}</AlertDialogTitle>
          <AlertDialogDescription>
            {hasWarnings
              ? "Some held-out answers appear in your docs, so retrieval could hand the model the answer. "
              : ""}
            Once locked, its cases and all train/held-out splits are frozen so every version is tested on the same tickets.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                await lockEvalSetAction(evalSetId);
                setOpen(false);
                router.refresh();
              })
            }
          >
            {pending && <Loader2 className="animate-spin" />}
            Lock set
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function RunVersionForm({
  evalSetId,
  caseCount,
  configs,
  offline,
}: {
  evalSetId: string;
  caseCount: number;
  configs: { id: string; name: string }[];
  offline: boolean;
}) {
  const router = useRouter();
  const [configId, setConfigId] = useState(configs[configs.length - 1]?.id ?? "");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select items={configs.map((c) => ({ value: c.id, label: c.name }))} value={configId} onValueChange={(v) => setConfigId(v as string)}>
        <SelectTrigger className="w-full sm:w-64" aria-label="Version to run">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {configs.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        disabled={pending || !configId}
        onClick={() => {
          setError(null);
          start(async () => {
            const r = await startRunAction(evalSetId, configId);
            if (!r.ok) return setError(r.error);
            router.push(`/evaluation/${r.runId}`);
          });
        }}
      >
        {pending ? <Loader2 className="animate-spin" /> : <Play />}
        {pending ? `Answering ${caseCount} cases...` : `Run on ${caseCount} cases`}
      </Button>
      {offline && <span className="text-xs text-muted-foreground">Offline stub: set LLM_API_KEY for real model output.</span>}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
