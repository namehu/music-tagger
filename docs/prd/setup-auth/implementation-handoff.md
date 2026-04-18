# Implementation Handoff

## 1. 影响范围

- 页面：`/sign-in` 合并初始化和登录；删除 `/setup`
- tRPC：保留 `setup.status` 与 `setup.createAdmin`
- Prisma：无 schema 变更
- Worker / Jobs：无影响

## 2. 数据与接口变更

| 类型 | 名称 | 变更说明 |
| --- | --- | --- |
| route | `/sign-in` | 唯一公开登录/初始化页面 |
| route | `/setup` | 删除独立页面入口 |
| route handler | `/api/setup/create-admin` | 删除，改用 tRPC 初始化 mutation |

## 3. 开发顺序

1. 更新 proxy 和安全 callback 路由工具。
2. 合并 `/sign-in` 页面并删除 `/setup` 页面。
3. 回写 baseline、PRD 和实现计划。
4. 跑测试、lint、build。

## 4. 测试与验收

- 正常流程：未初始化访问任意页面，进入 `/sign-in` 初始化，完成后登录。
- 权限失败：未登录访问业务页跳 `/sign-in`；已登录访问 `/sign-in` 跳 `/dashboard`。
- 异常流程：外部 URL、`/setup` callback 回退 `/dashboard`。
- 回归范围：用户区、管理区、better-auth 登录、tRPC 初始化。
