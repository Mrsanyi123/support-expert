"use client";

import { ChevronsUpDown, Database, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { ResetDemoDialog } from "./load-demo-button";

export function WorkspaceMenu({ offline }: { offline: boolean }) {
  const { theme, setTheme } = useTheme();
  const [resetOpen, setResetOpen] = useState(false);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger render={<SidebarMenuButton size="lg" className="data-popup-open:bg-sidebar-accent" />}>
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg border bg-background">
              <span className={cn("size-2 rounded-full", offline ? "bg-warning" : "bg-success")} />
            </div>
            <div className="grid flex-1 text-left leading-tight">
              <span className="truncate text-sm font-medium">{offline ? "Offline model" : "Model connected"}</span>
              <span className="truncate text-xs text-muted-foreground">{offline ? "Using extractive stub" : "Live LLM endpoint"}</span>
            </div>
            <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-(--anchor-width) min-w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Theme</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={(v) => setTheme(v as string)}>
                <DropdownMenuRadioItem value="light">
                  <Sun /> Light
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark">
                  <Moon /> Dark
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="system">
                  <Monitor /> System
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => setResetOpen(true)}>
              <Database /> Reset to demo data...
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <ResetDemoDialog open={resetOpen} onOpenChange={setResetOpen} />
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
