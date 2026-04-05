"use client";

import React from "react";
import Liricle from "liricle";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TrackLyricsFormat } from "@/lib/lyrics";

type LyricsWord = {
  index?: number;
  time: number;
  text: string;
};

type LyricsLine = {
  index?: number;
  time: number;
  text: string;
  words?: LyricsWord[] | null;
};

type LyricsData = {
  lines: LyricsLine[];
  enhanced: boolean;
};

function normalizeLyricsData(data: LyricsData | null) {
  if (!data) {
    return { lines: [] as LyricsLine[], enhanced: false };
  }

  return {
    enhanced: data.enhanced,
    lines: data.lines.map((line, index) => ({
      ...line,
      index,
      words: line.words?.map((word, wordIndex) => ({
        ...word,
        index: wordIndex,
      })) ?? null,
    })),
  };
}

export function LyricsPanel(props: {
  lyricsText: string | null | undefined;
  lyricsFormat: TrackLyricsFormat;
  currentTimeSec: number;
  isPlaying: boolean;
  onSeekTo: (nextTimeSec: number) => void;
  className?: string;
}) {
  const virtuosoRef = React.useRef<VirtuosoHandle | null>(null);
  const liricleRef = React.useRef<Liricle | null>(null);
  const autoFollowPausedUntilRef = React.useRef(0);
  const [lyricsData, setLyricsData] = React.useState<ReturnType<typeof normalizeLyricsData>>({
    lines: [],
    enhanced: false,
  });
  const [syncState, setSyncState] = React.useState({
    activeLineIndex: -1,
    activeWordIndex: -1,
    parseError: null as string | null,
  });

  React.useEffect(() => {
    const text = props.lyricsText?.trim() ?? "";
    if (text.length === 0 || props.lyricsFormat === "plain") {
      liricleRef.current = null;
      setLyricsData({ lines: [], enhanced: false });
      setSyncState({
        activeLineIndex: -1,
        activeWordIndex: -1,
        parseError: null,
      });
      return;
    }

    const liricle = new Liricle();
    liricleRef.current = liricle;

    liricle.on("load", (data) => {
      setLyricsData(normalizeLyricsData(data as LyricsData));
      setSyncState((current) => ({
        ...current,
        parseError: null,
      }));
    });
    liricle.on("loaderror", (error) => {
      setLyricsData({ lines: [], enhanced: false });
      setSyncState({
        activeLineIndex: -1,
        activeWordIndex: -1,
        parseError: error.message || "歌词格式无法解析",
      });
    });
    liricle.on("sync", (line, word) => {
      setSyncState((current) => ({
        ...current,
        activeLineIndex: line?.index ?? -1,
        activeWordIndex: word?.index ?? -1,
      }));
    });

    try {
      liricle.load({ text });
    } catch (error) {
      setLyricsData({ lines: [], enhanced: false });
      setSyncState({
        activeLineIndex: -1,
        activeWordIndex: -1,
        parseError: error instanceof Error ? error.message : "歌词格式无法解析",
      });
    }

    return () => {
      if (liricleRef.current === liricle) {
        liricleRef.current = null;
      }
    };
  }, [props.lyricsFormat, props.lyricsText]);

  React.useEffect(() => {
    if (!liricleRef.current || props.lyricsFormat === "plain") {
      return;
    }

    liricleRef.current.sync(props.currentTimeSec, true);
  }, [props.currentTimeSec, props.lyricsFormat]);

  React.useEffect(() => {
    if (syncState.activeLineIndex < 0) {
      return;
    }

    if (autoFollowPausedUntilRef.current > Date.now()) {
      return;
    }

    virtuosoRef.current?.scrollToIndex({
      index: syncState.activeLineIndex,
      align: "center",
      behavior: props.isPlaying ? "smooth" : "auto",
    });
  }, [props.isPlaying, syncState.activeLineIndex]);

  const normalizedText = props.lyricsText?.trim() ?? "";
  if (normalizedText.length === 0) {
    return (
      <div className={cn("rounded-2xl border bg-muted/20 px-4 py-6 text-sm text-muted-foreground", props.className)}>
        当前曲目还没有可显示的歌词。
      </div>
    );
  }

  if (props.lyricsFormat === "plain") {
    return (
      <div className={cn("space-y-3", props.className)}>
        <Badge variant="outline">纯文本歌词</Badge>
        <div className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-2xl border bg-muted/20 px-4 py-4 text-sm leading-7 text-foreground/90">
          {normalizedText}
        </div>
      </div>
    );
  }

  if (syncState.parseError) {
    return (
      <div className={cn("space-y-3", props.className)}>
        <Badge variant="destructive">歌词同步异常</Badge>
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {syncState.parseError}
        </div>
        <div className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-2xl border bg-muted/20 px-4 py-4 text-sm leading-7 text-foreground/90">
          {normalizedText}
        </div>
      </div>
    );
  }

  const isEnhanced = props.lyricsFormat === "elrc" || lyricsData.enhanced;

  return (
    <div
      className={cn("space-y-3", props.className)}
      onWheel={() => {
        autoFollowPausedUntilRef.current = Date.now() + 6_000;
      }}
      onTouchStart={() => {
        autoFollowPausedUntilRef.current = Date.now() + 6_000;
      }}
      onPointerDown={() => {
        autoFollowPausedUntilRef.current = Date.now() + 6_000;
      }}
    >
      <div className="flex items-center gap-2">
        <Badge variant="outline">{isEnhanced ? "增强 LRC" : "LRC"}</Badge>
        <span className="text-xs text-muted-foreground">
          {isEnhanced ? "支持逐字高亮与点击跳播" : "支持逐行高亮与自动滚动"}
        </span>
      </div>
      <div className="h-[50vh] overflow-hidden rounded-2xl border bg-muted/15">
        <Virtuoso
          ref={virtuosoRef}
          data={lyricsData.lines}
          overscan={10}
          itemContent={(index, line) => {
            const isActiveLine = index === syncState.activeLineIndex;
            const isPastLine = syncState.activeLineIndex > index;

            return (
              <div
                className={cn(
                  "w-full px-4 py-2 text-center transition-colors",
                  isActiveLine && "bg-accent/40",
                )}
              >
                {isEnhanced && line.words && line.words.length > 0 ? (
                  <div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-2 text-lg leading-8 md:text-xl">
                    {line.words.map((word, wordIndex) => {
                      const isPastWord =
                        syncState.activeLineIndex > index ||
                        (syncState.activeLineIndex === index &&
                          syncState.activeWordIndex >= 0 &&
                          wordIndex <= syncState.activeWordIndex);

                      return (
                        <button
                          key={`${line.time}:${wordIndex}:${word.time}`}
                          type="button"
                          className={cn(
                            "rounded px-0.5 transition-colors",
                            isPastWord
                              ? "text-foreground"
                              : isActiveLine
                                ? "text-foreground/70"
                                : "text-muted-foreground",
                          )}
                          onClick={(event) => {
                            event.stopPropagation();
                            props.onSeekTo(word.time);
                          }}
                        >
                          {word.text}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div
                    className={cn(
                      "cursor-pointer text-lg leading-8 transition-colors md:text-xl",
                      isActiveLine
                        ? "font-medium text-foreground"
                        : isPastLine
                          ? "text-foreground/70"
                          : "text-muted-foreground",
                    )}
                    onClick={() => props.onSeekTo(line.time)}
                  >
                    {line.text}
                  </div>
                )}
              </div>
            );
          }}
        />
      </div>
    </div>
  );
}
