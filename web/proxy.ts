import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

/**
 * Next.js 16 middleware-like proxy hook.
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ---- Allowlist: 静态资源与 API 永远放行 ----
  // Next internal assets
  if (pathname.startsWith("/_next/")) return NextResponse.next();
  // Common public assets
  if (pathname === "/favicon.ico") return NextResponse.next();
  // All API routes should be reachable (auth/trpc 需要）
  if (pathname.startsWith("/api/")) return NextResponse.next();

  // ---- Allowlist: 登录/初始化入口 ----
  // 初始化逻辑在 app/setup/layout.tsx（会查 DB）；proxy 不做 DB 查询
  if (pathname === "/setup" || pathname.startsWith("/setup/")) return NextResponse.next();
  // 登录页必须可访问
  if (pathname === "/sign-in") return NextResponse.next();

  // ---- 默认策略：除以上路径外，所有页面必须登录 ----
  // 这里仅做“是否登录”检查（不查 DB）；role 校验在 app/admin/layout.tsx
  {
    return auth.api
      .getSession({ headers: req.headers })
      .then((session) => {
        if (!session?.user?.id) {
          const url = req.nextUrl.clone();
          url.pathname = "/sign-in";
          url.searchParams.set("next", pathname);
          return NextResponse.redirect(url);
        }
        return NextResponse.next();
      })
      .catch(() => {
        const url = req.nextUrl.clone();
        url.pathname = "/sign-in";
        url.searchParams.set("next", pathname);
        return NextResponse.redirect(url);
      });
  }
}

export const config = {
  // 对所有页面请求生效（内部静态资源等会在上面 allowlist 放行）
  matcher: ["/:path*"],
};
