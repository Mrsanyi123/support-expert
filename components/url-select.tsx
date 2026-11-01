"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const ALL = "__all__";

/** A Select that writes its value to a URL search param, so filters stay shareable and server-rendered. */
export function UrlSelect({
  param,
  placeholder,
  options,
  className,
}: {
  param: string;
  placeholder: string;
  options: { value: string; label: string }[];
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const value = searchParams.get(param) ?? ALL;
  const items = [{ value: ALL, label: placeholder }, ...options];

  return (
    <Select
      items={items}
      value={value}
      onValueChange={(next) => {
        const sp = new URLSearchParams(searchParams);
        if (!next || next === ALL) sp.delete(param);
        else sp.set(param, next as string);
        const qs = sp.toString();
        startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
      }}
    >
      <SelectTrigger className={cn("min-w-36", pending && "opacity-70", className)} aria-label={placeholder}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
