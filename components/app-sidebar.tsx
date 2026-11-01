import { MessageSquareText } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { db } from "@/lib/db";
import { NavMain } from "./nav-main";
import { WorkspaceMenu } from "./workspace-menu";

export function AppSidebar({ offline }: { offline: boolean }) {
  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <MessageSquareText className="size-4" />
              </div>
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate text-sm font-semibold">Support Expert</span>
                <span className="truncate text-xs text-muted-foreground">Relay workspace</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <Suspense fallback={<NavMain />}>
          <NavWithCounts />
        </Suspense>
      </SidebarContent>

      <SidebarFooter>
        <WorkspaceMenu offline={offline} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

async function NavWithCounts() {
  await connection();
  const [review, unrated] = await Promise.all([
    db.case.count({ where: { split: "TRAIN", status: { in: ["NEW", "DRAFTED"] } } }),
    db.evalResult.count({ where: { rating: null, error: null } }),
  ]);
  return <NavMain live counts={{ "/review": review, "/evaluation": unrated }} />;
}
