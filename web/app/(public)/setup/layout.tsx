import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";

export default async function SetupLayout({ children }: { children: React.ReactNode }) {
  // 若已初始化（admin_settings 单例存在且 state=done），则 /setup 不再可用
  const settings = await prisma.adminSettings.findUnique({
    where: { id: "singleton" },
    select: { dataJson: true },
  });

  if (settings) {
    try {
      const data = JSON.parse(settings.dataJson ?? "{}") as { state?: string };
      if (data.state === "done") redirect("/sign-in");
    } catch {
      // 如果 JSON 异常，也认为已初始化，避免重复初始化
      redirect("/sign-in");
    }
  }

  return children;
}

