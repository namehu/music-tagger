---
doc_type: normalized-brief
product: music-tagger
module: setup-auth
version: v1
source_refs:
  - README.md
  - docs/architecture.md
  - docs/baseline/product-baseline.md
  - web/proxy.ts
  - web/app/(public)/sign-in/page.tsx
  - web/server/trpc/routers/setup.ts
---

# Normalized Brief

## 1. 产品与模块
- 产品名称：music-tagger
- 模块名称：Setup / Auth
- 业务目标：用 `/sign-in` 统一承载首个管理员初始化与登录，降低首次使用入口复杂度。

## 2. 角色与权限线索
| 角色 | 当前事实 | 待确认项 | 来源 |
| --- | --- | --- | --- |
| 未登录访客 | 可访问 `/sign-in`；未初始化时只能创建首个管理员 | 无 | web/proxy.ts |
| 已登录用户 | 默认进入 `/dashboard` | 无 | docs/baseline/product-baseline.md |
| 管理员 | 初始化后具备 `admin` 角色，可进入 `/admin` | 无 | web/lib/admin-init.ts |

## 3. 页面与从属交互清单
| 名称 | 类型 | 页面职责 | 归属页面/上游入口 | 下游去向 | 来源 |
| --- | --- | --- | --- | --- | --- |
| 登录与初始化页 | 独立页面 | 根据初始化状态显示创建管理员表单或登录表单 | `/sign-in` | `/dashboard` 或 `next` | web/app/(public)/sign-in/page.tsx |

## 4. 外部系统与依赖
| 依赖对象 | 依赖类型 | 影响范围 | 已知规则 | 待确认项 |
| --- | --- | --- | --- | --- |
| better-auth | 账号/session | 登录、创建账号 | 登录态由 session cookie 驱动 | 无 |
| Prisma/PostgreSQL | 数据库 | 初始化状态、用户角色 | 是否已有 admin 用户决定初始化状态 | 无 |

## 5. 状态与动作
| 实体 | 状态/动作 | 说明 | 来源 |
| --- | --- | --- | --- |
| 初始化状态 | `none / locking / done` | 未初始化、初始化中、已完成 | web/lib/admin-init.ts |
| 页面入口 | `/sign-in` | 唯一公开页面入口 | web/proxy.ts |

## 6. 字段与约束
| 字段 | 约束 | 默认值 | 适用页面 | 来源 |
| --- | --- | --- | --- | --- |
| email | 合法邮箱 | 无 | 初始化、登录 | web/lib/admin-init.ts |
| password | 初始化时至少 8 位；登录时必填 | 无 | 初始化、登录 | web/lib/admin-init.ts |
| name | 可选 | Admin | 初始化 | web/lib/admin-init.ts |

## 7. 冲突与缺口
| 类型 | 描述 | 影响范围 | 建议处理 |
| --- | --- | --- | --- |
| 无 | 当前需求已明确删除 `/setup` 页面入口 | Setup/Auth | 保持 `/sign-in` 为唯一入口 |
