# UI（shadcn/ui + Dashboard Shell）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有 Next.js 16 App Router 项目中引入 shadcn/ui，并落地“布局 A：侧边栏 + 顶部栏”的 Dashboard Shell，统一 `/sign-in`、`/setup`、`/admin/jobs` 三个页面的视觉与交互。

**Architecture:** 用 Route Group 将页面分为 `(public)` 与 `(app)` 两套 layout：public 不套壳、登录后页面统一套壳；shadcn/ui 组件输出到 `web/components/ui/*`，应用壳组件放到 `web/components/shell/*`。

**Tech Stack:** Next.js 16.2.2 + TailwindCSS v4 + shadcn/ui（Radix UI）+ tRPC + better-auth

---

## 0. 变更范围与文件结构（落地后）

### 0.1 新增/调整目录

- 新增：`web/components/ui/*`（shadcn 生成的原子组件）
- 新增：`web/components/shell/*`（Sidebar / Topbar / NavItem / UserMenu）
- 新增：`web/lib/utils.ts`（`cn()` 工具，shadcn 默认）
- 调整路由到 Route Group：
  - `web/app/(public)/sign-in/page.tsx`
  - `web/app/(public)/setup/page.tsx`
  - `web/app/(app)/layout.tsx`
  - `web/app/(app)/page.tsx`
  - `web/app/(app)/admin/jobs/page.tsx`
  - `web/app/(app)/admin/layout.tsx`（保留现有 admin role 校验）

> 注意：Route Group 不改变 URL（仍然是 `/sign-in`、`/setup`、`/admin/jobs`）。

### 0.2 本计划不做
- 不做 Tracks/搜索/播放等新功能页（壳稳定后再做）
- 不做 data-table 高级功能（先 Table + Badge + Button）

---

## Task 1: 初始化 shadcn/ui（Neutral / Zinc）

**Files:**
- Create: `web/components.json`（shadcn 配置）
- Create: `web/lib/utils.ts`
- Modify: `web/package.json`（新增依赖）
- Modify (可能): `web/tailwind.config.*`（若 shadcn init 需要；Tailwind v4 可能不需要传统 config）
- Modify: `web/app/globals.css`（注入 shadcn 推荐的 CSS variables / base layer）

- [ ] **Step 1: 运行 shadcn init（pnpm）**

Run（在仓库根目录）：
```bash
pnpm -C web dlx shadcn@latest init
```

Init 交互建议选择：
- style：`new-york`
- base color：`zinc`
- css file：`app/globals.css`
- components：`components`
- utils：`lib/utils`
- rsc：`yes`

Expected：
- 生成 `web/components.json`
- 生成/更新 `web/lib/utils.ts`
- 安装必要依赖（Radix、clsx、tailwind-merge 等）

- [ ] **Step 2: 添加第一批组件（CLI）**

Run：
```bash
pnpm -C web dlx shadcn@latest add button input label card separator
pnpm -C web dlx shadcn@latest add dropdown-menu avatar sheet table badge
pnpm -C web dlx shadcn@latest add sonner
```

Expected：
- 在 `web/components/ui/*` 生成对应组件
- `web/app/globals.css` 注入必要的 CSS variables（若未注入）

- [ ] **Step 3: lint**

Run：
```bash
pnpm -C web lint
```
Expected：exit code 0

- [ ] **Step 4: Commit**

```bash
git add web/components.json web/components web/lib/utils.ts web/app/globals.css web/package.json
git commit -m "feat(web): init shadcn ui base components"
```

---

## Task 2: 落地 Dashboard Shell 组件（Sidebar + Topbar）

**Files:**
- Create: `web/components/shell/sidebar-nav.tsx`
- Create: `web/components/shell/topbar.tsx`
- Create: `web/components/shell/app-shell.tsx`
- (Optional) Create: `web/components/shell/user-menu.tsx`

- [ ] **Step 1: 实现 Sidebar 导航（静态项）**

