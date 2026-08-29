import type { NextConfig } from "next";

function resolveCoreApiOrigin() {
  const configured = process.env.GC_CORE_API_ORIGIN;
  if (!configured) return null;
  const parsed = new URL(configured);
  const isLoopback = ["127.0.0.1", "localhost", "::1"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && isLoopback)) {
    throw new Error("GC_CORE_API_ORIGIN must use HTTPS or an HTTP loopback address");
  }
  if (parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error("GC_CORE_API_ORIGIN must contain only an origin");
  }
  return parsed.origin;
}

const coreApiOrigin = resolveCoreApiOrigin();

const nextConfig: NextConfig = {
  async rewrites() {
    if (!coreApiOrigin) return [];
    return [
      {
        source: "/api/:path*",
        destination: coreApiOrigin + "/api/:path*",
      },
    ];
  },
};

export default nextConfig;
