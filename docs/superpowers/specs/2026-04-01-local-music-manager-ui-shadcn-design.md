# 本地音乐管理工具 — UI 重构（shadcn/ui + Dashboard Shell）设计稿

日期：2026-04-01  
状态：已确认（等待你 review 后进入实现计划）

## 1. 目标

1) 将当前“临时页面”升级为可持续扩展的后台工具 UI：**侧边栏 + 顶部栏（Dashboard Shell）**。  
2) 引入 **shadcn/ui** 作为组件体系，统一按钮/表单/提示/表格样式（Neutral / Zinc 基调）。  
3) 保持现有鉴权语义：**除 /sign-in、/setup、/api/*、静态资源外，其他页面必须登录**；未登录统一跳 `/sign-in?next=...`。

## 2. 范围（本次做什么 / 不做什么）

### 2.1 做什么（第一批落地页面）
- `/sign-in`：用 shadcn 表单组件重做，支持 `next` 回跳，错误提示用 toast/alert。
- `/setup`：用 shadcn 表单组件重做；初始化完成提示“入口已关闭”，自动引导 `/sign-in`。
- `/admin/jobs`：用 shadcn 的 Table/Badge/Button 重做列表与触发按钮；UNAUTHORIZED/FORBIDDEN 提示更友好并带 next。

### 2.2 不做什么（明确延后）
- Tracks/搜索/播放等业务功能页面：在 UI 壳稳定后进入下一阶段再做。
- 高级表格（排序/筛选/列设置/虚拟滚动）：先做基础 table，后续再升级 data-table。
- 主题系统深度定制（品牌色、复杂设计语言）：先用 Neutral/Zinc + 少量变量即可。

## 3. 路由与布局设计（Next.js App Router）

目标：**只有登录后的页面**使用 Dashboard Shell；登录/初始化页不套壳。

建议使用 Route Group（不影响 URL）：

- `app/(public)/sign-in/page.tsx`
- `app/(public)/setup/page.tsx`
- `app/(app)/layout.tsx`：Dashboard Shell（Sidebar + Topbar + Content）
- `app/(app)/page.tsx`：登录后的首页（后续做 Library 概览）
- `app/(app)/admin/jobs/page.tsx`

说明：
- 现有 `proxy.ts` 仍负责“是否登录”的统一拦截与 `next` 参数注入；`(app)` 组内再按需要做 admin role 校验（如 `admin/layout.tsx`）。

## 4. 组件与目录结构（不使用 src/）

目录约定（与当前工程一致）：
- `web/app/**`：路由、布局、页面
- `web/components/ui/**`：shadcn/ui 生成的基础组件（只放原子组件）
- `web/components/shell/**`：应用壳组件（Sidebar、Topbar、NavItem、UserMenu）
- `web/lib/**`：auth/prisma/client 之类基础设施
- `web/server/**`：tRPC server（routers/context）

## 5. Dashboard Shell 交互设计（布局 A）

### 5.1 Sidebar（左侧）
导航项（第一批）：
- Dashboard（占位，后续改成 Library 概览）
- Jobs（/admin/jobs）
- Settings（占位）

行为：
- 桌面端固定侧边栏
- 小屏端折叠为 Sheet（按钮打开）

### 5.2 Topbar（顶部）
包含：
- 当前页面标题
- 全局搜索入口（先放占位 input/button，后续接 tracks/search）
- 用户菜单（Avatar + Dropdown：Profile/Sign out）

## 6. shadcn/ui 引入策略

### 6.1 基础（第一批组件）
- `button` `input` `label` `card` `separator`
- `dropdown-menu` `avatar`
- `sheet`（移动端侧边栏）
- `table` `badge`
- `sonner`（toast）

### 6.2 风格
- 采用 shadcn 默认变量体系，Neutral/Zinc
- 优先用 Tailwind class 组合，不做大规模 CSS 覆盖

## 7. 验收标准（Definition of Done）

1) `/sign-in`、`/setup`、`/admin/jobs` 使用 shadcn/ui，视觉统一、可用性提升（按钮 loading、错误提示清晰）。  
2) 登录后进入 `/` 能看到 Dashboard Shell（侧边栏 + 顶部栏），导航到 Jobs 页面风格一致。  
3) 未登录访问任意非 allowlist 页面：重定向到 `/sign-in?next=...`，登录后可回跳。  
4) `pnpm -C web lint` 通过；基本的手工流程跑通：`/setup → /sign-in → /admin/jobs → 触发 job`。

