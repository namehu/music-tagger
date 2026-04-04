"use client";

import { toast } from "sonner";

import { trpc } from "@/app/_trpc/provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function formatDateTime(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
}

export default function IgnoredTracksPage() {
  const utils = trpc.useUtils();
  const ignoredQuery = trpc.ignoredTracks.listMine.useQuery({ limit: 200 });
  const unignoreMine = trpc.ignoredTracks.unignoreMine.useMutation({
    onSuccess: async () => {
      toast.success("已恢复到默认曲库");
      await Promise.all([
        ignoredQuery.refetch(),
        utils.tracks.list.invalidate(),
        utils.library.stats.invalidate(),
      ]);
    },
    onError: (error) => {
      toast.error(error.message ?? "解除忽略失败");
    },
  });

  const items = ignoredQuery.data ?? [];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">我的忽略</h1>
        <p className="text-sm text-muted-foreground">这些曲目会从默认曲库、搜索结果和歌单加歌候选中隐藏。</p>
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>已忽略曲目</CardTitle>
          <CardDescription>{items.length} 首曲目</CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="overflow-hidden rounded-2xl border bg-card/60">
            <Table>
              <TableHeader className="bg-muted/[0.45]">
                <TableRow>
                  <TableHead>标题</TableHead>
                  <TableHead>艺人</TableHead>
                  <TableHead>专辑</TableHead>
                  <TableHead>路径</TableHead>
                  <TableHead>忽略时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.track.title}</TableCell>
                    <TableCell>{item.track.artist}</TableCell>
                    <TableCell>{item.track.album ?? "-"}</TableCell>
                    <TableCell className="max-w-[24rem] truncate font-mono text-xs">{item.track.path}</TableCell>
                    <TableCell>{formatDateTime(item.createdAt)}</TableCell>
                    <TableCell className="w-28">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={unignoreMine.isPending}
                        onClick={() => unignoreMine.mutate({ trackId: item.trackId })}
                      >
                        解除忽略
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}

                {!ignoredQuery.isLoading && items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                      你还没有忽略任何曲目。
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
