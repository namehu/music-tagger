"use client";

import React from "react";

import type { JobProgressEvent } from "@/lib/jobs";

const TERMINAL_JOB_STATUSES = new Set(["done", "failed", "cancelled"]);

export function useJobEventSource({
  enabled,
  jobId,
  onJob,
}: {
  enabled: boolean;
  jobId: string | null | undefined;
  onJob: (job: JobProgressEvent) => void;
}) {
  React.useEffect(() => {
    if (!enabled || !jobId) {
      return;
    }

    const eventSource = new EventSource(`/api/admin/jobs/${encodeURIComponent(jobId)}/events`);

    eventSource.addEventListener("job", (event) => {
      try {
        const job = JSON.parse(event.data) as JobProgressEvent;
        onJob(job);
        if (TERMINAL_JOB_STATUSES.has(job.status)) {
          eventSource.close();
        }
      } catch {
        eventSource.close();
      }
    });

    eventSource.addEventListener("error", () => {
      eventSource.close();
    });

    return () => eventSource.close();
  }, [enabled, jobId, onJob]);
}
