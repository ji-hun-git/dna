import type { NextConfig } from "next";

const healthCredentialNames = [
  "GC_DATABASE_URL",
  "GC_DATABASE_USERNAME",
  "GC_DATABASE_PASSWORD",
  "GC_QUARANTINE_ROOT",
  "GC_HEALTH_OBJECT_BUCKET",
  "GC_DOCUMENT_BUCKET",
  "GC_HEALTH_STORAGE_ENDPOINT",
  "GC_AUDIT_PEPPER",
  "GC_FOUNDATION_LOCAL_IDENTITIES_0_CREDENTIAL_SHA256",
];
const healthCredentialsPresent = healthCredentialNames.filter((name) => process.env[name]);
if (healthCredentialsPresent.length > 0) {
  throw new Error(`Research runtime refuses health credentials: ${healthCredentialsPresent.join(", ")}`);
}

const nextConfig: NextConfig = {};

export default nextConfig;
