"use client";

import React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { trpc } from "@/app/_trpc/provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  getTrackEditSyncStatusLabel,
  toNullableInt,
  type TrackEditDomain,
  type TrackEditSyncStatus,
} from "@/lib/track-edits";
import { getTrackEditStatusCopy, type TrackEditLatestJob } from "@/lib/track-edit-failures";
import {
  TRACK_LYRICS_FORMATS,
  getTrackLyricsFormatLabel,
  type TrackLyricsFormat,
} from "@/lib/lyrics";

function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function SyncBadge(props: { status: TrackEditSyncStatus }) {
  const variant =
    props.status === "failed"
      ? "destructive"
      : props.status === "synced"
        ? "secondary"
        : "outline";
  return <Badge variant={variant}>{getTrackEditSyncStatusLabel(props.status)}</Badge>;
}

function TrackEditStatusPanel(props: {
  domain: TrackEditDomain;
  status: TrackEditSyncStatus;
  latestJob: TrackEditLatestJob;
  syncError: string | null;
  requestedAt?: string | Date | null;
  finishedAt?: string | Date | null;
  onRetry?: () => void;
  onOpenJobs: () => void;
}) {
  const copy = getTrackEditStatusCopy({
    domain: props.domain,
    status: props.status,
    latestJob: props.latestJob,
    errorJson: props.syncError,
  });
  const latestAt = props.latestJob?.updatedAt ?? props.finishedAt ?? props.requestedAt ?? null;
  const isFailed = props.status === "failed";
  const primaryAction =
    isFailed && copy.canRetry && props.onRetry
      ? (
        <Button type="button" variant="outline" size="sm" onClick={props.onRetry}>
          重试同步
        </Button>
      )
      : isFailed
        ? (
          <Button type="button" variant="outline" size="sm" onClick={props.onOpenJobs}>
            去 Jobs 查看详情
          </Button>
        )
        : null;

  return (
    <div className="rounded-2xl border bg-muted/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <SyncBadge status={props.status} />
            <span className="text-sm font-medium">{copy.title}</span>
          </div>
          <div className="text-sm text-muted-foreground">{copy.detail}</div>
        </div>
        {primaryAction}
      </div>
      <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          最近结果：{props.latestJob?.errorSummary ?? (props.status === "synced" ? "同步成功" : props.status === "syncing" ? "正在处理" : "已提交")}
        </div>
        <div>{latestAt ? `最近更新时间：${formatDateTime(latestAt)}` : "最近更新时间：-"}</div>
      </div>
      <div className="mt-2 text-sm">{copy.recommendation}</div>
      {isFailed ? (
        <button type="button" className="mt-2 text-xs text-muted-foreground underline-offset-4 hover:underline" onClick={props.onOpenJobs}>
          查看 Jobs 中的原始错误详情
        </button>
      ) : null}
    </div>
  );
}

