"use client";

import { BookOpen, ClipboardCheck, FlaskConical, Inbox, LayoutDashboard, TrendingUp } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const GROUPS = [
  {
    label: "Workflow",
    items: [
      { href: "/", label: "Overview", icon: LayoutDashboard, exact: true },
      { href: "/cases", label: "Cases", icon: Inbox },
      { href: "/review", label: "Review", icon: ClipboardCheck },
      { href: "/evaluation", label: "Evaluation", icon: FlaskConical },
      { href: "/improvements", label: "Improvements", icon: TrendingUp },
    ],
  },
  {
    label: "Knowledge",
    items: [{ href: "/docs", label: "Help docs", icon: BookOpen }],
  },
];

type Props = { live?: boolean; counts?: Record<string, number> };

/** The static fallback (`live` unset) renders without an active item so it never reads the pathname. */
export function NavMain({ live, counts }: Props) {
  return live ? <LiveNav counts={counts} /> : <NavGroups pathname={null} counts={counts} />;
}

function LiveNav({ counts }: { counts?: Record<string, number> }) {
  return <NavGroups pathname={usePathname()} counts={counts} />;
}

function NavGroups({ pathname, counts }: { pathname: string | null; counts?: Record<string, number> }) {
  const isActive = (href: string, exact?: boolean) =>
    pathname !== null && (exact ? pathname === href : pathname.startsWith(href));

  return GROUPS.map((group) => (
    <SidebarGroup key={group.label}>
      <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {group.items.map((item) => {
            const count = counts?.[item.href];
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  isActive={isActive(item.href, "exact" in item && item.exact)}
                  tooltip={item.label}
                  render={<Link href={item.href} />}
                >
                  <item.icon />
                  <span>{item.label}</span>
                </SidebarMenuButton>
                {count ? <SidebarMenuBadge>{count}</SidebarMenuBadge> : null}
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  ));
}
