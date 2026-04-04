import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { DEFAULT_SIGNED_IN_PATH, SIGN_IN_PATH } from "@/lib/app-routes";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type AppViewer = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
};

export async function getViewerOrRedirect() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    redirect(SIGN_IN_PATH);
  }

  const viewer = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
    },
  });

  if (!viewer) {
    redirect(SIGN_IN_PATH);
  }

  return viewer satisfies AppViewer;
}

export async function getAdminViewerOrRedirect() {
  const viewer = await getViewerOrRedirect();
  if (viewer.role !== "admin") {
    redirect(DEFAULT_SIGNED_IN_PATH);
  }

  return viewer;
}
