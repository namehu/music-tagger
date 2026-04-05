"use client";

import React from "react";
import { toast } from "sonner";

import { trpc } from "@/app/_trpc/provider";
import {
  getPlaybackStoreState,
  usePlaybackSession,
  type PlaybackSessionKind,
} from "@/store/playback-store";

function getJobErrorMessage(errorJson: string | null | undefined) {
  if (!errorJson) {
    return "转码任务失败，请稍后重试";
  }

  try {
    const parsed = JSON.parse(errorJson) as { message?: string };
    if (parsed.message?.trim()) {
      return `转码任务失败：${parsed.message}`;
    }
  } catch {
    return "转码任务失败，请稍后重试";
  }

  return "转码任务失败，请稍后重试";
}

export function PlaybackRuntime({ sessionKind }: { sessionKind: PlaybackSessionKind }) {
  const resolveRequest = usePlaybackSession(sessionKind, (state) => state.resolveRequest);
  const preparingJobId = usePlaybackSession(sessionKind, (state) => state.preparingJobId);
  const preparingRequest = usePlaybackSession(sessionKind, (state) => state.preparingRequest);
  const playbackError = usePlaybackSession(sessionKind, (state) => state.playbackError);
  const resolvePlayback = trpc.playback.resolve.useMutation();
  const preparingJobQuery = trpc.playback.getPreparationStatus.useQuery(
    {
      jobId: preparingJobId ?? "",
    },
    {
      enabled: Boolean(preparingJobId),
      refetchOnWindowFocus: false,
      retry: false,
      refetchInterval: (query) => {
        const status = query.state.data?.status;
        if (!preparingJobId || status === "done" || status === "failed" || status === "cancelled") {
          return false;
        }

        return 1500;
      },
    },
  );
  const lastToastedErrorRef = React.useRef<string | null>(null);
  const submittedResolveSeqRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (!resolveRequest) {
      return;
    }

    // tRPC mutation 状态变更和 React Strict Mode 都可能让 effect 重新进入；
    // 同一个 seq 只能真正提交一次 resolve，避免同一首歌被重复请求。
    if (submittedResolveSeqRef.current === resolveRequest.seq) {
      return;
    }

    submittedResolveSeqRef.current = resolveRequest.seq;

    const state = getPlaybackStoreState();
    resolvePlayback.mutate(
      {
        trackId: resolveRequest.track.id,
        profile: resolveRequest.profile,
      },
      {
        onSuccess: (result) => {
          const latestRequest = getPlaybackStoreState().sessions[sessionKind].resolveRequest;
          if (!latestRequest || latestRequest.seq !== resolveRequest.seq) {
            return;
          }

          if (result.status === "preparing") {
            state.writeResolvePreparing(sessionKind, {
              seq: resolveRequest.seq,
              jobId: result.jobId,
            });
            return;
          }

          state.writeResolvedPlayback(sessionKind, {
            seq: resolveRequest.seq,
            url: result.url,
          });
        },
        onError: (error) => {
          getPlaybackStoreState().handleResolveFailure(sessionKind, {
            seq: resolveRequest.seq,
            message: error.message ?? "播放地址解析失败",
            clearSession: getPlaybackStoreState().sessions[sessionKind].resumeLock,
          });
        },
      },
    );
  }, [resolvePlayback, resolveRequest, sessionKind]);

  React.useEffect(() => {
    if (resolveRequest) {
      return;
    }

    submittedResolveSeqRef.current = null;
  }, [resolveRequest]);

  React.useEffect(() => {
    if (!preparingJobId || !preparingRequest) {
      return;
    }

    const currentJob = preparingJobQuery.data;
    if (!currentJob || currentJob.id !== preparingJobId) {
      return;
    }

    if (currentJob.status === "done") {
      getPlaybackStoreState().retryPreparingRequest(sessionKind);
      return;
    }

    if (currentJob.status === "failed" || currentJob.status === "cancelled") {
      getPlaybackStoreState().handlePreparingFailure(
        sessionKind,
        getJobErrorMessage(currentJob.errorJson),
      );
    }
  }, [preparingJobId, preparingJobQuery.data, preparingRequest, sessionKind]);

  React.useEffect(() => {
    if (!preparingJobId || !preparingJobQuery.error) {
      return;
    }

    getPlaybackStoreState().handlePreparingFailure(
      sessionKind,
      preparingJobQuery.error.message ?? "转码任务状态查询失败",
    );
  }, [preparingJobId, preparingJobQuery.error, sessionKind]);

  React.useEffect(() => {
    if (!playbackError || playbackError === lastToastedErrorRef.current) {
      return;
    }

    lastToastedErrorRef.current = playbackError;
    toast.error(playbackError);
  }, [playbackError]);

  React.useEffect(() => {
    function handlePageHide() {
      const state = getPlaybackStoreState();
      const audio = state.sessions[sessionKind].audioElement;
      if (!audio) {
        return;
      }

      state.syncProgressSnapshot(sessionKind, audio.currentTime, true);
    }

    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, [sessionKind]);

  return null;
}
