# Founder Provider and API Register

**Owner:** Jason
**Verified:** 2026-08-12 (Asia/Seoul)
**Purpose:** one future setup list for accounts, approvals, callback URLs, keys, certificates, reviews, and non-secret completion evidence.

This file never stores a credential. A completed row records only the owner, provider application or approval ID, approval date, terms version, rotation date, and the AWS Secrets Manager ARN plus exact VersionId that contains the real value.

## Rules for the one-day setup

1. Create separate staging and production applications. Local development receives synthetic credentials only.
2. Put every client secret, API key, token, certificate private key, recovery code, and password directly into the approved secret manager. Never paste it into Git, Codex, chat, screenshots, issues, CI output, or committed `.env` files.
3. Request only the scope used by a released screen. Social login is not health-data consent.
4. Use provider issuer + provider subject as the account key. Never merge accounts by email, phone, name, or nickname.
5. Keep real provider tokens server-side. Browser storage for access, refresh, ID, or session bearer tokens is forbidden.
6. Do not mark an integration live until wrong issuer, audience, signature, state, PKCE, replay, redirect, and account-link tests fail closed.

## 1. Prepare once before any provider review

| Prepare | Exact result to hold privately | Status |
|---|---|---|
| Legal entity | Korean legal name, business registration, representative, address, certificate | [ ] |
| Responsible people | Product, privacy, security incident, billing, provider-review owners and backups | [ ] |
| Domain email | `support@`, `privacy@`, `security@` or approved equivalents on the controlled domain | [ ] |
| Public policies | Korean privacy policy, terms, account deletion, consent withdrawal, retention/deletion table | [ ] |
| Intended use | One approved statement that the service does not diagnose, prescribe, or replace clinicians | [ ] |
| Review assets | Cleared wordmark/icon, service description, real released screenshots, non-PHI demo account | [ ] |
| Domains | Control and MFA for `genome-companion.kr` or the final cleared domain | [ ] |

## 2. Kakao Login

