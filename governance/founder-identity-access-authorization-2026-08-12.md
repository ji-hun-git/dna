# Founder Identity and Health-Access Direction — 2026-08-12

**Approver:** Founder

**Approval statement:** Continue implementation, add an anti-hack workflow, and prepare user access through Kakao, Naver, and the official Korean health-information route.

## Authorized local work

- Define Kakao and Naver as staged OIDC Authorization Code providers with S256 PKCE, exact callback and egress allowlists, server-only secrets, one-time transactions, and provider-specific verification.
- Build a fail-closed anti-hack workflow for login tamper, replay, forged identity, account-link collision, abusive retries, credential exposure, and invalid provider events.
- Build and test the disabled Health Information Highway/MyHealthWay connector contract that can be activated only after formal organization onboarding, testbed approval, conformity approval, production-transition approval, and privacy/intended-use review.
- Use only synthetic identifiers and local tests.

## Not authorized by this record

- Creating or modifying Kakao, Naver, NHIS, MyHealthWay, cloud, DNS, or other external accounts.
- Issuing or storing real client IDs, client secrets, tokens, signing keys, or health-data credentials.
- Calling production identity or health-data APIs, scraping NHIS pages, using shared credentials, or collecting personal health information.
- Merging accounts by email, phone number, name, or other mutable profile data.
- Deploying, opening a beta, or claiming that the integrations are live before their external approvals and release gates complete.

## Binding interpretation

Social login is authentication convenience, not health-data consent. The internal account key is the exact provider issuer plus provider subject, and linking to an existing account requires a recent authenticated session and explicit confirmation. Personal health retrieval remains a separate purpose-bound consent flow through the official Health Information Highway/MyHealthWay route. The founder-approved post-MVP status of MyHealthWay remains unchanged.

## Traceability

- Implementation plan: [`../docs/superpowers/plans/2026-08-12-identity-health-access-antihack.md`](../docs/superpowers/plans/2026-08-12-identity-health-access-antihack.md)
- Decision log: [`decision-log.md`](decision-log.md)
- Risk register: [`../risks/risk-register.md`](../risks/risk-register.md)
- Primary sources: [`../research/sources/primary-source-register.md`](../research/sources/primary-source-register.md)
