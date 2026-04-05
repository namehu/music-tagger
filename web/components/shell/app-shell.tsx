import type { ReactNode } from "react";

import { GlobalPlayer } from "@/components/playback/global-player";
import { cn } from "@/lib/utils";
import type { AppViewer } from "@/lib/viewer";

import type { ShellKind } from "./shell-config";
import { ShellSidebarNav } from "./sidebar-nav";
import { Topbar } from "./topbar";

export function AppShell({
  children,
  shellKind,
  viewer,
  className,
}: {
  children: ReactNode;
  shellKind: ShellKind;
  viewer: AppViewer;
  className?: string;
}) {
  return (
    <div className="min-h-full">
      <ShellSidebarNav shellKind={shellKind} brand={shellKind === "admin" ? "Music Tagger Admin" : "Music Tagger"} />

      <div className="flex min-h-full flex-col md:pl-64">
        <Topbar shellKind={shellKind} viewer={viewer} />
        <main className={cn("flex-1 p-4 md:p-6", className)}>{children}</main>
        <GlobalPlayer sessionKind={shellKind === "admin" ? "admin" : "user"} />
      </div>
    </div>
  );
}
