import type { ReactNode } from "react";

import { GlobalPlayer } from "@/components/playback/global-player";
import { cn } from "@/lib/utils";

import { SidebarNav } from "./sidebar-nav";
import { Topbar } from "./topbar";

export function AppShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="min-h-full">
      <SidebarNav />

      <div className="flex min-h-full flex-col md:pl-64">
        <Topbar />
        <main className={cn("flex-1 p-4 md:p-6", className)}>{children}</main>
        <GlobalPlayer />
      </div>
    </div>
  );
}
