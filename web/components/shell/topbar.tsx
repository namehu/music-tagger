"use client";

import { usePathname } from "next/navigation";

import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import { SidebarNavSheet } from "./sidebar-nav";

const TITLE_MAP: Array<[prefix: string, title: string]> = [
  ["/admin/settings", "设置"],
  ["/admin/cache", "缓存"],
  ["/admin/library", "音乐库"],
  ["/admin/jobs", "Jobs"],
  ["/admin", "概览"],
];

function getTitle(pathname: string) {
  for (const [prefix, title] of TITLE_MAP) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return title;
  }
  return "Dashboard";
}

export function Topbar({ className }: { className?: string }) {
  const pathname = usePathname() ?? "";
  const title = getTitle(pathname);

  return (
    <header className={cn("sticky top-0 z-30 bg-background/80 backdrop-blur", className)}>
      <div className="flex h-14 items-center gap-3 px-4 md:px-6">
        <SidebarNavSheet />
        <h1 className="text-base font-semibold">{title}</h1>
        <div className="ml-auto text-sm text-muted-foreground">管理员控制台</div>
      </div>
      <Separator />
    </header>
  );
}
