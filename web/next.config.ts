import path from "node:path";
import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' ${isProduction ? "" : "'unsafe-eval'"} https:;
  style-src 'self' 'unsafe-inline' https:;
  img-src 'self' blob: data: http: https:;
  media-src 'self' blob: data: http: https:;
  font-src 'self' data:;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  block-all-mixed-content;
`;

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(process.cwd(), ".."),
  poweredByHeader: false,
  // Next.js 16: allow dev resources to be loaded when the browser runs under a non-local origin
  // (e.g. VM/preview IP). This only affects development.
  allowedDevOrigins: ["localhost", "127.0.0.1", "0.0.0.0", "192.168.64.105", "192.168.64.174"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: cspHeader.replace(/\s{2,}/g, " ").trim(),
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