Official references: [Kakao Login prerequisites](https://developers.kakao.com/docs/en/kakaologin/prerequisite), [REST API and OIDC](https://developers.kakao.com/docs/en/kakaologin/rest-api), [unlink webhook](https://developers.kakao.com/docs/en/kakaologin/callback).

| Action | Exact value or evidence | Status |
|---|---|---|
| Create staging app | Legal owner and web platform for `https://app.dev.genome-companion.kr` | [ ] |
| Create production app later | Only after staging conformance and independent security review | [ ] |
| Enable login | Kakao Login ON; OpenID Connect ON; auto-link decision recorded | [ ] |
| Enable client protection | REST API key client secret ON; token exchange uses `client_secret_post` | [ ] |
| Minimal scope | `openid` only for first release; no email/profile scope without separate released need | [ ] |
| Staging callback | `https://app.dev.genome-companion.kr/api/auth/callback/kakao` | [ ] |
| Production callback | `https://app.genome-companion.kr/api/auth/callback/kakao` | [ ] |
| Logout callback | Exact released `/api/auth/logout/kakao/complete` URL, registered without wildcard | [ ] |
| Unlink handling | Reviewed unlink webhook route, signature/authorization policy, deletion and retry evidence | [ ] |
| Store secrets | `KAKAO_CLIENT_ID` (REST API key) and `KAKAO_CLIENT_SECRET`, separate per environment | [ ] |
| Record non-secret evidence | App ID, owner, review state, callback set, consent version, rotation date, secret ARN/VersionId | [ ] |

Pinned protocol: issuer `https://kauth.kakao.com`; Discovery `https://kauth.kakao.com/.well-known/openid-configuration`; S256 PKCE; RS256 ID token; nonce required by our contract. Kakao token logout is `POST https://kapi.kakao.com/v1/user/logout`; account-and-service logout is a separate browser flow at `https://kauth.kakao.com/oauth/logout`. Do not confuse logout with unlink or internal account deletion.

## 3. Naver Login

Official references: [Naver Login web guide](https://developers.naver.com/docs/login/web/web.md), [Naver Login API specification](https://developers.naver.com/docs/login/api/api.md), [application console](https://developers.naver.com/apps/).

| Action | Exact value or evidence | Status |
|---|---|---|
| Create staging app | Web service URL `https://app.dev.genome-companion.kr` | [ ] |
| Create production app later | Only after staging conformance and provider review | [ ] |
| Enable protocol | OIDC Authorization Code, S256 PKCE, `openid`; client authentication `client_secret_post` | [ ] |
| Minimal profile | Do not request optional email/name/phone/profile data for first release | [ ] |
| Staging callback | `https://app.dev.genome-companion.kr/api/auth/callback/naver` | [ ] |
| Production callback | `https://app.genome-companion.kr/api/auth/callback/naver` | [ ] |
| Service review | Submit released login, privacy, withdrawal, deletion, support, and brand screens | [ ] |
| Token revocation | Server-side `POST https://nid.naver.com/oauth2.0/revoke`; test idempotent HTTP 200 handling | [ ] |
| Store secrets | `NAVER_CLIENT_ID` and `NAVER_CLIENT_SECRET`, separate per environment | [ ] |
| Record non-secret evidence | App ID, owner, review approval, callback set, scopes, rotation date, secret ARN/VersionId | [ ] |

Pinned protocol observed 2026-08-12: issuer `https://nid.naver.com`; Discovery `https://nid.naver.com/.well-known/openid-configuration`; authorization `https://nid.naver.com/oauth2/authorize`; token `https://nid.naver.com/oauth2/token`; JWKS `https://nid.naver.com/oauth2/jwks`; RS256; pairwise subject; S256 PKCE. The general OAuth API uses `.0` endpoints, including the revoke endpoint. Keep these paths distinct. Naver does not provide a third-party API that logs the user out of the Naver service itself.

## 4. Competition and research-data access

These credentials are not needed for the current offline public-metadata agent.

| Provider | Human action | Secret/config to store | Status |
|---|---|---|---|
| DataON | Create eligible account; apply separately for research-data search and metadata-detail APIs; register fixed egress IP | `DATAON_OPENAPI_KEY`, approval IDs, registered IPs, 24-month expiry/renewal date | [ ] |
| AIDA | Create account; request OpenAPI access; obtain data/model-specific reuse decisions before download | `AIDA_OPENAPI_KEY`, approval ID, quota, expiry | [ ] |
| DataON/AIDA competition | Confirm eligibility, submission template, publication obligation, code/data/model disclosure, commercialization, duplicate-entry rule | Organizer response date and decision; no secret | [ ] |
| Daejeon competition | Confirm student eligibility/team, allowed collaborators, required designated dataset, ownership and publication | Organizer response date and decision; no secret | [ ] |
| NRF/Innopolis data | Select only datasets that materially support the Daejeon problem; record schema, license and attribution | Dataset IDs and rights record; key only if the selected source requires one | [ ] |

DataON approval is IP-restricted and currently has two separate relevant services. Do not assume search approval also permits detail lookup, raw-file download, redistribution, or model training.

## 5. Korean public health-reference APIs

Portal: [공공데이터포털](https://www.data.go.kr/) and [HIRA Open Data](https://opendata.hira.or.kr/). Use server-side keys only and create one rights row per dataset even when the portal reuses the same account key.

| Priority | Dataset ID | Intended product use | Secret name suggestion | Status |
|---|---:|---|---|---|
| First | HIRA `15001698` 병원정보서비스 | Institution identity/location; not capacity or quality ranking | `HIRA_HOSPITAL_INFO_SERVICE_KEY` | [ ] |
| First | HIRA `15001699` 병원상세정보서비스 | Staffing/equipment reference with freshness disclosure | `HIRA_HOSPITAL_DETAIL_SERVICE_KEY` | [ ] |
| First | HIRA `15001700` 비급여 진료비정보 | Historical amounts; not a quote or recommendation | `HIRA_NONCOVERED_PRICE_SERVICE_KEY` | [ ] |
| First | NHIS `15154419` 검진기관 찾기 조회 | Checkup-provider search | `NHIS_CHECKUP_PROVIDER_SERVICE_KEY` | [ ] |
| Optional | NHIS `15059029` 장기요양기관 | Separate care-navigation product review first | `NHIS_LONG_TERM_CARE_SERVICE_KEY` | [ ] |
| Optional | KDCA `15084296`, `15087442` | Codes or evidence content only | `KDCA_REFERENCE_SERVICE_KEY` | [ ] |
| Optional | NEMC `15000563`, `15000652` | Emergency/AED navigation; never replace 119 | `NEMC_REFERENCE_SERVICE_KEY` | [ ] |
| Optional | MFDS `15056780`, `15075057` | Education only; no prescribing/dosing/interaction claim | `MFDS_REFERENCE_SERVICE_KEY` | [ ] |

For each enabled dataset record: application ID, development/production approval, terms and attribution version, Base URL/schema version, quota, approved purpose, freshness rule, source verification date, kill switch, owner, and secret ARN/VersionId. Public API approval does not grant personal NHIS record access and does not authorize commercial reuse beyond the listed license.

## 6. Personal health records: Health Information Highway / MyHealthWay

Official references: [건강정보 고속도로](https://www.myhealthway.go.kr/portal/), [기관용 표준 API overview](https://myhealthway.go.kr/portal/index?page=Organization%2FPortal%2FMediMyData%2FMydataApi).

This is an institutional onboarding and conformity program, not a simple API-key purchase and not a generic NHIS ID/password login.

| Gate | Human/external result | Status |
|---|---|---|
| Organization eligibility | Approved participating legal entity and named contacts | [ ] |
| Testbed | Current implementation guide, assigned organization/client identifiers, test certificates and endpoints | [ ] |
| Data contract | Exact FHIR/KR Core resources, purposes, categories, duration, revocation, correction, retention and deletion | [ ] |
| Conformance | Passed test cases and signed conformity result | [ ] |
| Privacy/security | Intended-use, PIPA, DPIA, threat-model, incident and audit approval | [ ] |
| Production transition | Production certificate/client registration, endpoint allowlist, quotas, rotation owner and go-live approval | [ ] |

Store certificate/private-key material and client credentials in isolated, exact-version secrets. No scraping, shared member credential, caller-controlled enable flag, or production access before all gates pass.

## 7. Infrastructure, release and distribution

| System | What to obtain | Credential rule | Status |
|---|---|---|---|
| GitHub organization | Repository ownership, branch protection, reviewers, protected environments, signed release policy | Human accounts use MFA; workflows use no stored cloud access key | [ ] |
| AWS organization/accounts | Application, security/log archive, billing, Identity Center, break-glass, budgets and incident alerts | GitHub uses OIDC short-lived roles; root and break-glass held separately | [ ] |
| DNS/certificates | Staging/production/API names and ACM validation | Registrar/DNS MFA; no wildcard provider callback | [ ] |
| Apple Developer | Legal enrollment, App Store Connect, app ID, privacy declarations | Distribution signing outside ordinary CI | [ ] |
| Google Play | Legal enrollment, app ownership, data-safety form, Play App Signing | Distribution key custody separated from development | [ ] |

## 8. Deliberately deferred or not needed

- KakaoTalk messaging, Naver Maps/Search, SMS, push, email marketing, advertising, tag managers, and user-level analytics are not required for the current product slice. Add one only after a named user journey, data map, retention rule, vendor review, and kill switch exist.
- No OpenAI API key is needed for the current offline medical-document runner.
- Nanonets GRAFT can be evaluated locally from pinned source/weights; no external hosted API key is assumed or requested.
- No real patient account, NHIS password, MyHealthWay production credential, or personal health record is needed for automated tests.
- No long-lived AWS access key is permitted for GitHub Actions.

## Final execution order

1. Finish Section 1 and the competition eligibility decisions.
2. Lock domain, GitHub and AWS human access, MFA, recovery and billing.
3. Create staging Kakao/Naver apps and store secrets directly in the approved secret manager.
4. Run staging conformance with dedicated non-health test accounts; then submit provider reviews.
5. Apply for DataON/AIDA and the four first-priority public reference APIs.
6. Start MyHealthWay organization/testbed work on its own timeline without blocking the MVP.
7. Create production provider apps only after staging evidence and independent security review pass.
8. Record only non-secret approvals and secret coordinates; rotate or revoke anything exposed during setup.
