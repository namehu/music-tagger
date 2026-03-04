import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const sessionCookie = request.cookies.get("better-auth.session_token");
  
  // Define paths that don't require authentication
  const publicPaths = ["/auth/signin", "/auth/signup"];
  const isPublicPath = publicPaths.some(path => request.nextUrl.pathname.startsWith(path));

  if (!sessionCookie && !isPublicPath) {
    return NextResponse.redirect(new URL("/auth/signin", request.url));
  }
  
  if (sessionCookie && isPublicPath) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - covers (public images)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|covers).*)",
  ],
};