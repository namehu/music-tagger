import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16: allow dev resources to be loaded when the browser runs under a non-local origin
  // (e.g. VM/preview IP). This only affects development.
  allowedDevOrigins: ["localhost", "127.0.0.1", "0.0.0.0", "192.168.64.105"],
};

export default nextConfig;