Create `web/components/shell/sidebar-nav.tsx`：
```tsx
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/admin/jobs", label: "Jobs" },
  { href: "/settings", label: "Settings" },
];

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="text-sm font-semibold tracking-tight">Local Music</div>
      <Separator />
      <nav className="flex flex-col gap-1">
        {navItems.map((it) => {
          const active = pathname === it.href || (it.href !== "/" && pathname?.startsWith(it.href));
          return (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm transition-colors",
                active ? "bg-zinc-200/70 text-zinc-950" : "text-zinc-700 hover:bg-zinc-100",
                "dark:" + (active ? "bg-zinc-800 text-zinc-50" : "text-zinc-300 hover:bg-zinc-900/50"),
              )}
            >
              {it.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto text-xs text-zinc-500">v0</div>
    </div>
  }
```

- [ ] **Step 2: 实现 Topbar（标题 + 搜索占位 + 用户菜单占位）**

Create `web/components/shell/topbar.tsx`：
```tsx
"use client";

import { usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function titleFromPath(pathname: string | null) {
  if (!pathname) return "Dashboard";
  if (pathname.startsWith("/admin/jobs")) return "Jobs";
  if (pathname.startsWith("/settings")) return "Settings";
  return "Dashboard";
}

export function Topbar() {
  const pathname = usePathname();
  const title = titleFromPath(pathname);
  return (
    <div className="flex h-14 items-center justify-between border-b bg-background px-4">
      <div className="font-semibold">{title}</div>
      <div className="flex items-center gap-2">
        <Input className="w-[240px]" placeholder="搜索（后续接 tracks/search）" />
        <Button variant="secondary">用户</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: AppShell（桌面侧边栏 + 移动端 Sheet）**

Create `web/components/shell/app-shell.tsx`：
```tsx
"use client";

import { ReactNode } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { SidebarNav } from "./sidebar-nav";
import { Topbar } from "./topbar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-zinc-50 text-zinc-950 dark:bg-black dark:text-zinc-50">
      <aside className="hidden w-64 border-r bg-background md:block">
        <SidebarNav />
      </aside>

      <div className="flex flex-1 flex-col">
        <div className="flex items-center border-b bg-background px-2 md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost">菜单</Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0">
              <SidebarNav />
            </SheetContent>
          </Sheet>
          <div className="flex-1" />
        </div>
        <Topbar />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: lint**

Run：
```bash
pnpm -C web lint
```

- [ ] **Step 5: Commit**

```bash
git add web/components/shell
git commit -m "feat(web): add dashboard shell (sidebar + topbar)"
```

---

## Task 3: Route Group 重构（public/app 两套 layout）

**Files:**
- Move: `web/app/sign-in/page.tsx` → `web/app/(public)/sign-in/page.tsx`
- Move: `web/app/setup/page.tsx` → `web/app/(public)/setup/page.tsx`
- Move: `web/app/setup/layout.tsx` → `web/app/(public)/setup/layout.tsx`
- Move: `web/app/admin/jobs/page.tsx` → `web/app/(app)/admin/jobs/page.tsx`
- Move: `web/app/admin/layout.tsx` → `web/app/(app)/admin/layout.tsx`
- Create: `web/app/(app)/layout.tsx`
- Move: `web/app/page.tsx` → `web/app/(app)/page.tsx`
- (Optional) Replace `web/app/page.tsx` with a redirect stub (通常不需要；group 不影响 URL)
- Modify: `web/app/layout.tsx`（RootLayout 里加入 `<Toaster />`）

- [ ] **Step 1: 创建 `(app)` layout，包裹 AppShell**

Create `web/app/(app)/layout.tsx`：
```tsx
import { AppShell } from "@/components/shell/app-shell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
```

- [ ] **Step 2: RootLayout 加入 sonner Toaster（全局）**

Modify `web/app/layout.tsx`：
```tsx
import { Toaster } from "@/components/ui/sonner";

// in <body>:
<TRPCProvider>
  {children}
  <Toaster richColors />
</TRPCProvider>
```

- [ ] **Step 3: 移动页面到 route groups**

Run（示例，按实际路径执行 git mv）：
```bash
git mv web/app/sign-in web/app/(public)/sign-in
git mv web/app/setup web/app/(public)/setup
git mv web/app/admin web/app/(app)/admin
git mv web/app/page.tsx web/app/(app)/page.tsx
```

- [ ] **Step 4: 修复 import 路径（如果有相对路径）**

