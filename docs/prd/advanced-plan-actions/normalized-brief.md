---
doc_type: normalized-brief
product: music-tagger
module: advanced-plan-actions
version: v0.1
source_refs:
  - docs/baseline/product-baseline.md
  - docs/baseline/module-baseline-current-capabilities.md
  - docs/prd/plan-workflow/summary.md
  - docs/prd/plan-workflow/admin-plans-page.md
  - docs/prd/plan-workflow/admin-plan-detail-page.md
  - docs/archive/raw-requirements/2026-04-01-local-music-manager-requirements.md
---

# Normalized Brief

## 1. 模块边界

- 模块名称：`advanced-plan-actions`
- 所属产品：`music-tagger`
- 目标：在现有 `plan-workflow` 骨架上继续扩展高风险整理动作。
- 当前优先动作：`move`
- 暂不进入本轮实现的动作：`delete`、`cover_write`、`lyrics_write`

## 2. 当前事实

- 当前代码已支持 `rename` 与基础 `tag_write` 的 `preview -> confirm -> execute` 主链路。
- 顶层页面入口已经存在：
  - `/admin/plans`
  - `/admin/plans/[planId]`
- 当前 worker 已有 `plan_execute` 执行器。
- 当前 `PlanItem` 已具备 `fromPath` / `toPath` / `warningsJson` / `status` 等字段，可承载 `move` 的路径 diff。

## 3. 本模块目标态

- 让管理员可以在 `/admin/plans` 创建 `move` 类型的 draft plan。
- 在 `/admin/plans/[planId]` 中生成 `move` 预览，明确显示旧路径与目标路径。
- 对以下风险进行预检查并在 preview 中显式提示：
  - 目标路径冲突
  - 目标目录越界到 `MUSIC_ROOT` 之外
  - 同路径无变化
  - 路径模板生成空目录或非法路径段
- 允许 `move` 复用当前 `confirm -> execute -> job -> worker` 主链路。

## 4. 路由与页面

- 顶层页面不新增，只扩展现有：
  - `/admin/plans`
  - `/admin/plans/[planId]`
- `创建 Plan` 仍然是 `/admin/plans` 页内抽屉，不新增独立路由。

## 5. 角色与权限

- 仅管理员可见、可创建、可预览、可确认、可执行。
- 普通用户不进入本模块。

## 6. `move` v1 范围

- `move` 只做“移动目录，不改文件名”：
  - 保留原文件名
  - 只改变目标目录
- 目标目录通过 `targetDirTemplate` 生成。
- `targetDirTemplate` 允许使用当前已有的基础字段变量：
  - `artist`
  - `albumArtist`
  - `album`
  - `year`
- `move` v1 不和 `rename` 组合执行。
- `move` v1 不做覆盖写入，冲突策略固定为阻断。

## 7. 需要影响的接口/层

- Web / tRPC：
  - `plans.create`
  - `plans.preview`
  - `plans.get`
  - `plans.items`
- Worker：
  - `plan_execute`
  - `plan_executor.py`
- Prisma：
  - 预期可复用现有 `Plan` / `PlanItem`
  - 如需新增 `params` 结构，不要求新增新表

## 8. 明确不做

- 不新增用户侧入口
- 不新增独立 `move` 页面
- 不在本轮直接实现 `delete`
- 不在本轮直接实现封面、歌词写回
- 不承诺强一致回滚
