import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { appRouter } from "@/server/trpc/root";
import { createTRPCContext } from "@/server/trpc/context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function handler(req: Request) {
  const response = await fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ req }),
  });

  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");

  return response;
}

export { handler as GET, handler as POST };
