export type RecentPlayEvent = {
  trackId: string | null;
  createdAt: Date | string;
};

export type RecentTrackPlay = {
  trackId: string;
  playedAt: Date | string;
};

export function selectRecentUniqueTrackPlays(events: RecentPlayEvent[], limit: number) {
  const selected: RecentTrackPlay[] = [];
  const seenTrackIds = new Set<string>();

  for (const event of events) {
    if (!event.trackId || seenTrackIds.has(event.trackId)) {
      continue;
    }

    selected.push({
      trackId: event.trackId,
      playedAt: event.createdAt,
    });
    seenTrackIds.add(event.trackId);

    if (selected.length >= limit) {
      break;
    }
  }

  return selected;
}
