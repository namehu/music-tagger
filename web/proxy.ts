import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getAdminInitializationStatus } from "@/lib/admin-init";
import { auth } from "@/lib/auth";
import { getProxyRoutingDecision } from "@/lib/proxy-routing";

/**
 * Next.js 16 middleware-like proxy hook.
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ---- Allowlist: 静态资源与 API 永远放行 ----
  // Next internal assets
  if (pathname.startsWith("/_next/")) return NextResponse.next();
  // Next dev overlay / internal endpoints (e.g. /__nextjs_original-stack-frame)
  if (pathname.startsWith("/__")) return NextResponse.next();
  // Some dev tooling / browser extensions may request Vite-style endpoints (e.g. /@vite/client).
  // If we return HTML 404, it can break the whole page bootstrapping. Serve a tiny JS stub instead.
  if (pathname === "/@vite/client") {
    return new NextResponse("/* vite client stub (served by Next proxy) */\nexport {};\n", {
      headers: { "content-type": "application/javascript; charset=utf-8" },
    });
  }
  if (pathname.startsWith("/@")) return NextResponse.next();
  // Common public assets
  if (pathname === "/favicon.ico") return NextResponse.next();
  // All API routes should be reachable (auth/trpc 需要）
  if (pathname.startsWith("/api/")) return NextResponse.next();

  // ---- 页面入口：登录态优先，未登录时再判断是否完成初始化 ----
  // role 校验仍在 app/admin/layout.tsx，proxy 只决定是否能进入页面层。
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    const isLoggedIn = Boolean(session?.user?.id);
    const initStatus = isLoggedIn ? { initialized: true } : await getAdminInitializationStatus();
    const decision = getProxyRoutingDecision({
      pathname,
      search: req.nextUrl.search,
      isLoggedIn,
      initialized: initStatus.initialized,
    });

    if (decision.type === "next") {
      return NextResponse.next();
    }

    const url = req.nextUrl.clone();
    url.pathname = decision.pathname;
    url.search = "";
    for (const [key, value] of Object.entries(decision.searchParams ?? {})) {
      url.searchParams.set(key, value);
    }
    return NextResponse.redirect(url);
  } catch {
    const url = req.nextUrl.clone();
    url.pathname = "/sign-in";
    url.search = "";
    url.searchParams.set("next", `${pathname}${req.nextUrl.search}`);
    return NextResponse.redirect(url);
  }
}

export const config = {
  // 对所有页面请求生效（内部静态资源等会在上面 allowlist 放行）
  matcher: ["/:path*"],
};
