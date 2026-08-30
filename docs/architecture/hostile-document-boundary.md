# Hostile-document synthetic boundary

**Decision date:** 2026-08-30

## Non-negotiable trust model

An uploaded PDF is hostile code-like input until the exact bytes are approved. Filename, browser MIME, extension, successful upload, and a computed hash are not safety verdicts.

```text
Browser
  → short-lived single-purpose upload capability
  → UNTRUSTED storage
  → isolated inspection job
  → digest-bound typed inspection result
  → explicit promotion
  → APPROVED_SOURCE storage
  → isolated deterministic extraction
  → DERIVED_SAFE_ARTIFACT preview
```

The upload capability is deliberately **not** called single-use. It may be replayed until expiry, but only for one unpredictable object key, one expected length, and one expected SHA-256. Repeated identical bytes are idempotent; overwrite with different bytes never becomes trusted.

## Initial PDF policy

- PDF only; 10 MiB maximum; 20 pages maximum.
- Digest must belong to the synthetic fixture manifest before an intake is issued.
- Server/worker checks real magic, parsability, encryption, page count, indirect-object count, aggregate image pixels, attachments, JavaScript/automatic actions, AcroForm presence, and non-whitespace trailing bytes.
- A reviewed malware scanner must produce a typed `APPROVED` result. Scanner absence is a retryable failure, never approval.
- Inspection digest, promoted source digest, extraction input digest, and preview source digest must match.
- Quarantined bytes are never served to the browser. Only a controlled derived preview may become user-visible.

## Current evidence boundary

The repository now contains a separately runnable Java 21 worker and the server-side lease/result boundary. The worker refuses arbitrary plaintext network destinations, invokes ClamAV without a shell, requires the configured ClamAV version, and creates a bounded PNG preview from approved bytes. Synthetic scanner results are rejected by Core API unless an explicit local-test-only flag is enabled. GitHub Actions run [33315069682](https://github.com/ji-hun-git/dna/actions/runs/33315069682) exercised the checksum-pinned ClamAV 1.5.4 adapter against both clean bytes and a harmless synthetic SHA-256 signature marker, and exercised a concurrent same-lease completion race on PostgreSQL.

This is still not `HOSTED SYNTHETIC STAGING — GO`. The scanner evidence proves the engine contract, not an isolated hosted scanner with an operational official-signature update feed. Hosted staging additionally requires deployed storage/IAM/network/queue/TLS/restore evidence; IaC, local direct-service integration, or CI alone cannot pass those gates.
