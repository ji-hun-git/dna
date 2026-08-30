import type { NextConfig } from "next";

const researchCredentialNames = [
  "GC_AIDA_API_KEY",
  "GC_DATAON_API_KEY",
  "GC_RESEARCH_DATABASE_URL",
  "GC_RESEARCH_SECRET_VERSION",
  "GC_RESEARCH_OBJECT_BUCKET",
  "GC_RESEARCH_STORAGE_URL",
];
const researchCredentialsPresent = researchCredentialNames.filter((name) => process.env[name]);
if (researchCredentialsPresent.length > 0) {
  throw new Error(`Health runtime refuses research credentials: ${researchCredentialsPresent.join(", ")}`);
}

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
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
          },
        ],
      },
    ];
  },
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
