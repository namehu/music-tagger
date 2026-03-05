"use client";
import { useState } from "react";
import { trpc } from "@/components/TRPCProvider";
import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

export default function ScanPage() {
  const [path, setPath] = useState("");
  const [status, setStatus] = useState<
    "idle" | "scanning" | "processing" | "completed"
  >("idle");
  const [progress, setProgress] = useState({ processed: 0, total: 0 });
  const [logs, setLogs] = useState<string[]>([]);

  const discoverMutation = trpc.scan.discover.useMutation();
  const processBatchMutation = trpc.scan.processBatch.useMutation();

  const addLog = (msg: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const handleScan = async () => {
    if (!path) return;

    setStatus("scanning");
    setLogs([]);
    addLog(`开始扫描目录: ${path}`);

    try {
      const { files, total } = await discoverMutation.mutateAsync({ path });
      addLog(`目录扫描完成，发现 ${total} 个文件`);

      if (total === 0) {
        setStatus("completed");
        return;
      }

      setStatus("processing");
      setProgress({ processed: 0, total });

      const BATCH_SIZE = 10;
      let processedCount = 0;

      for (let i = 0; i < total; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE);
        const { processed, failed } =
          await processBatchMutation.mutateAsync({ files: batch });
        processedCount += processed + failed; // count both as done for progress
        setProgress({ processed: processedCount, total });
        
        // Optional: log details if needed, but keeping it clean for now
      }

      addLog("所有文件处理完成");
      setStatus("completed");
    } catch (error) {
      console.error(error);
      addLog(`发生错误: ${error instanceof Error ? error.message : "Unknown error"}`);
      setStatus("idle"); // allow retry
    }
  };

  return (
    <main className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">扫描音乐</h1>
        <Link href="/" className="text-blue-600 hover:underline">
          返回首页
        </Link>
      </div>

      <div className="space-y-6">
        <div className="flex gap-4">
          <Input
            type="text"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="输入音乐目录路径 (例如: /Users/music)"
            className="flex-1"
            disabled={status !== "idle" && status !== "completed"}
          />
          <Button
            onClick={handleScan}
            disabled={status === "scanning" || status === "processing"}
          >
            {status === "scanning" || status === "processing" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {status === "scanning" ? "扫描目录..." : "处理中..."}
              </>
            ) : (
              "开始扫描"
            )}
          </Button>
        </div>

        {(status === "processing" || status === "completed") && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>处理进度</span>
              <span>
                {progress.processed} / {progress.total}
              </span>
            </div>
            <Progress
              value={
                progress.total > 0
                  ? (progress.processed / progress.total) * 100
                  : 0
              }
            />
          </div>
        )}

        <div className="border rounded-lg p-4 bg-gray-50">
          <h3 className="font-semibold mb-2">扫描日志</h3>
          <ScrollArea className="h-[300px] w-full rounded border bg-white p-4">
            {logs.length === 0 ? (
              <div className="text-gray-400 text-sm text-center py-8">
                暂无日志
              </div>
            ) : (
              <div className="space-y-1">
                {logs.map((log, i) => (
                  <div key={i} className="text-sm font-mono text-gray-600">
                    {log}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </main>
  );
}
