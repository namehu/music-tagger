import test from "node:test";
import assert from "node:assert/strict";

import {
  getPlanActionState,
  getPlanExecutionCounts,
  getPlanExecutionHint,
  type PlanItemStatus,
  type PlanStatus,
} from "./plans.ts";

test("getPlanActionState blocks confirm before preview and execute before confirm", () => {
  const state = getPlanActionState({
    status: "draft",
    previewedAt: null,
    previewSummary: {
      sourceTrackCount: 0,
      itemCount: 0,
      warningCount: 0,
      blockingCount: 0,
    },
    executionJobStatus: null,
  });

  assert.equal(state.canPreview, true);
  assert.equal(state.canConfirm, false);
  assert.equal(state.confirmReason, "请先生成预览，再确认 Plan");
  assert.equal(state.canExecute, false);
  assert.equal(state.executeReason, "先确认 Plan，才能提交执行");
});

test("getPlanActionState only allows execute for confirmed plans without active jobs", () => {
  const confirmed = getPlanActionState({
    status: "confirmed",
    previewedAt: "2026-04-05T10:00:00.000Z",
    previewSummary: {
      sourceTrackCount: 2,
      itemCount: 2,
      warningCount: 0,
      blockingCount: 0,
    },
    executionJobStatus: null,
  });
  assert.equal(confirmed.canConfirm, false);
  assert.equal(confirmed.canExecute, true);
  assert.equal(confirmed.executeReason, null);

  const running = getPlanActionState({
    status: "running",
    previewedAt: "2026-04-05T10:00:00.000Z",
    previewSummary: {
      sourceTrackCount: 2,
      itemCount: 2,
      warningCount: 0,
      blockingCount: 0,
    },
    executionJobStatus: "running",
  });
  assert.equal(running.canExecute, false);
  assert.equal(running.executeReason, "当前已有进行中的执行任务");
});

test("getPlanExecutionCounts summarizes item statuses", () => {
  const statuses: PlanItemStatus[] = ["pending", "running", "done", "failed", "done"];
  assert.deepEqual(getPlanExecutionCounts(statuses), {
    pending: 1,
    running: 1,
    done: 2,
    failed: 1,
    skipped: 0,
    total: 5,
  });
});

test("getPlanExecutionHint explains the next operator action", () => {
  assert.equal(
    getPlanExecutionHint({
      status: "draft" satisfies PlanStatus,
      previewSummary: {
        sourceTrackCount: 10,
        itemCount: 0,
        warningCount: 0,
        blockingCount: 0,
      },
      executionJobStatus: null,
      actionState: getPlanActionState({
        status: "draft",
        previewedAt: null,
        previewSummary: {
          sourceTrackCount: 10,
          itemCount: 0,
          warningCount: 0,
          blockingCount: 0,
        },
        executionJobStatus: null,
      }),
      counts: {
        pending: 0,
        running: 0,
        done: 0,
        failed: 0,
        skipped: 0,
        total: 0,
      },
    }),
    "先生成预览，确认本次计划会产生哪些变更。",
  );

  assert.equal(
    getPlanExecutionHint({
      status: "failed" satisfies PlanStatus,
      previewSummary: {
        sourceTrackCount: 2,
        itemCount: 2,
        warningCount: 1,
        blockingCount: 0,
      },
      executionJobStatus: "failed",
      actionState: getPlanActionState({
        status: "failed",
        previewedAt: "2026-04-05T10:00:00.000Z",
        previewSummary: {
          sourceTrackCount: 2,
          itemCount: 2,
          warningCount: 1,
          blockingCount: 0,
        },
        executionJobStatus: "failed",
      }),
      counts: {
        pending: 0,
        running: 0,
        done: 1,
        failed: 1,
        skipped: 0,
        total: 2,
      },
    }),
    "执行已结束，但仍有失败项；先检查错误信息和 Jobs 日志。",
  );
});
