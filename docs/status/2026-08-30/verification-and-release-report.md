# Verification and release report

## Successful checks

| Check | Result |
|---|---|
| Exact runtime policy | PASS: Node 24.20.0, pnpm 11.20.0, Next 16.3.3 |
| Web tests | PASS: 24 files, 86 tests |
| Next production build | PASS: 8/8 static pages |
| Storybook build | PASS with existing >500 kB chunk warning |
| Korean UX Playwright | PASS: 6/6 on dedicated port 3137 |
| Foundation browser E2E | PASS: 1/1 on dedicated port 3138 |
| Spring tests with PostgreSQL | PASS: 40 tests, 0 failures, 1 Docker-only test skipped |
| Flyway | PASS: V1, V2, V3 applied to PostgreSQL 16.15 |
| JWT→consent→PostgreSQL/outbox | PASS, including wrong scope/subject and revoke replay |
| Audit immutability | PASS: database rejects update and original row remains |
| Auth source gate | PASS |
| Medical synthetic contract gate | PASS; `productionAccuracyClaim=false` |
| Workload JWKS and PHI-safe collector tests | PASS: 9/9 |
| AWS organization module | PASS: OpenTofu 1.10.6 fmt/validate and 3/3 tests |

The standard and foundation Next development servers must run sequentially because Next locks one `.next` development directory. The tests use different ports and never reuse an unrelated server.

## Not verified

- Real Kakao/Naver/MyHealthWay/provider conformance.
- Arbitrary or real medical documents, malware, OCR/model accuracy, or isolated worker behavior.
- Hosted security tooling, production image/container scanning, signed provenance, deployed headers/CSP/WAF.
- Backup/restore, RPO/RTO, disaster recovery, secret rotation, incident exercise, or independent penetration test.
- Manual accessibility and supported real-device/browser matrix.
- Legal/privacy/MFDS applicability and real-data authorization.

## Release verdict

| Target | Verdict |
|---|---|
| Local synthetic founder demo | GO |
| Moderated synthetic UX testing | GO |
| Synthetic production-shaped staging | NO-GO until a reproducible hosted environment exists |
| Real-data private beta | NO-GO |
| Production | NO-GO |
