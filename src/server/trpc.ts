import { initTRPC, TRPCError } from '@trpc/server'
import superjson from 'superjson'
import { db } from '@/lib/db'
import { auth } from '@/lib/auth'

export const createTRPCContext = async (opts: { req: Request }) => {
  const session = await auth.api.getSession({
    headers: opts.req.headers
  })
  return { 
    db,
    session,
    user: session?.user
  }
}

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
})

export const router = t.router
export const publicProcedure = t.procedure

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session || !ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
      user: ctx.user,
    }
  })
})
