import type { LucideIcon } from "lucide-react";
import {
  BriefcaseIcon,
  FolderIcon,
  HardDriveDownloadIcon,
  LayoutDashboardIcon,
  ListMusicIcon,
  RouteIcon,
  SlidersHorizontalIcon,
} from "lucide-react";

export type ShellKind = "user" | "admin";

export type ShellNavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
};

type TitleMapEntry = [prefix: string, title: string];

type ShellConfig = {
  brand: string;
  sectionLabel: string;
  defaultTitle: string;
  navItems: ShellNavItem[];
  titleMap: TitleMapEntry[];
};

export const SHELL_CONFIG: Record<ShellKind, ShellConfig> = {
  user: {
    brand: "Music Tagger",
    sectionLabel: "用户中心",
    defaultTitle: "音乐",
    navItems: [
      { title: "首页", href: "/dashboard", icon: LayoutDashboardIcon },
      { title: "音乐库", href: "/library", icon: FolderIcon },
      { title: "歌单", href: "/playlists", icon: ListMusicIcon },
    ],
    titleMap: [
      ["/playlists", "歌单"],
      ["/library", "音乐库"],
      ["/dashboard", "首页"],
    ],
  },
  admin: {
    brand: "Music Tagger Admin",
    sectionLabel: "管理员控制台",
    defaultTitle: "管理台",
    navItems: [
      { title: "概览", href: "/admin", icon: LayoutDashboardIcon },
      { title: "Jobs", href: "/admin/jobs", icon: BriefcaseIcon },
      { title: "Plans", href: "/admin/plans", icon: RouteIcon },
      { title: "音乐库", href: "/admin/library", icon: FolderIcon },
      { title: "缓存", href: "/admin/cache", icon: HardDriveDownloadIcon },
      { title: "设置", href: "/admin/settings", icon: SlidersHorizontalIcon },
    ],
    titleMap: [
      ["/admin/settings", "设置"],
      ["/admin/cache", "缓存"],
      ["/admin/library", "音乐库"],
      ["/admin/plans", "Plans"],
      ["/admin/jobs", "Jobs"],
      ["/admin", "概览"],
    ],
  },
};
