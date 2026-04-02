"use client";

import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { SearchIcon, UserCircleIcon } from "lucide-react";

import { SidebarNavSheet } from "./sidebar-nav";

const TITLE_MAP: Array<[prefix: string, title: string]> = [
  ["/admin/jobs", "Jobs"],
  ["/admin/settings", "设置"],
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

        <div className="flex flex-1 items-center justify-center">
          <div className="relative w-full max-w-md">
            <SearchIcon className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-8" placeholder="搜索（占位）" />
          </div>
        </div>

        <Button variant="outline" size="icon-sm" aria-label="用户（占位）">
          <UserCircleIcon />
        </Button>
      </div>
      <Separator />
    </header>
  );
}

