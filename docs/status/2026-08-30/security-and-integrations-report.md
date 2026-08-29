# Security and integrations report

## Security controls implemented in code

The current repository has unusually explicit local security contracts for a prototype:

- OAuth Authorization Code with S256 PKCE contracts for Kakao and Naver.
- 256-bit transaction material, five-minute transaction lifetime, exact HTTPS origin allowlist, closed return-path allowlist, constant-time secret comparison, and replay state.
- RS256 ID-token verification against bounded local JWKS data with issuer, audience, subject, time, and Kakao nonce validation.
- Browser token storage forbidden by contract.
- Account key fixed to provider issuer plus subject; email-based silent merge is forbidden.
- Anti-hack classifications for state/PKCE/nonce/signature/issuer/audience failures, replay, linking collision, abuse, stale JWKS, webhook forgery, and detected token exposure.
- Security-event identifiers HMAC-pseudonymized before output.
- Source scan blocks common client token storage, credential logging, public secrets, wildcard CORS, unsafe HTML, and provider-host bypass.
- Research rights default deny, exact source fingerprints, explicit allowed/prohibited uses, and source-drift blocking.
- Medical runner contracts reject mutable tags, network access, artifact drift, unsafe paths, stale approvals, and unreviewed extra output.

## What these controls do not yet provide

They are libraries and tests. The repository does not currently operate:

- WAF, DDoS protection, edge rate limits, bot controls, or network firewall rules;
- a one-time OAuth transaction database;
- a rotating `HttpOnly`, `Secure`, `SameSite` application session;
- CSRF enforcement on real mutation endpoints;
- provider token exchange, revoke/unlink, webhook, or JWKS-fetch clients;
- secret-manager reads, key rotation, or workload identity;
- security headers/CSP evidence from a deployed service;
- centralized redacted telemetry, alert routing, session kill, or incident automation;
- SAST/SCA/secret/IaC/container pipelines in tracked CI;
- penetration testing, account-takeover drills, or provider-rotation drills.

A passing local anti-hack gate is therefore not proof that a deployed application is protected.

## Integration readiness matrix

| Integration | Code present | Live call/account present | Current decision |
|---|---|---:|---|
| Kakao Login | OIDC endpoints, scopes, crypto contract, verification tests, disabled UI | No | **Contract only; registration and backend broker required** |
| Naver Login | OIDC endpoints, scopes, crypto contract, verification tests, disabled UI | No | **Contract only; registration/review and backend broker required** |
| Health Information Highway / MyHealthWay | FHIR exchange contract and five formal readiness gates | No | **Disabled pending organization, testbed, conformity, production, and privacy/intended-use approval** |
| HIRA/NHIS/MOHW public data | Synthetic provider/price schemas and UX | No | **Adapter and dataset-specific rights/freshness work required** |
| DataON | Disabled metadata connector contract, offline catalog, rights and evaluation gates | No | **API/key/IP approval required** |
| AIDA | Disabled metadata connector contract, offline catalog, rights and evaluation gates | No | **Account, per-resource rights, and API approval required** |
| PaddleOCR-VL / MedGemma | Candidate policy, synthetic corpus, OCI/approval contracts | No | **No model weights or inference runtime admitted** |
| Nanonets GRAFT | Ignored local reference directory exists | No; zero tracked files and no runtime dependency | **Research reference only, not integrated** |

## Personal-data and medical-safety truth

- Current UI fixtures are synthetic and explicitly labeled.
- The research agent accepts non-personal topic selections and uses offline public metadata.
- No real health-provider API request is made.
- No selected document is uploaded; browser code only validates bytes and hashes them locally.
- No OCR or medical model extracts values from the selected document.
- No model output becomes a health record automatically.
- There is no backend capable of safely receiving, storing, exporting, or deleting real personal health data.

## External preparation

The existing one-go checklist for DataON, AIDA, and both competition entries is maintained in [`docs/operations/research-data-external-setup.md`](../../operations/research-data-external-setup.md). Kakao/Naver/MyHealthWay readiness and anti-hack implementation details are maintained in [`docs/superpowers/plans/2026-08-12-identity-health-access-antihack.md`](../../superpowers/plans/2026-08-12-identity-health-access-antihack.md).

Secrets themselves must never be placed in Markdown, Git, browser environment variables, screenshots, or chat.

## Security verdict

Security-by-design work is ahead of the functional backend, which is the correct posture for this domain. Production security remains **not implemented** because no deployed enforcement points or operational evidence exist. Keep every external connector disabled until its code, external approval, least-privilege secret path, live conformance test, incident response, and rollback evidence are complete.

