# Setup/Auth 登录初始化合并实现计划

## Summary

- `/sign-in` 成为唯一公开页面入口。
- 未初始化时显示创建首个管理员表单；初始化后显示登录表单。
- 删除 `/setup` 页面与 `/api/setup/create-admin` Route Handler。

## Implementation Changes

- `web/proxy.ts`：页面请求先查 session；未登录时查初始化状态，并统一重定向到 `/sign-in`。
- `web/app/(public)/sign-in/*`：服务端读取初始化状态，客户端根据状态渲染初始化或登录表单。
- `web/lib/app-routes.ts`：安全解析内部 callback，拒绝外部 URL 和旧 `/setup` callback。
- `web/lib/proxy-routing.ts`：抽出可测试的 proxy 页面路由决策。
- 文档：同步 README、架构、baseline、PRD 和部署教程。

## Test Plan

- `pnpm test:web`
- `pnpm lint:web`
- `pnpm build:web`
- 手动验收未初始化、已初始化、已登录、旧 `/setup` 访问和带 query 的 `next` 回跳。

## Assumptions

- 初始化成功后不自动登录。
- API 路径仍由各自 handler/procedure 鉴权，proxy 不拦截 API。
- `/setup` 不是可访问页面，只作为旧 callback 的安全回退处理。
