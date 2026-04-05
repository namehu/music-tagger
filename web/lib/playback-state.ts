export type PlaybackQueueTrack = {
  id: string;
  title: string;
  artist: string;
};

export type PlaybackMode = "ordered" | "shuffle" | "repeat_one";
export type PlaybackHydrationStatus = "rehydrating" | "resolving" | "ready";

export function tracksEqual(left: PlaybackQueueTrack[], right: PlaybackQueueTrack[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((track, index) => {
    const other = right[index];
    return track.id === other?.id && track.title === other.title && track.artist === other.artist;
  });
}

export function getQueueTrackIndex(queue: PlaybackQueueTrack[], trackId: string | null) {
  if (!trackId) {
    return -1;
  }

  return queue.findIndex((track) => track.id === trackId);
}

export function getOrderedPreviousTrack(queue: PlaybackQueueTrack[], trackId: string | null) {
  const index = getQueueTrackIndex(queue, trackId);
  if (index <= 0) {
    return null;
  }

  return queue[index - 1] ?? null;
}

export function getOrderedNextTrack(queue: PlaybackQueueTrack[], trackId: string | null) {
  const index = getQueueTrackIndex(queue, trackId);
  if (index < 0 || index >= queue.length - 1) {
    return null;
  }

  return queue[index + 1] ?? null;
}

export function getShufflePreviousTrack(history: PlaybackQueueTrack[]) {
  return history.length > 0 ? history[history.length - 1] ?? null : null;
}

export function pickShuffleNextTrack(input: {
  queue: PlaybackQueueTrack[];
  trackId: string | null;
  random?: () => number;
}) {
  const candidates =
    input.queue.length > 1 && input.trackId
      ? input.queue.filter((track) => track.id !== input.trackId)
      : input.queue;

  if (candidates.length === 0) {
    return null;
  }

  const random = input.random ?? Math.random;
  const index = Math.min(candidates.length - 1, Math.floor(random() * candidates.length));
  return candidates[index] ?? null;
}

export function shouldAcceptPassiveQueueUpdate(input: {
  hydrationStatus: PlaybackHydrationStatus;
  resumeLock: boolean;
  currentTrackId: string | null;
  currentQueueSourceKey: string | null;
  nextQueueSourceKey: string;
}) {
  if (input.hydrationStatus !== "ready") {
    return false;
  }

  if (!input.currentQueueSourceKey) {
    return true;
  }

  if (input.currentQueueSourceKey === input.nextQueueSourceKey) {
    return true;
  }

  if (input.resumeLock) {
    return false;
  }

  if (input.currentTrackId) {
    return false;
  }

  return true;
}
