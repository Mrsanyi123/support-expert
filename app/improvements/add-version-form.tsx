"use client";

import { Loader2, Plus } from "lucide-react";
import { useActionState, useState } from "react";
import { toast } from "sonner";
import { createConfigAction, type CreateConfigState } from "@/app/actions/configs";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function AddVersionForm({ promptVersions, defaults }: { promptVersions: string[]; defaults: { baseUrl: string; model: string } }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(async (prev: CreateConfigState, formData: FormData) => {
    const result = await createConfigAction(prev, formData);
    if (result?.ok) {
      setOpen(false);
      toast.success("Version saved");
    }
    return result;
  }, null);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Plus /> Add version
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <form action={action} className="grid gap-5">
            <DialogHeader>
              <DialogTitle>Add a version</DialogTitle>
              <DialogDescription>Point at any OpenAI-compatible endpoint, such as vLLM serving a fine-tuned model.</DialogDescription>
            </DialogHeader>
            <FieldGroup className="gap-4">
              <Field>
                <FieldLabel htmlFor="v-name">Name</FieldLabel>
                <Input id="v-name" name="name" required placeholder="Fine-tuned Llama 3.1 8B (LoRA v1)" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="v-model">Model</FieldLabel>
                  <Input id="v-model" name="model" required defaultValue={defaults.model} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="v-key">API key env var</FieldLabel>
                  <Input id="v-key" name="apiKeyEnv" required defaultValue="LLM_API_KEY" />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="v-url">Base URL</FieldLabel>
                <Input id="v-url" name="baseUrl" required defaultValue={defaults.baseUrl} />
                <FieldDescription>For vLLM: http://host:8000/v1</FieldDescription>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel>Prompt version</FieldLabel>
                  <Select name="promptVersion" items={promptVersions.map((p) => ({ value: p, label: p }))} defaultValue={promptVersions[0]}>
                    <SelectTrigger className="w-full" aria-label="Prompt version">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {promptVersions.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="v-temp">Temperature</FieldLabel>
                  <Input id="v-temp" name="temperature" type="number" step="0.1" min="0" max="2" defaultValue="0.2" />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="v-desc">Description</FieldLabel>
                <Input id="v-desc" name="description" placeholder="What changed compared to the previous version?" />
              </Field>
              <Field orientation="horizontal">
                <Checkbox id="v-examples" name="useExamples" />
                <FieldLabel htmlFor="v-examples" className="font-normal">
                  Retrieve approved expert examples as few-shot context
                </FieldLabel>
              </Field>
            </FieldGroup>
            {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                {pending ? "Saving..." : "Save version"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
