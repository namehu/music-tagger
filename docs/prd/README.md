---
doc_type: prd-governance
product: music-tagger
module: prd-system
version: v1
source_refs:
  - README.md
  - docs/architecture.md
  - docs/baseline/product-baseline.md
  - docs/baseline/module-baseline-current-capabilities.md
---

# Music Tagger PRD 驱动开发约定

## 1. 目标

本目录用于管理未来迭代的模块级 PRD。它只负责描述要做的能力、范围边界、状态机、权限、字段、验收和实现差距，不重复描述当前代码已经实现的事实。

当前项目采用以下治理规则：

- 当前事实以代码、Prisma migrations、worker 行为为准。
- 新能力与重构目标以模块级 PRD 为准。
- `README.md` 只做入口和索引，不承担需求定义职责。
- `docs/architecture.md` 只描述当前真实架构。
- `docs/baseline/*` 是所有 PRD 的事实起点。
- 原始需求稿、会议纪要、草案白皮书统一放入 `docs/archive/raw-requirements/`，只作为背景输入，不作为事实源。

## 2. 何时新建一个模块 PRD

满足以下任一条件时，新建一个模块目录：

- 新增一个独立交付能力，例如 `plan-workflow`、`playlist`、`ignored-tracks`
- 对现有模块做跨页面、跨 router、跨 worker 的系统性重构
- 需求会引入新的 Prisma model、新 job contract 或新的顶层路由

以下情况不要单独新建模块 PRD：

- 纯样式微调
- 仅单组件重构且不影响业务语义
- 仅修复实现 bug，且不改变行为边界

## 3. 固定文件矩阵

每个模块目录至少包含以下文件：

- `normalized-brief.md`
- `summary.md`
- 一个或多个 `*-page.md`
- `gaps-and-assumptions.md`
- `quality-report.md`

推荐额外包含：

- `implementation-handoff.md`

说明：

- 顶层 `*-page.md` 只对应可独立路由或可独立菜单访问的页面。
- 弹窗、抽屉、二次确认窗、页内面板默认归属父页面。
- 复杂页面内交互放在父页面同名目录下，例如 `admin-plans-page/dialogs/create-plan-dialog.md`。

## 4. 推荐工作流

1. 先更新或确认 `docs/baseline/*` 是否仍然准确。
2. 在 `docs/prd/<module>/` 下编写模块 PRD。
3. 明确该模块影响的页面、tRPC、Prisma、worker 和 job contract。
4. 审核 `gaps-and-assumptions.md`，未决项控制在 5 个以内。
5. 运行 PRD 结构校验脚本。
6. 基于已确认 PRD 在 `docs/implementation-plans/` 下产出实现计划。
7. 开发完成后回写：
   - 模块 PRD 状态
   - `docs/baseline/*`
   - 必要的 ADR

## 5. 状态流转

模块 PRD 推荐使用以下状态：

- `draft`：刚开始整理需求，允许存在待确认项
- `reviewed`：范围、页面边界、状态机、接口影响已锁定
- `implemented`：代码已完成并与文档对齐
- `partial`：部分实现，需在 `quality-report.md` 说明差距
- `archived`：能力被替代或合并

## 6. 与实现计划的边界

PRD 必须回答：

- 为什么做
- 谁能用
- 页面和交互边界是什么
- 成功与失败如何定义
- 会新增或改变哪些 public interface

实现计划必须回答：

- 具体改哪些目录、router、schema、worker
- 任务拆分顺序
- 测试和回归清单
- 发布与回写步骤

## 7. 命名约定

- 模块目录使用英文 kebab-case，例如 `plan-workflow`
- 页面文档使用路由语义，例如 `admin-plans-page.md`
- 文件正文使用中文
- frontmatter 中 `source_refs` 必须列出事实来源

## 8. 校验命令

```bash
python3 /Users/namehu/mm_code/mm-agents/codex-skills/prd-structuring-agent/references/prd-agent-kit/scripts/validate_prd_package.py docs/prd/<module>
```

## 9. 当前优先级最高的模块

- `plan-workflow`
- `advanced-plan-actions`
- `playback-session-sync`
