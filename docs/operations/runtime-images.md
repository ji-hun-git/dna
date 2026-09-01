# Runtime image contract

**Scope:** reproducible synthetic-only build and publication evidence. The images are published, scanned, signed and attested, but they are not deployed or approved for PHI. Their unintended public visibility is stop-ship.

The repository now has three independent Linux/amd64 runtime definitions:

| Runtime | Definition | Build output | Runtime identity |
|---|---|---|---|
| Next web | `apps/web/Dockerfile` | Next standalone server and static assets | upstream non-root `node` user |
| Core API | `apps/core-api/Dockerfile` | `core-api.jar` | numeric `10001:10001` |
| Document worker | `apps/document-worker/Dockerfile` | Gradle application distribution plus ClamAV 1.5.4 | numeric `10001:10001` |

Node 24.20.0 and Temurin Java 21 base images are pinned by full manifest digest. The web runtime removes npm, Corepack and package-manager launchers after the standalone server is copied because they are build tools, not runtime dependencies. The ClamAV 1.5.4 package is fetched only through an HTTPS immutable release URL with its reviewed SHA-256 in the Dockerfile. Builds accept no secret arguments and `.dockerignore` excludes environment files, keys, local data, evidence and build output.

GitHub Actions builds each image from the repository root, rejects a root runtime user, runs a bounded runtime identity smoke test, records the local content-addressed image ID and full image inspection manifest, generates a CycloneDX image SBOM and fails on unresolved Critical/High vulnerabilities. The CI artifacts are evidence of a local Actions build, not registry repository digests.

GitHub Actions run [33318715896](https://github.com/ji-hun-git/dna/actions/runs/33318715896) for commit `001a030` passed an earlier local-image matrix. The recorded local IDs were:

- web: `sha256:d6507076d9ab7624b575355a28b6600a2ff68ef8a712e71ecb6a5d282a83df9a`
- core-api: `sha256:cd5b8e64df32bdeb449018e12c04e342eb1abe7c630406b0acaf64f665e4abc6`
- document-worker: `sha256:5d7b3a83fb75856644cee32a9053a8268312079747b9d0c55264a3f8cea0dc5c`

Those values address images in that ephemeral Docker engine only. They must not be represented as pullable registry coordinates or deployed production digests.

Main run [33367429797](https://github.com/ji-hun-git/dna/actions/runs/33367429797) passed the current matrix for revision `937361c5ee995174bcce7648957a02b430bdf450`. Protected publication run [33370021596](https://github.com/ji-hun-git/dna/actions/runs/33370021596) then published and verified these repository digests:

- web: `sha256:eab9f101a06acd92ff2307bedc57b96d5362d4020d8bcb6539ecadb44ac2d4e8`
- core API: `sha256:ee41c46e5417638a032be0006c95db17688c2635d68847cd7be9a024abdbe950`
- document worker: `sha256:689180cae9c6ed3994ae7bbc49e04bb9d4c6392bb2a58138369b7dd3a30b6c2c`

The same run verified keyless Cosign signatures, SLSA provenance, CycloneDX SBOM attestations, and exact registry-digest Critical/High scans. See `docs/operations/attested-runtime-registry.md` for attestation links.

## Deliberate gaps

- All three GHCR packages allowed anonymous manifest access on 2026-09-02 even though the intended policy was private. The published digests are stop-ship and must not be deployed or republished until an explicit remediation is approved.
- No deployment plane, workload identity, KMS secret injection, read-only root filesystem, resource limit, network policy, TLS ingress or hosted denial probe is exercised.
- The worker image contains the engine but not an operational official ClamAV signature feed. A deployment must mount or provision a freshness-monitored, independently verified signature database. Missing/stale/unavailable scanner operation must fail closed.
- `GC_WORKER_CREDENTIAL` and `GC_WORKER_IMAGE_DIGEST` are deployment-time server secrets/metadata and are never baked into the worker image.
- Real documents and PHI remain prohibited.

The next supply-chain step is to resolve package visibility through an explicitly approved deletion/private-republication or private-ECR migration plan, then prove anonymous pull denial and repeat exact digest verification. See `docs/operations/attested-runtime-registry.md`.
