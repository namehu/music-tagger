"use client";

import React from "react";
import { toast } from "sonner";

import { trpc } from "@/app/_trpc/provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function formatDateTime(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
}

export default function AdminIgnoredTracksPage() {
  const utils = trpc.useUtils();
  const [selectedTrackIds, setSelectedTrackIds] = React.useState<string[]>([]);
  const ignoredQuery = trpc.ignoredTracks.listGlobal.useQuery({ limit: 200 });
  const unignoreGlobal = trpc.ignoredTracks.unignoreGlobal.useMutation({
    onSuccess: async () => {
      toast.success("已解除全局忽略");
      await Promise.all([
        ignoredQuery.refetch(),
        utils.tracks.list.invalidate(),
        utils.library.stats.invalidate(),
      ]);
    },
    onError: (error) => {
      toast.error(error.message ?? "解除全局忽略失败");
    },
  });
  const batchUnignoreGlobal = trpc.ignoredTracks.batchUnignoreGlobal.useMutation({
    onSuccess: async (result) => {
      toast.success(`已解除 ${result.affectedCount} 首曲目的全局忽略`);
      setSelectedTrackIds([]);
      await Promise.all([
        ignoredQuery.refetch(),
        utils.tracks.list.invalidate(),
        utils.library.stats.invalidate(),
      ]);
    },
    onError: (error) => {
      toast.error(error.message ?? "批量解除失败");
    },
  });

  const items = React.useMemo(() => ignoredQuery.data ?? [], [ignoredQuery.data]);
  const allSelected = items.length > 0 && selectedTrackIds.length === items.length;
  const selectionState = allSelected ? true : selectedTrackIds.length > 0 ? ("indeterminate" as const) : false;

  React.useEffect(() => {
    const visible = new Set(items.map((item) => item.trackId));
    setSelectedTrackIds((current) => current.filter((trackId) => visible.has(trackId)));
  }, [items]);

  function toggleTrack(trackId: string) {
    setSelectedTrackIds((current) =>
      current.includes(trackId) ? current.filter((value) => value !== trackId) : [...current, trackId],
    );
  }

  function toggleAll() {
    if (allSelected) {
      setSelectedTrackIds([]);
      return;
    }

    setSelectedTrackIds(items.map((item) => item.trackId));
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">全局忽略</h1>
        <p className="text-sm text-muted-foreground">这里管理对所有用户默认隐藏的曲目。管理区和用户区的默认曲库都会过滤这些曲目。</p>
      </div>

      <Card>
        <CardHeader className="border-b">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>已全局忽略曲目</CardTitle>
              <CardDescription>{items.length} 首曲目</CardDescription>
            </div>
            {selectedTrackIds.length > 0 ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={batchUnignoreGlobal.isPending}
                onClick={() => batchUnignoreGlobal.mutate({ trackIds: selectedTrackIds })}
              >
                批量解除 {selectedTrackIds.length} 首
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="overflow-hidden rounded-2xl border bg-card/60">
            <Table>
              <TableHeader className="bg-muted/[0.45]">
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox checked={selectionState} aria-label="选择全部忽略曲目" onChange={toggleAll} />
                  </TableHead>
                  <TableHead>标题</TableHead>
                  <TableHead>艺人</TableHead>
                  <TableHead>专辑</TableHead>
                  <TableHead>设置人</TableHead>
                  <TableHead>忽略时间</TableHead>
                  <TableHead>路径</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedTrackIds.includes(item.trackId)}
                        aria-label={`选择 ${item.track.title}`}
                        onChange={() => toggleTrack(item.trackId)}
                      />
                    </TableCell>
                    <TableCell>{item.track.title}</TableCell>
                    <TableCell>{item.track.artist}</TableCell>
                    <TableCell>{item.track.album ?? "-"}</TableCell>
                    <TableCell>{item.createdBy.name}</TableCell>
                    <TableCell>{formatDateTime(item.createdAt)}</TableCell>
                    <TableCell className="max-w-[20rem] truncate font-mono text-xs">{item.track.path}</TableCell>
                    <TableCell className="w-28">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={unignoreGlobal.isPending}
                        onClick={() => unignoreGlobal.mutate({ trackId: item.trackId })}
                      >
                        解除
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}

                {!ignoredQuery.isLoading && items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                      当前没有全局忽略曲目。
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
