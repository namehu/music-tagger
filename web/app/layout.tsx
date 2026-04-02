import type { Metadata } from "next";
import "./globals.css";
import { TRPCProvider } from "./_trpc/provider";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "本地音乐管理工具",
  description: "用于初始化管理员、触发扫描任务并浏览本地音乐库的控制台。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body suppressHydrationWarning className="min-h-full flex flex-col">
        <TRPCProvider>{children}</TRPCProvider>
        <Toaster richColors />
      </body>
    </html>
  );
}
