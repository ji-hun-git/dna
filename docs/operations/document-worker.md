# Document worker operations

**Current status:** executable local artifact; real scanner run not yet evidenced.

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

Do not mark the scanner gate PASS until the real executable version, signature version, input digest, typed result and process exit behavior are captured from a live run.