export function TrackEditSheet(props: {
  trackId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [metadataForm, setMetadataForm] = React.useState({
    title: "",
    artist: "",
    album: "",
    albumArtist: "",
    trackNo: "",
    discNo: "",
    year: "",
    genre: "",
  });
  const [lyricsText, setLyricsText] = React.useState("");
  const [lyricsFormat, setLyricsFormat] = React.useState<TrackLyricsFormat>("plain");
  const [coverUploadKey, setCoverUploadKey] = React.useState(0);
  const trackQuery = trpc.trackEdits.get.useQuery(
    { trackId: props.trackId ?? "" },
    {
      enabled: props.open && props.trackId != null,
    },
  );

  const saveMetadata = trpc.trackEdits.saveMetadata.useMutation({
    onSuccess: async () => {
      toast.success("元数据已保存，后台会继续写回音频文件");
      await Promise.all([
        trackQuery.refetch(),
        utils.tracks.list.invalidate(),
        utils.library.dashboard.invalidate(),
        utils.library.stats.invalidate(),
        utils.playlists.invalidate(),
      ]);
    },
    onError: (error) => {
      toast.error(error.message ?? "元数据保存失败");
    },
  });

  const resetMetadata = trpc.trackEdits.resetMetadata.useMutation({
    onSuccess: async () => {
      toast.success("已恢复为扫描值，后台会继续把文件标签同步回去");
      await Promise.all([
        trackQuery.refetch(),
        utils.tracks.list.invalidate(),
        utils.library.dashboard.invalidate(),
        utils.library.stats.invalidate(),
        utils.playlists.invalidate(),
      ]);
    },
    onError: (error) => {
      toast.error(error.message ?? "恢复扫描值失败");
    },
  });

  const saveLyrics = trpc.trackEdits.saveLyrics.useMutation({
    onSuccess: async () => {
      toast.success("歌词已保存，后台会继续写回音频文件");
      await Promise.all([trackQuery.refetch(), utils.tracks.list.invalidate()]);
    },
    onError: (error) => {
      toast.error(error.message ?? "歌词保存失败");
    },
  });

  const clearLyrics = trpc.trackEdits.clearLyrics.useMutation({
    onSuccess: async () => {
      toast.success("歌词已清空，后台会继续同步到音频文件");
      await Promise.all([trackQuery.refetch(), utils.tracks.list.invalidate()]);
    },
    onError: (error) => {
      toast.error(error.message ?? "清空歌词失败");
    },
  });

  const removeCover = trpc.trackEdits.removeCover.useMutation({
    onSuccess: async () => {
      toast.success("封面已移除，后台会继续同步到音频文件");
      setCoverUploadKey((current) => current + 1);
      await Promise.all([trackQuery.refetch(), utils.tracks.list.invalidate()]);
    },
    onError: (error) => {
      toast.error(error.message ?? "移除封面失败");
    },
  });

  const retrySync = trpc.trackEdits.retrySync.useMutation({
    onSuccess: async () => {
      toast.success("已重新提交同步任务");
      await Promise.all([trackQuery.refetch(), utils.tracks.list.invalidate(), utils.jobs.list.invalidate()]);
    },
    onError: (error) => {
      toast.error(error.message ?? "重试同步失败");
    },
  });

  React.useEffect(() => {
    if (!trackQuery.data) {
      return;
    }

    const values = trackQuery.data.metadata.values;
    setMetadataForm({
      title: values.title ?? "",
      artist: values.artist ?? "",
      album: values.album ?? "",
      albumArtist: values.albumArtist ?? "",
      trackNo: values.trackNo != null ? String(values.trackNo) : "",
      discNo: values.discNo != null ? String(values.discNo) : "",
      year: values.year != null ? String(values.year) : "",
      genre: values.genre ?? "",
    });
    setLyricsText(trackQuery.data.lyrics.text ?? "");
    setLyricsFormat(trackQuery.data.lyrics.format);
  }, [trackQuery.data]);

  async function handleCoverUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !props.trackId) {
      return;
    }

    const formData = new FormData();
    formData.set("file", file);
    const response = await fetch(`/api/admin/tracks/${props.trackId}/cover`, {
      method: "POST",
      body: formData,
    });

    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    if (!response.ok) {
      toast.error(payload?.message ?? "封面上传失败");
      setCoverUploadKey((current) => current + 1);
      return;
    }

    toast.success("封面已保存，后台会继续写回音频文件");
    setCoverUploadKey((current) => current + 1);
    await Promise.all([trackQuery.refetch(), utils.tracks.list.invalidate()]);
  }

  function triggerRetry(domain: TrackEditDomain) {
    if (!props.trackId) {
      return;
    }

    retrySync.mutate({
      trackId: props.trackId,
      domain,
    });
  }

  function openJobs() {
    router.push("/admin/jobs");
  }

  const track = trackQuery.data?.track;
  const metadata = trackQuery.data?.metadata;
  const lyrics = trackQuery.data?.lyrics;
  const cover = trackQuery.data?.cover;

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto px-0 sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>编辑曲目</SheetTitle>
          <SheetDescription>
            保存后会先立即更新数据库，再由后台异步写回音频文件。这里不再走 Plan 式预览和审批流程。
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 px-5 pb-6 pt-2">
          {trackQuery.isLoading ? (
            <div className="rounded-2xl border bg-muted/20 p-4 text-sm text-muted-foreground">正在加载曲目编辑数据…</div>
          ) : null}

          {track ? (
            <>
              <div className="rounded-2xl border bg-muted/20 p-4 text-sm">
                <div className="font-medium">{track.display.title}</div>
                <div className="mt-1 text-muted-foreground">{track.display.artist}</div>
                <div className="mt-2 truncate font-mono text-xs text-muted-foreground">{track.path}</div>
              </div>

              <section className="space-y-4 rounded-2xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium">元数据</h3>
                    <p className="text-sm text-muted-foreground">标题、艺人、专辑等字段会立即以数据库值为准。</p>
                  </div>
                  {metadata?.hasEdit ? (
                    <SyncBadge status={metadata.syncStatus as TrackEditSyncStatus} />
                  ) : (
                    <Badge variant="outline">当前使用扫描值</Badge>
                  )}
                </div>
                {metadata ? (
                  <TrackEditStatusPanel
                    domain="metadata"
                    status={metadata.syncStatus as TrackEditSyncStatus}
                    latestJob={metadata.latestJob}
                    syncError={metadata.syncError}
                    requestedAt={metadata.syncRequestedAt}
                    finishedAt={metadata.syncFinishedAt}
                    onRetry={metadata.syncStatus === "failed" ? () => triggerRetry("metadata") : undefined}
                    onOpenJobs={openJobs}
                  />
                ) : null}
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="track-title">标题</Label>
                    <Input
                      id="track-title"
                      value={metadataForm.title}
                      onChange={(event) => setMetadataForm((current) => ({ ...current, title: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="track-artist">艺人</Label>
                    <Input
                      id="track-artist"
                      value={metadataForm.artist}
                      onChange={(event) => setMetadataForm((current) => ({ ...current, artist: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="track-album">专辑</Label>
                    <Input
                      id="track-album"
                      value={metadataForm.album}
                      onChange={(event) => setMetadataForm((current) => ({ ...current, album: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="track-album-artist">专辑艺人</Label>
                    <Input
                      id="track-album-artist"
                      value={metadataForm.albumArtist}
                      onChange={(event) =>
                        setMetadataForm((current) => ({ ...current, albumArtist: event.target.value }))
                      }
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="track-track-no">Track No</Label>
                      <Input
                        id="track-track-no"
                        inputMode="numeric"
                        value={metadataForm.trackNo}
                        onChange={(event) => setMetadataForm((current) => ({ ...current, trackNo: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="track-disc-no">Disc No</Label>
                      <Input
                        id="track-disc-no"
                        inputMode="numeric"
                        value={metadataForm.discNo}
                        onChange={(event) => setMetadataForm((current) => ({ ...current, discNo: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="track-year">年份</Label>
                      <Input
                        id="track-year"
                        inputMode="numeric"
                        value={metadataForm.year}
                        onChange={(event) => setMetadataForm((current) => ({ ...current, year: event.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="track-genre">流派</Label>
                    <Input
                      id="track-genre"
                      value={metadataForm.genre}
                      onChange={(event) => setMetadataForm((current) => ({ ...current, genre: event.target.value }))}
                    />
                  </div>
                </div>
                <SheetFooter className="gap-2 sm:justify-between">
                  <div className="text-xs text-muted-foreground">
                    当前展示来源：{metadata?.hasEdit ? "编辑值" : "扫描值"}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={resetMetadata.isPending}
                      onClick={() => props.trackId && resetMetadata.mutate({ trackId: props.trackId })}
                    >
                      恢复扫描值
                    </Button>
                    <Button
                      type="button"
                      disabled={saveMetadata.isPending}
                      onClick={() =>
                        props.trackId &&
                        saveMetadata.mutate({
                          trackId: props.trackId,
                          title: metadataForm.title.trim() || null,
                          artist: metadataForm.artist.trim() || null,
                          album: metadataForm.album.trim() || null,
                          albumArtist: metadataForm.albumArtist.trim() || null,
                          trackNo: toNullableInt(metadataForm.trackNo),
                          discNo: toNullableInt(metadataForm.discNo),
                          year: toNullableInt(metadataForm.year),
                          genre: metadataForm.genre.trim() || null,
                        })
                      }
                    >
                      {saveMetadata.isPending ? "保存中…" : "保存元数据"}
                    </Button>
                  </div>
                </SheetFooter>
              </section>

              <section className="space-y-4 rounded-2xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium">歌词</h3>
                    <p className="text-sm text-muted-foreground">保存后立即以数据库结果显示，再异步嵌入音频文件。</p>
                  </div>
                  {lyrics?.hasEdit ? (
                    <SyncBadge status={lyrics.syncStatus as TrackEditSyncStatus} />
                  ) : lyrics?.source === "scan" ? (
                    <Badge variant="outline">当前使用扫描值</Badge>
                  ) : (
                    <Badge variant="outline">未设置</Badge>
                  )}
                </div>
                {lyrics ? (
                  <TrackEditStatusPanel
                    domain="lyrics"
                    status={lyrics.syncStatus as TrackEditSyncStatus}
                    latestJob={lyrics.latestJob}
                    syncError={lyrics.syncError}
                    requestedAt={lyrics.syncRequestedAt}
                    finishedAt={lyrics.syncFinishedAt}
                    onRetry={lyrics.syncStatus === "failed" ? () => triggerRetry("lyrics") : undefined}
                    onOpenJobs={openJobs}
                  />
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor="track-lyrics-format">歌词格式</Label>
                  <select
                    id="track-lyrics-format"
                    value={lyricsFormat}
                    onChange={(event) => setLyricsFormat(event.target.value as TrackLyricsFormat)}
                    className="h-9 w-full rounded-xl border bg-transparent px-3 text-sm outline-none"
                  >
                    {TRACK_LYRICS_FORMATS.map((format) => (
                      <option key={format} value={format}>
                        {getTrackLyricsFormatLabel(format)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="track-lyrics">歌词正文</Label>
                  <textarea
                    id="track-lyrics"
                    value={lyricsText}
                    onChange={(event) => setLyricsText(event.target.value)}
                    className="min-h-48 w-full rounded-xl border bg-transparent px-3 py-2 text-sm outline-none"
                    placeholder="这里填写要保存到数据库并异步写回文件的歌词文本；LRC / 增强 LRC 也可以直接贴原文。"
                  />
                </div>
                <SheetFooter className="gap-2 sm:justify-between">
                  <div className="text-xs text-muted-foreground">
                    当前展示来源：{lyrics?.hasEdit ? "编辑值" : lyrics?.source === "scan" ? "扫描值" : "未设置"} · 当前格式：{getTrackLyricsFormatLabel(lyricsFormat)}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={clearLyrics.isPending}
                      onClick={() => props.trackId && clearLyrics.mutate({ trackId: props.trackId })}
                    >
                      清空歌词
                    </Button>
                    <Button
                      type="button"
                      disabled={saveLyrics.isPending}
                      onClick={() =>
                        props.trackId &&
                        saveLyrics.mutate({
                          trackId: props.trackId,
                          lyricsText: lyricsText.trim().length > 0 ? lyricsText : null,
                          format: lyricsFormat,
                        })
                      }
                    >
                      {saveLyrics.isPending ? "保存中…" : "保存歌词"}
                    </Button>
                  </div>
                </SheetFooter>
              </section>

              <section className="space-y-4 rounded-2xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium">封面</h3>
                    <p className="text-sm text-muted-foreground">封面资产保存在应用目录里，再由后台异步嵌入音频文件。</p>
                  </div>
                  {cover?.hasEdit ? (
                    <SyncBadge status={cover.syncStatus as TrackEditSyncStatus} />
                  ) : cover?.source === "scan" ? (
                    <Badge variant="outline">当前使用扫描值</Badge>
                  ) : (
                    <Badge variant="outline">未设置</Badge>
                  )}
                </div>
                {cover ? (
                  <TrackEditStatusPanel
                    domain="cover"
                    status={cover.syncStatus as TrackEditSyncStatus}
                    latestJob={cover.latestJob}
                    syncError={cover.syncError}
                    requestedAt={cover.syncRequestedAt}
                    finishedAt={cover.syncFinishedAt}
                    onRetry={cover.syncStatus === "failed" ? () => triggerRetry("cover") : undefined}
                    onOpenJobs={openJobs}
                  />
                ) : null}
                {cover?.assetUrl ? (
                  <div className="overflow-hidden rounded-2xl border">
                    <Image
                      src={cover.assetUrl}
                      alt={`${track.display.title} 封面`}
                      width={320}
                      height={320}
                      unoptimized
                      className="aspect-square w-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                    当前没有封面
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
                  <div className="space-y-2">
                    <Label htmlFor="track-cover-upload">上传封面</Label>
                    <Input
                      key={coverUploadKey}
                      id="track-cover-upload"
                      type="file"
                      accept="image/jpeg,image/png"
                      onChange={handleCoverUpload}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    当前展示来源：{cover?.hasEdit ? "编辑值" : cover?.source === "scan" ? "扫描值" : "未设置"}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={removeCover.isPending}
                    onClick={() => props.trackId && removeCover.mutate({ trackId: props.trackId })}
                  >
                    移除封面
                  </Button>
                </div>
              </section>

              <Separator />

              <div className="rounded-2xl border bg-muted/20 p-4">
                <div className="text-sm font-medium">扫描观察</div>
                <div className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                  <div>歌词：{track.lyricsObservation.kind ? "已扫描到" : "未扫描到"}</div>
                  <div>封面：{track.artworkObservation.kind ? "已扫描到" : "未扫描到"}</div>
                  <div>当前歌词来源：{lyrics?.hasEdit ? "编辑值" : lyrics?.source === "scan" ? "扫描值" : "未设置"}</div>
                  <div>当前封面来源：{cover?.hasEdit ? "编辑值" : cover?.source === "scan" ? "扫描值" : "未设置"}</div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
