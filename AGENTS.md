# AGENTS.md

## 项目规范

### 技术栈

- **框架**: Next.js 16 (App Router)
- **API**: tRPC 11
- **数据库**: SQLite + Prisma
- **样式**: Tailwind CSS
- **状态管理**: Zustand
- **音频解析**: music-metadata

### Next.js 16 规范

1. **middleware.ts → proxy.ts** - 使用 `proxy.ts` 替代
2. **Async APIs** - params/cookies/headers 必须 await
3. **Turbopack** - 默认启用，无需 --turbopack 标志
4. **React 19.2** - 可使用 useEffectEvent, View Transitions

### 代码规范

- 使用 TypeScript strict 模式
- tRPC 路由放在 `src/server/routers/`
- 组件放在 `src/app/components/`
- 页面放在 `src/app/` 目录
- Prisma schema 放在 `prisma/schema.prisma`

### 命令

```bash
npm run dev      # 开发
npm run build    # 构建
npm run start    # 生产运行
npx prisma studio # 数据库可视化
```

### 开发流程

1. 修改代码后运行 `npm run build` 验证
2. 使用 systematic-debugging 技能调试问题
3. 使用 verification-before-completion 技能验证完成
