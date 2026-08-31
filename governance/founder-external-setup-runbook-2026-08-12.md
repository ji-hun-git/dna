# Founder External Setup Runbook

**Purpose:** complete external accounts, reviews, domains, and credentials in one controlled batch after the local product is ready.

**Current state:** deferred. Local build, design, synthetic tests, and security contracts continue without real credentials or personal health information.

## Rules for the future setup day

- Never paste a client secret, API key, private key, token, password, recovery code, or real user record into this file, GitHub, an issue, chat, CI log, screenshot, or `.env` committed to Git.
- Record only the external resource name, owner, approval date, expiration date, and the approved AWS Secrets Manager ARN/VersionId after the value is stored.
- Use separate staging and production applications. Never reuse a production credential in local development or CI.
- Prefer GitHub OIDC and short-lived AWS roles. Do not create long-lived AWS access keys for workflows.
- Start real-provider testing only with dedicated non-health test accounts and a separately approved environment.

## Batch 0 — Decisions and documents to prepare once

| Item | What Jason prepares | Done |
|---|---|---|
| Legal identity | Korean legal entity name, business registration number, representative name, business address, registration certificate | [ ] |
| Responsible owners | Product owner, privacy officer, security incident owner, billing owner, provider-review contact | [ ] |
| Contact channels | Domain email addresses for support, privacy, security/abuse, and provider review | [ ] |
| Public policies | Korean privacy policy, terms, account-deletion guide, consent withdrawal guide, data-retention/deletion table | [ ] |
| Intended use | One written statement of what the product does and does not diagnose, recommend, or replace | [ ] |
| Brand package | Cleared Korean wordmark, square app icon, provider-review screenshots, 1–2 sentence service description | [ ] |
| Environment map | Staging and production owners, domains, provider apps, AWS accounts, and release approvers | [ ] |

Do not request sensitive scopes until the corresponding screen, purpose, retention, withdrawal, and deletion behavior exists in the released build.

## Batch 1 — Domain, GitHub, and AWS foundation

| External setup | Required result | Secret? | Done |
|---|---|---:|---|
| Domain registrar | Control of `genome-companion.kr`; registrar MFA and recovery contacts | No | [ ] |
| DNS/ACM | `app.dev.genome-companion.kr`, `app.genome-companion.kr`, `api.genome-companion.kr`; certificate validation | No | [ ] |
| GitHub organization | Protected repository, required reviews, signed tags, protected environments, immutable workflow ownership | No | [ ] |
| GitHub production environments | `ux-plan-kr`, staging, production, approval owners and no unreviewed secrets | Mixed | [ ] |
| AWS organization/accounts | Application, security/log archive, and billing ownership according to the approved Foundation plan | No | [ ] |
| AWS Identity Center | Named human identities, MFA, break-glass custody, no shared administrator | Yes | [ ] |
| GitHub → AWS OIDC | Exact repository/ref/workflow/environment/audience trust; no access key | No | [ ] |
| Billing and incident alerts | Budget, anomaly, security, root-use, and break-glass alerts to named owners | No | [ ] |

## Batch 2 — Kakao Login

