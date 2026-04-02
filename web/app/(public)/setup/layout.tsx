import { redirect } from "next/navigation";

import { getAdminInitializationStatus } from "@/lib/admin-init";

export const dynamic = "force-dynamic";

export default async function SetupLayout({ children }: { children: React.ReactNode }) {
  const status = await getAdminInitializationStatus();
  if (status.initialized) {
    redirect("/sign-in");
  }

  return children;
}
