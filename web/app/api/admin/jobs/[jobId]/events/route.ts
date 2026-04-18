import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const TERMINAL_JOB_STATUSES = new Set(["done", "failed", "cancelled"]);
const POLL_INTERVAL_MS = 1000;

type RouteContext = {
  params: Promise<{
    jobId: string;
  }>;
};

async function getAdminUser(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  const userId = session?.user?.id ?? null;
  if (!userId) {
    return null;
  }

  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
    },
  });
}

async function readJob(jobId: string) {
  return prisma.job.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      type: true,
      status: true,
      progress: true,
      progressJson: true,
      errorJson: true,
      updatedAt: true,
    },
  });
}

function encodeSseEvent(event: string, payload: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

export async function GET(req: Request, context: RouteContext) {
  const user = await getAdminUser(req);
  if (!user) {
    return Response.json({ message: "需要登录后继续" }, { status: 401 });
  }

  if (user.role !== "admin") {
    return Response.json({ message: "权限不足" }, { status: 403 });
  }

  const { jobId } = await context.params;
  if (!jobId) {
    return Response.json({ message: "jobId 不能为空" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let isClosed = false;

      const close = () => {
        if (isClosed) {
          return;
        }

        isClosed = true;
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
        controller.close();
      };

      const sendJob = async () => {
        try {
          const job = await readJob(jobId);
          if (!job) {
            controller.enqueue(encoder.encode(encodeSseEvent("error", { message: "Job 不存在" })));
            close();
            return;
          }

          controller.enqueue(encoder.encode(encodeSseEvent("job", job)));
          if (TERMINAL_JOB_STATUSES.has(job.status)) {
            close();
          }
        } catch (error) {
          controller.enqueue(
            encoder.encode(
              encodeSseEvent("error", {
                message: error instanceof Error ? error.message : "任务事件流读取失败",
              }),
            ),
          );
          close();
        }
      };

      req.signal.addEventListener("abort", close);
      void sendJob();
      timer = setInterval(() => {
        void sendJob();
      }, POLL_INTERVAL_MS);
    },
    cancel() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}
