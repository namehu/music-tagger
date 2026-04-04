# Implementation Plans

本目录只存放已经有对应模块 PRD 的工程实施计划。

## 使用规则

- 先有 `docs/prd/<module>/`，再有 `docs/implementation-plans/<module>-implementation-plan.md`
- 实施计划不重复定义产品目标，只承接已确认 PRD
- 每份实施计划必须显式列出：
  - 受影响页面
  - 受影响 tRPC router
  - 受影响 Prisma schema / migrations
  - 受影响 worker / job contract
  - 测试与验收方式

## 推荐结构

1. 背景与目标
2. 影响范围
3. 任务拆分顺序
4. 数据与接口变更
5. 测试计划
6. 回写与验收

## 命名约定

- 文件名：`<module>-implementation-plan.md`
- 例如：`plan-workflow-implementation-plan.md`