Official console: [Kakao Developers](https://developers.kakao.com/)

1. Create separate staging and production applications under the legal entity.
2. Register only the reviewed web domains.
3. Enable Kakao Login and OIDC; use Authorization Code + S256 PKCE.
4. Request only `openid` for the first release. Do not request optional profile scopes without a released user need and separate consent.
5. Register these candidate callbacks only after the deployed routes and Foundation allowlist match byte-for-byte:
   - `https://app.dev.genome-companion.kr/api/auth/callback/kakao`
   - `https://app.genome-companion.kr/api/auth/callback/kakao`
6. Register the exact logout/unlink URLs defined by the released broker; no wildcard URI.
7. Enable client-secret protection and security-event/unlink handling if required by the reviewed provider configuration.
8. Store `KAKAO_CLIENT_ID` and the client secret only in the environment-specific AWS secret. Record its ARN and exact VersionId in protected configuration, never here.
9. Capture the application ID, business-review state, consent-screen version, allowed callbacks, key-rotation date, and owner as non-secret release evidence.

Completion evidence: wrong redirect/state/nonce/audience/signature/replay all fail; unlink and token-exposure drills pass; no token or authorization code appears in browser storage, URL logs, analytics, or support tooling.

## Batch 3 — Naver Login

Official console: [Naver Developers](https://developers.naver.com/)

1. Create separate staging and production applications with Web service URLs.
2. Enable Naver OIDC and `openid`; keep optional profile scopes off for the first release.
3. Register only:
   - `https://app.dev.genome-companion.kr/api/auth/callback/naver`
   - `https://app.genome-companion.kr/api/auth/callback/naver`
4. Submit the required pre-service review with the released login, privacy, withdrawal, and deletion screens.
5. Store `NAVER_CLIENT_ID` and `NAVER_CLIENT_SECRET` only in the environment-specific AWS secret and pin the exact VersionId.
6. Record service-review approval, callback set, revoke behavior, owner, and rotation date as non-secret evidence.

Completion evidence: issuer + provider subject is the sole provider account key; optional missing profile fields do not break login; email similarity never merges accounts; revoke/unlink and replay drills pass.

## Batch 4 — Public Korean health-reference APIs

Portal: [공공데이터포털](https://www.data.go.kr/) and [HIRA Open Data](https://opendata.hira.or.kr/)

Request one server-side `serviceKey` per approved connector/account and keep dataset rights decisions separate. Automatic API approval is not commercial-content approval.

| Priority | Dataset/API | Intended use | Gate before key use | Done |
|---|---|---|---|---|
| First | HIRA hospital information `15001698` | Institution identity/location | terms, attribution, freshness | [ ] |
| First | HIRA hospital details `15001699` | Staffing/equipment reference | no live-capacity claim | [ ] |
| First | HIRA non-covered price `15001700` | Historical provider/item amounts | Type-1 attribution; not a quote or recommendation | [ ] |
| First | NHIS checkup institution `15154419` | Checkup-provider search | field/freshness review | [ ] |
| Optional | NHIS long-term-care institution `15059029` | Care-navigation reference | separate UX and rights review | [ ] |
| Optional | KDCA vaccination codes `15084296` | Reference codes only | no personalized advice | [ ] |
| Optional | KDCA health-information portal `15087442` | Evidence content | content-use/version permission | [ ] |
| Optional | MOHW hospital/clinic counts `15098823` | Aggregate context | no individual guidance/live-capacity claim | [ ] |
| Optional | NEMC emergency institutions `15000563` / AED `15000652` | Navigation reference | never replace 119 | [ ] |
| Optional | MFDS DUR `15056780` / consumer drug information `15075057` | Education/reference | no prescribing/dosing/interaction clearance | [ ] |

For every enabled dataset, record: application ID, approval state, terms/license version, attribution text, server-side key ARN/VersionId, owner, quota, endpoint/schema version, last source verification, and a kill switch.

## Batch 5 — Health Information Highway / MyHealthWay

This is the only planned personal-health exchange route. It is not a generic NHIS password API.

1. Confirm legal entity and eligible participating-organization status.
2. Complete organization registration and designate technical/privacy/security contacts.
3. Apply for the testbed and obtain the current implementation guide and certificates/credentials through the official channel.
4. Freeze supported FHIR/KR Core resources and the exact dynamic-consent purposes, data categories, duration, revocation, correction, and deletion behavior.
5. Pass testbed cases and conformity review.
6. Complete privacy, intended-use, security, and production-transition approvals.
7. Store test and production certificates/credentials in isolated AWS secrets with exact VersionIds and rotation owners.
8. Enable the connector only after the production gate proves authentication, consent, provenance, revocation, deletion, audit, outage behavior, and no scraping/shared credentials.

Completion evidence: all five readiness gates displayed in the product move from `대기` only from signed server-side approval records; no caller or UI flag can enable production access.

## Batch 6 — Mobile distribution, only when the mobile release is ready

| Account | Needed later | Done |
|---|---|---|
| Apple Developer Program | Legal enrollment, App Store Connect roles, app identifier, privacy nutrition labels, distribution signing controlled outside CI | [ ] |
| Google Play Console | Legal enrollment, app ownership, data-safety form, Play App Signing, closed-test reviewers | [ ] |
| Store review package | Privacy/terms/deletion URLs, support contact, screenshots, demo account with no PHI, medical/intended-use notes | [ ] |

Do not create distribution certificates or upload builds until the unsigned/no-codesign candidate and independent release review gates are complete.

## Batch 7 — Regulatory, privacy, and independent assurance

- [ ] Written Korean privacy-law review of the actual data flow, processors, overseas transfer, retention, deletion, and user rights.
- [ ] Written MFDS intended-use/classification assessment of the actual build, not only marketing copy.
- [ ] DPIA/threat model covering account takeover, social-login mix-up, document uploads, AI extraction, health-data consent, export, deletion, and support access.
- [ ] Independent penetration test and remediation evidence.
- [ ] Incident response contacts, regulator/user notification decision tree, provider revocation, session kill, and disaster-recovery drill.
- [ ] Model-weight, dataset, font, icon, and third-party-content license register.
- [ ] Trademark/name clearance for `앎` and the final international mark before store submission.

## What is deliberately not needed now

- No Kakao/Naver client secret for local component development.
- No MyHealthWay credential before organization/testbed acceptance.
- No real patient, member, or provider account for automated tests.
- No OpenAI API key for the current pinned offline medical-document runner.
- No production AWS access key for GitHub Actions; use OIDC.
- No analytics/advertising SDK or health-data event stream.

## Final one-day execution order

1. Verify Batch 0 documents and named owners.
2. Lock domain, GitHub, AWS human access, MFA, billing, and recovery.
3. Create staging provider apps, store credentials, run conformance with non-health test accounts.
4. Submit Kakao/Naver business/service reviews while production apps remain disabled.
5. Request approved public-data keys and record dataset-specific rights.
6. Start MyHealthWay institutional onboarding separately; do not block the MVP on it.
7. Create production provider apps only after staging release evidence and independent security review pass.
8. Record only secret coordinates and approvals in protected release inputs; rotate or revoke anything exposed during setup.