目标：所有内部引用统一走 `@/`（已配置为 `web/*`）。

- [ ] **Step 5: lint + dev smoke**

Run：
```bash
pnpm -C web lint
pnpm -C web dev
```
手工验证：
- 打开 `/sign-in` 能看到页面
- 未登录访问 `/admin/jobs` 被重定向到 `/sign-in?next=/admin/jobs`

- [ ] **Step 6: Commit**

```bash
git add web/app/layout.tsx web/app/(app) web/app/(public)
git commit -m "refactor(web): split routes into (public) and (app) groups"
```

---

## Task 4: `/sign-in` UI 重做（shadcn form 风格）

**Files:**
- Modify: `web/app/(public)/sign-in/page.tsx`

- [ ] **Step 1: 用 Card + Label + Input + Button 重构**

核心要求：
- 保留 `next` 参数与回跳逻辑
- 错误用 `sonner` toast 或页面内 Alert（任选其一）

实现建议（页面骨架）：
```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
```

- [ ] **Step 2: 手工验证**
- 未登录访问 `/` → 跳转到 `/sign-in?next=/`
- 登录后跳回 next

- [ ] **Step 3: lint + Commit**

```bash
pnpm -C web lint
git add web/app/(public)/sign-in/page.tsx
git commit -m "feat(web): restyle sign-in page with shadcn ui"
```

---

## Task 5: `/setup` UI 重做（并强化“入口已关闭”提示）

**Files:**
- Modify: `web/app/(public)/setup/page.tsx`
- Keep: `web/app/(public)/setup/layout.tsx`（已负责“初始化完成后关闭入口”）

- [ ] **Step 1: 用 Card + 表单组件重构**
- [ ] **Step 2: 初始化完成时的提示更清晰**
文案要求：
- “初始化已完成，入口已关闭，即将跳转到登录页”

- [ ] **Step 3: lint + Commit**

```bash
pnpm -C web lint
git add web/app/(public)/setup/page.tsx
git commit -m "feat(web): restyle setup page with shadcn ui"
```

---

## Task 6: `/admin/jobs` UI 重做（Table + Badge + Toast）

**Files:**
- Modify: `web/app/(app)/admin/jobs/page.tsx`

- [ ] **Step 1: 用 Table 展示 jobs**
建议字段：
- id / type / status（Badge）/ progress / attempts / updatedAt

- [ ] **Step 2: “触发 scan_full”按钮样式与 loading**
触发成功：toast “已入队”
触发失败：toast error

- [ ] **Step 3: 未登录/权限不足提示**
保留当前逻辑，但 UI 用 Card/Alert 风格，并给出：
`/sign-in?next=/admin/jobs`

- [ ] **Step 4: lint + Commit**

```bash
pnpm -C web lint
git add web/app/(app)/admin/jobs/page.tsx
git commit -m "feat(web): restyle jobs page with shadcn ui"
```

---

## Task 7: 登录后 `/` 的占位 Dashboard 页（套壳后不再丑）

**Files:**
- Modify: `web/app/(app)/page.tsx`

- [ ] **Step 1: 替换 create-next-app 默认内容**

建议内容：
- 一个欢迎 Card
- 两个快捷入口按钮：Jobs / Settings（后续替换为 Library/Tracks）

- [ ] **Step 2: lint + Commit**

```bash
pnpm -C web lint
git add web/app/(app)/page.tsx
git commit -m "feat(web): add basic dashboard home"
```

---

## Task 8: 最终验收（手工）

- [ ] **Step 1: 启动 dev**
```bash
pnpm -C web dev --hostname 0.0.0.0 --port 3000
```

- [ ] **Step 2: 关键流程**
1) 未登录访问 `/` → `/sign-in?next=/`
2) 登录后 → 回到 `/`，看到 Dashboard Shell
3) 访问 `/admin/jobs` → 正常展示表格；点击触发 scan_full → jobs 列表新增记录
4) 初始化完成后访问 `/setup` → 提示入口已关闭并跳 `/sign-in`

- [ ] **Step 3: 记录截图/可选**
（可选）在 PR/记录里放 3 张截图：`/sign-in`、`/`、`/admin/jobs`

