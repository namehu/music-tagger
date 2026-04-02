import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect("/sign-in");

  const u = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (u?.role !== "admin") redirect("/sign-in");

  return children;
}

