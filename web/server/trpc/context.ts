import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function createTRPCContext(opts: { req: Request }) {
  // IMPORTANT: 使用 tRPC 请求的原始 headers（包含 Cookie）
  // 这样 better-auth 才能正确读取 session cookie。
  const session = await auth.api.getSession({ headers: opts.req.headers });

  const userId = session?.user?.id ?? null;
  const user = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
        },
      })
    : null;

  return {
    session,
    user,
    prisma,
  };
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

