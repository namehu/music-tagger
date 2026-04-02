import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function getRequestBaseUrl(req: Request): string {
  const forwardedProto = req.headers.get("x-forwarded-proto");
  const proto = forwardedProto ? forwardedProto.split(",")[0].trim() : "http";

  const forwardedHost = req.headers.get("x-forwarded-host");
  const hostHeader = forwardedHost
    ? forwardedHost.split(",")[0].trim()
    : (req.headers.get("host") ?? "");

  // fallback to req.url if host missing
  if (!hostHeader) return new URL(req.url).origin;

  // Some environments send Host: 0.0.0.0:<port>, which is not a navigable address in browsers.
  // Prefer localhost so redirects work for users.
  if (hostHeader.startsWith("0.0.0.0")) {
    const port = hostHeader.includes(":") ? hostHeader.split(":").at(-1) : "";
    return `${proto}://localhost${port ? `:${port}` : ""}`;
  }
  return `${proto}://${hostHeader}`;
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function isDoneState(dataJson: string | null | undefined): boolean {
  const parsed = typeof dataJson === "string" ? safeJsonParse(dataJson) : null;
  if (!parsed || typeof parsed !== "object") return false;
  return (parsed as { state?: unknown }).state === "done";
}

async function readBody(req: Request): Promise<{ name?: string; email?: string; password?: string }> {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const json: unknown = await req.json().catch(() => null);
    const obj = json && typeof json === "object" ? (json as Record<string, unknown>) : null;
    return {
      name: typeof obj?.name === "string" ? obj.name : undefined,
      email: typeof obj?.email === "string" ? obj.email : undefined,
      password: typeof obj?.password === "string" ? obj.password : undefined,
    };
  }

  // default: treat as form POST
  const form = await req.formData().catch(() => null);
  const get = (k: string) => {
    const v = form?.get(k);
    return typeof v === "string" ? v : undefined;
  };
  return { name: get("name"), email: get("email"), password: get("password") };
}

export async function POST(req: Request) {
  const baseUrl = getRequestBaseUrl(req);

  // If already initialized => redirect to sign-in
  const settings = await prisma.adminSettings.findUnique({
    where: { id: "singleton" },
    select: { dataJson: true },
  });
  if (settings?.dataJson && isDoneState(settings.dataJson)) {
    return NextResponse.redirect(new URL("/sign-in", baseUrl), { status: 303 });
  }

  const body = await readBody(req);
  const email = (body.email ?? "").trim();
  const password = body.password ?? "";
  const name = (body.name ?? "").trim() || "Admin";

  if (!email || !email.includes("@") || password.length < 8) {
    return NextResponse.redirect(new URL("/setup", baseUrl), { status: 303 });
  }

  // acquire lock
  try {
    await prisma.adminSettings.create({
      data: {
        id: "singleton",
        dataJson: JSON.stringify({ state: "locking", startedAt: new Date().toISOString() }),
        updatedAt: new Date(),
      },
    });
  } catch {
    // lock exists => go setup again (UI will show “初始化中/已初始化”)
    return NextResponse.redirect(new URL("/setup", baseUrl), { status: 303 });
  }

  try {
    const result = await auth.api.signUpEmail({
      body: { email, password, name },
    });

    const userId = result?.user?.id;
    if (!userId) throw new Error("No userId returned from signUpEmail");

    await prisma.user.update({
      where: { id: userId },
      data: { role: "admin" },
    });

    await prisma.adminSettings.update({
      where: { id: "singleton" },
      data: {
        dataJson: JSON.stringify({
          state: "done",
          doneAt: new Date().toISOString(),
          adminUserId: userId,
        }),
        updatedAt: new Date(),
      },
    });

    // redirect to sign-in and prefill email
    const url = new URL("/sign-in", baseUrl);
    url.searchParams.set("email", email);
    return NextResponse.redirect(url, { status: 303 });
  } catch {
    // rollback lock
    await prisma.adminSettings.delete({ where: { id: "singleton" } }).catch(() => undefined);
    return NextResponse.redirect(new URL("/setup", baseUrl), { status: 303 });
  }
}
