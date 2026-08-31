# Document worker operations

**Current status:** executable artifact; real ClamAV 1.5.4 command-adapter behavior verified in synthetic CI, not deployed.

The worker is a separate Java 21 process in `apps/document-worker`. It leases one job at a time from the Core API, downloads only the object bound to that lease, verifies the exact length and SHA-256, and returns either a typed inspection result or a controlled PNG derivative. It never receives a subject identifier or health value.

## Required runtime inputs

- `GC_WORKER_API_BASE_URL`: HTTPS origin, or HTTP loopback for local tests.
- `GC_WORKER_CREDENTIAL`: local-only worker credential, 32–256 characters. Do not place it in Git or a command line.
- `GC_WORKER_ID`: non-secret operational identity label.
- `GC_WORKER_CLAMSCAN_PATH`: explicit ClamAV executable path.
- `GC_WORKER_CLAMAV_VERSION`: required version; currently `1.5.4`.
- `GC_WORKER_IMAGE_DIGEST`: immutable 64-character image digest supplied by the deployment plane.
- `GC_WORKER_HEALTH_PORT`: optional loopback-only health port.

`GC_WORKER_ALLOW_SYNTHETIC_SCANNER=true` exists solely for local deterministic tests. Core API also requires `GC_ALLOW_SYNTHETIC_SCANNER_RESULTS=true` before that result can approve bytes. Both settings must remain false or absent in any hosted staging or stronger environment.

## Fail-closed behavior

- Missing scanner, version mismatch, timeout or scanner error returns `SCANNER_UNAVAILABLE` and schedules a bounded retry.
- Malware, active content, embedded files, encryption, malformed structure, trailing bytes or complexity limits reject the document.
- A changed source digest, expired lease, wrong job type or repeated result cannot promote or create a candidate.
- Extraction reads `APPROVED_SOURCE`, never `UNTRUSTED`.
- Preview failures retry and do not create a candidate or canonical record.

GitHub Actions run [33315069682](https://github.com/ji-hun-git/dna/actions/runs/33315069682) checksum-verified the official ClamAV 1.5.4 package and captured clean and detected exit behavior through the real command adapter. Its isolated SHA-256 signature database contains only a harmless synthetic marker; the database digest is recorded as signature provenance. Do not treat this as evidence of an isolated hosted worker, an operational official-signature update feed, freshness monitoring or production malware coverage.
