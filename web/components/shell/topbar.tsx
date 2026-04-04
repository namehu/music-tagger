"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOutIcon, ShieldIcon, UserIcon } from "lucide-react";

import { signOut } from "@/lib/auth-client";
import type { AppViewer } from "@/lib/viewer";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import type { ShellKind } from "./shell-config";
import { SidebarNavSheet } from "./sidebar-nav";

const SHELL_TITLE_MAP: Record<ShellKind, Array<[prefix: string, title: string]>> = {
  user: [
    ["/ignored-tracks", "忽略"],
    ["/playlists", "歌单"],
    ["/library", "音乐库"],
    ["/dashboard", "首页"],
  ],
  admin: [
    ["/admin/ignored-tracks", "忽略"],
    ["/admin/settings", "设置"],
    ["/admin/cache", "缓存"],
    ["/admin/library", "音乐库"],
    ["/admin/plans", "Plans"],
    ["/admin/jobs", "Jobs"],
    ["/admin", "概览"],
  ],
};

const SHELL_DEFAULT_TITLE: Record<ShellKind, string> = {
  user: "音乐",
  admin: "管理台",
};

const SHELL_SECTION_LABEL: Record<ShellKind, string> = {
  user: "用户中心",
  admin: "管理员控制台",
};

const SHELL_BRAND: Record<ShellKind, string> = {
  user: "Music Tagger",
  admin: "Music Tagger Admin",
};

function getTitle(pathname: string, shellKind: ShellKind) {
  for (const [prefix, title] of SHELL_TITLE_MAP[shellKind]) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return title;
  }
  return SHELL_DEFAULT_TITLE[shellKind];
}

function getViewerInitials(viewer: AppViewer) {
  const trimmed = viewer.name.trim();
  if (!trimmed) {
    return viewer.email.slice(0, 2).toUpperCase();
  }

  const parts = trimmed.split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || viewer.email.slice(0, 2).toUpperCase();
}

export function Topbar({
  shellKind,
  viewer,
  className,
}: {
  shellKind: ShellKind;
  viewer: AppViewer;
  className?: string;
}) {
  const pathname = usePathname() ?? "";
  const title = getTitle(pathname, shellKind);
  const canEnterAdmin = viewer.role === "admin";

  return (
    <header className={cn("sticky top-0 z-30 bg-background/80 backdrop-blur", className)}>
      <div className="flex h-14 items-center gap-3 px-4 md:px-6">
        <SidebarNavSheet shellKind={shellKind} brand={SHELL_BRAND[shellKind]} />
        <h1 className="text-base font-semibold">{title}</h1>
        <div className="ml-auto flex items-center gap-3">
          <div className="hidden text-sm text-muted-foreground md:block">{SHELL_SECTION_LABEL[shellKind]}</div>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button type="button" variant="ghost" size="sm" className="h-10 gap-2 px-2" />
              }
            >
              <Avatar size="sm">
                <AvatarFallback>{getViewerInitials(viewer)}</AvatarFallback>
              </Avatar>
              <span className="hidden text-sm md:inline">{viewer.name}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 min-w-64">
              <DropdownMenuGroup>
                <DropdownMenuLabel>
                  <div className="space-y-1">
                    <div className="font-medium text-foreground">{viewer.name}</div>
                    <div className="text-xs text-muted-foreground">{viewer.email}</div>
                  </div>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              {shellKind === "user" && canEnterAdmin ? (
                <DropdownMenuItem render={<Link href="/admin" />}>
                  <ShieldIcon />
                  进入管理台
                </DropdownMenuItem>
              ) : null}
              {shellKind === "admin" ? (
                <DropdownMenuItem render={<Link href="/dashboard" />}>
                  <UserIcon />
                  返回用户区
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem
                onClick={async () => {
                  await signOut();
                  window.location.href = "/sign-in";
                }}
              >
                <LogOutIcon />
                退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <Separator />
    </header>
  );
}
