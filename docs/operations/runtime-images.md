# Runtime image contract

**Scope:** reproducible synthetic-only build evidence. These images are not published, signed, deployed, or approved for PHI.

The repository now has three independent Linux/amd64 runtime definitions:

| Runtime | Definition | Build output | Runtime identity |
|---|---|---|---|
| Next web | `apps/web/Dockerfile` | Next standalone server and static assets | upstream non-root `node` user |
| Core API | `apps/core-api/Dockerfile` | `core-api.jar` | numeric `10001:10001` |
| Document worker | `apps/document-worker/Dockerfile` | Gradle application distribution plus ClamAV 1.5.4 | numeric `10001:10001` |

Node 24.20.0 and Temurin Java 21 base images are pinned by full manifest digest. The web runtime removes npm, Corepack and package-manager launchers after the standalone server is copied because they are build tools, not runtime dependencies. The ClamAV 1.5.4 package is fetched only through an HTTPS immutable release URL with its reviewed SHA-256 in the Dockerfile. Builds accept no secret arguments and `.dockerignore` excludes environment files, keys, local data, evidence and build output.

GitHub Actions builds each image from the repository root, rejects a root runtime user, runs a bounded runtime identity smoke test, records the local content-addressed image ID and full image inspection manifest, generates a CycloneDX image SBOM and fails on unresolved Critical/High vulnerabilities. The CI artifacts are evidence of a local Actions build, not registry repository digests.

## Deliberate gaps

- No image is pushed to a registry, so there is no immutable registry repository digest.
- No SBOM or provenance is signed and no attestation is published.
- No deployment plane, workload identity, KMS secret injection, read-only root filesystem, resource limit, network policy, TLS ingress or hosted denial probe is exercised.
- The worker image contains the engine but not an operational official ClamAV signature feed. A deployment must mount or provision a freshness-monitored, independently verified signature database. Missing/stale/unavailable scanner operation must fail closed.
- `GC_WORKER_CREDENTIAL` and `GC_WORKER_IMAGE_DIGEST` are deployment-time server secrets/metadata and are never baked into the worker image.
- Real documents and PHI remain prohibited.

The next supply-chain step is a protected registry build that emits repository digests, signed SBOM and provenance attestations. That step requires registry/cloud authority and remains outside this change.
