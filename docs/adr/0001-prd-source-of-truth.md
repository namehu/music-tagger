# ADR 0001: PRD 与代码的事实源边界

- 状态：accepted
- 日期：2026-04-03

## 背景

仓库中同时存在三类文档：

- 反映当前代码现状的 README / architecture 文档
- 早期设计稿和 implementation plan
- 尚未落地的未来模块设想

在这种状态下，如果没有统一的事实源规则，后续开发会出现两个问题：

- 旧设计稿被误当成当前事实
- 实现计划承担了产品定义职责，导致产品边界和工程拆分相互污染

## 决策

采用以下边界：

- 已实现能力：以代码、Prisma migrations、worker 行为为准
- 当前系统描述：以 `docs/baseline/*` 和 `docs/architecture.md` 为准
- 新能力与重构目标：以 `docs/prd/<module>/` 为准
- 任务拆解与实施顺序：以 `docs/implementation-plans/*` 为准

## 结果

正向效果：

- 文档分层明确
- PRD 可以只描述未来目标，不必重复当前事实
- 实施计划可以专注工程拆解

代价：

- 每次完成模块开发后需要回写 baseline
- 文档治理需要额外纪律成本

## 后续约束

- 没有模块 PRD 的跨模块需求，不进入开发
- 涉及 router / schema / worker contract 变更的需求，必须先更新模块 PRD 或 ADR
- README 不再承担需求白皮书职责
