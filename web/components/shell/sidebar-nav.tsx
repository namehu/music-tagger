"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button, buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { BriefcaseIcon, LayoutDashboardIcon, MenuIcon, SettingsIcon } from "lucide-react";

type NavItem = {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

const NAV_ITEMS: NavItem[] = [
  { title: "概览", href: "/admin", icon: LayoutDashboardIcon },
  { title: "Jobs", href: "/admin/jobs", icon: BriefcaseIcon },
  { title: "设置", href: "/admin/settings", icon: SettingsIcon },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarNavContent({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const pathname = usePathname() ?? "";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-14 items-center px-4 font-semibold">Dashboard</div>
      <Separator />
      <nav className="flex flex-1 flex-col gap-1 overflow-auto p-2">
        {NAV_ITEMS.map((item) => {
          const active = isActivePath(pathname, item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                buttonVariants({
                  variant: active ? "secondary" : "ghost",
                  size: "sm",
                }),
                "w-full justify-start gap-2"
              )}
            >
              <Icon className="size-4" />
              <span>{item.title}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function SidebarNav({ className }: { className?: string }) {
  return (
    <aside
      className={cn(
        "hidden md:fixed md:inset-y-0 md:left-0 md:z-40 md:flex md:w-64 md:flex-col md:border-r md:bg-background",
        className
      )}
    >
      <SidebarNavContent />
    </aside>
  );
}

export function SidebarNavSheet({ className }: { className?: string }) {
  const [open, setOpen] = React.useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn("md:hidden", className)}
            aria-label="打开侧边栏"
          />
        }
      >
        <MenuIcon />
      </SheetTrigger>
      <SheetContent side="left" className="p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>导航</SheetTitle>
        </SheetHeader>
        <SidebarNavContent onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}

