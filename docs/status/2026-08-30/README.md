# Current frontend and backend report set

**Evidence date:** 2026-08-30 (Asia/Seoul)

**Branch:** `codex/production-foundation`

**Data authorization:** synthetic only; no PHI, deployment, or external account change

These reports describe executable behavior, not plans or dependency declarations.

## Reports

1. [Frontend](frontend-report.md)
2. [Backend](backend-report.md)
3. [Security and integrations](security-and-integrations-report.md)
4. [Verification and release](verification-and-release-report.md)
5. [Delivery roadmap](delivery-roadmap.md)
6. [Stop-ship dependency iteration](production-foundation-stop-ship-iteration.md)
7. [Durable synthetic lifecycle iteration](durable-synthetic-foundation-iteration.md)
8. [Integrated security-foundation iteration](integrated-security-foundation-iteration.md)
9. [Evidence-graph rapid research brief](../../research/2026-08-30-evidence-graph-quick-brief.md)

## Current truth

| Area | Status |
|---|---|
| Korean-first frontend | VERIFIED LOCALLY; most visible data remains synthetic/demo-only |
| Browser→Next→Spring→PostgreSQL lifecycle | VERIFIED LOCALLY with one allowlisted synthetic PDF |
| OIDC resource boundary | VERIFIED LOCALLY with synthetic JWTs; Kakao/Naver disabled |
| Durable purpose consent/outbox | VERIFIED LOCALLY with PostgreSQL |
| Synthetic FHIR evidence graph | VERIFIED LOCALLY for one pinned Synthea Bundle: 80 of 99 Observations admitted as strict quantity candidates, 19 explicitly rejected; no persistence/API/KR Core/clinical claim |
| Audit/telemetry | local safe logging, hash-chain code and append-only DB trigger verified; no production sink |
| AWS organization guardrails | OpenTofu 1.10.6 `fmt/validate/test` PASS; no AWS account/apply |
| OCR/model worker | NOT IMPLEMENTED |
| Backup/restore | NOT IMPLEMENTED |
| Hosted DevSecOps/deployment | NOT IMPLEMENTED |
| Real-data private beta | NO-GO |

The repository has crossed from “backend skeleton” to a small production-shaped synthetic foundation. It now also has an executable, provenance-preserving synthetic FHIR candidate boundary. It has not crossed into real-data, government-connection, KR Core-conformance, or clinical readiness.
