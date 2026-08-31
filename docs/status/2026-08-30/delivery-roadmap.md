# Delivery roadmap

The first durable synthetic milestone is complete locally. Feature expansion remains frozen until the following production-foundation gaps are closed.

## P0 — Connect the product to server authority

1. Replace visible import/review/record/consent/deletion React-memory success states with the Spring lifecycle.
2. Add truthful loading, quarantine, inspection, retry, partial, revoked, conflict, deletion-pending and session-expired states.
3. Keep the research route outside the PHI runtime; produce a separate build/deployment identity.

## P0 — Hostile document boundary

1. Add a short-lived object-store upload capability bound to one key, exact length and SHA-256; do not claim single-use without one-time enforcement.
2. Add server-side media identification, structural limits and malware scanning.
3. Add a queue and network-isolated worker with idempotency, retry and dead-letter behavior.
4. Admit exact OCR/model/container digests only after rights, vulnerability and representative-corpus review.

## P0 — Operational evidence

1. Reproducible production image and immutable digest.
2. Hosted CI gates for tests, SAST, SCA, secrets, IaC, license, container and SBOM/provenance.
3. Least-privilege database/object roles, secret manager/workload identity, TLS and deny-by-default egress.
4. Synthetic backup/restore/deletion-replay drill with approved RPO/RTO.
5. Incident, session-kill, key/provider rotation and rollback exercises.
6. Manual accessibility audit and browser/device support matrix.

## P1 — External programs, one at a time

1. Kakao test application.
2. Naver test application/review.
3. Approved public reference datasets.
4. DataON/AIDA in the separate research product.
5. MyHealthWay only after organizational review, testbed, conformity, security remediation and production approval.

Each requires a credential owner, secret path, egress allowlist, quota/timeout/retry policy, schema/freshness validation, conformance tests, incident owner, kill switch and user-visible degraded state.

## Exit criterion for real-data private beta

Every blocking entry in `release/readiness.json` must be PASS, the verdict must be GO, and privacy/security/legal/clinical owners must approve the actual deployed data flow. Local synthetic success cannot waive an external or operational gate.
