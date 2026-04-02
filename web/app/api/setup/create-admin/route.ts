import { NextResponse } from "next/server";

import {
  AdminInitializationError,
  createAdminInputSchema,
  getAdminInitializationStatus,
  initializeAdmin,
} from "@/lib/admin-init";

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

  const status = await getAdminInitializationStatus();
  if (status.initialized) {
    return NextResponse.redirect(new URL("/sign-in", baseUrl), { status: 303 });
  }

  const body = await readBody(req);
  const parsed = createAdminInputSchema.safeParse({
    email: body.email?.trim(),
    password: body.password ?? "",
    name: body.name?.trim() || undefined,
  });

  if (!parsed.success) {
    return NextResponse.redirect(new URL("/setup", baseUrl), { status: 303 });
  }

  try {
    await initializeAdmin(parsed.data);

    const url = new URL("/sign-in", baseUrl);
    url.searchParams.set("email", parsed.data.email);
    return NextResponse.redirect(url, { status: 303 });
  } catch (error) {
    if (
      error instanceof AdminInitializationError &&
      (error.code === "ALREADY_INITIALIZED" || error.code === "INITIALIZING")
    ) {
      return NextResponse.redirect(new URL("/setup", baseUrl), { status: 303 });
    }

    return NextResponse.redirect(new URL("/setup", baseUrl), { status: 303 });
  }
}
