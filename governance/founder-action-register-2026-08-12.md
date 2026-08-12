# Founder Action Register

**Owner:** Jason

**Updated:** 2026-08-12

**Purpose:** one list of external decisions, accounts, evidence, and approvals that only the founder or an authorized human can complete. Product coding, synthetic tests, design, and documentation continue without these items unless the row says `NOW`.

Exact provider callbacks, credential names, current protocol endpoints, and the recommended one-day setup order are consolidated in [`founder-provider-api-register-2026-08-12.md`](founder-provider-api-register-2026-08-12.md).

## Rules

- Never paste secrets, API keys, passwords, private keys, recovery codes, real health records, or government IDs into GitHub, Codex, this file, screenshots, or committed `.env` files.
- A checkbox means the real external action and its evidence are complete. Creating a local mock does not complete an external action.
- Use separate staging and production applications. Store secrets in AWS Secrets Manager and record only the ARN and exact VersionId in protected release configuration.
- Do not submit the same problem definition, evaluation set, report, or result as both competition entries.
- No live patient data is needed for either competition prototype.

## A. Do these first — competition eligibility and ownership

| When | Founder action | Completion evidence | Done |
|---|---|---|---|
| `NOW` | Confirm whether you or a real team member is enrolled at a Daejeon/Sejong university as an undergraduate or graduate student | Current enrollment certificate and institution name held privately | [ ] |
| `NOW` | If eligible, name the Daejeon competition team of 1–4 real people and appoint one submitter | Names, roles, contact channel, each member’s consent | [ ] |
| `NOW` | If not eligible, decide whether to find an eligible genuine collaborator or withdraw from that competition | Written go/no-go decision by 2026-08-14 | [ ] |
| `NOW` | Confirm the DataON/AIDA 2026 problem-discovery submission identity: individual, team, institution, or company | Official platform rule and selected submitter | [ ] |
| `NOW` | Approve the two distinct entry narratives | DataON/AIDA = general research-data reuse; Daejeon = regional research-support discovery | [ ] |
| `NOW` | Designate who owns competition correspondence and final submission | Named owner and backup | [ ] |

## B. Competition organizer questions

Send one concise email per organizer. Save the response PDF or email export outside Git and record only its date and decision here later.

### DataON/AIDA organizer

- [ ] Confirm the official 2026 submission URL and current problem-discovery template.
- [ ] Confirm individual/team/institution eligibility for both problem discovery and problem solving.
- [ ] Ask exactly what a winning work must publish through DataON/AIDA: report, code, weights, container, data, or all of them.
- [ ] Confirm whether a commercial startup may enter and later commercialize independently written product code.
- [ ] Confirm whether using DataON metadata plus AIDA and NRF public metadata satisfies the cross-domain fusion bonus.
- [ ] Confirm the rule on similar entries, prior submissions, and duplicate awards.
- [ ] Confirm whether automated metadata collection through approved OpenAPI may be included in the reproducibility package.

### Daejeon public-data organizer

- [ ] Confirm the exact enrollment evidence and whether leaves of absence, recent graduates, or company employees who are also students qualify.
- [ ] Confirm whether non-student mentors or company resources may assist without becoming team members.
- [ ] Confirm that one required agency dataset plus DataON/AIDA public metadata is an allowed combination.
- [ ] Confirm the minimum proof that a designated-agency dataset was actually used.
- [ ] Confirm whether a web prototype may remain credential-free and use frozen public metadata in the submitted demo.
- [ ] Confirm ownership, publication, and commercial reuse terms for submitted code and designs.

## C. Accounts and data access for the competitions

These are not needed to continue local development. Start after Section A is resolved.

| Priority | External action | Store privately | Done |
|---|---|---|---|
| First | Create or verify a DataON account with the eligible account type | Account owner, institution, MFA/recovery method | [ ] |
| First | Apply for DataON research-data search API | Approval ID, terms version, quota, allowed fixed IP | [ ] |
| First | Apply for DataON metadata-detail API | Approval ID, terms version, quota, allowed fixed IP | [ ] |
| First | Create or verify an AIDA account | Account owner, MFA/recovery method | [ ] |
| First | Apply for AIDA OpenAPI access | Approval ID, token owner, quota, expiration | [ ] |
| First | Apply to use DOI `10.23057/124` only if raw data becomes necessary | Approved purpose and nonredistribution conditions | [ ] |
| First | Ask for the exact reuse terms of DOI `10.23057/95` before downloading it | Written rights decision | [ ] |
| Optional | Request MediBioDeBERTa only after model license and evaluation scope are clear | License, provenance, checksum, approved research purpose | [ ] |
| Daejeon | Select one or more Korean Research Foundation public datasets | Dataset IDs, schemas, terms, source attribution | [ ] |
| Daejeon | Select Innopolis Foundation data only if it materially supports the regional story | Dataset IDs, schemas, terms, source attribution | [ ] |

When keys are issued, use the detailed [research-data external setup list](../docs/operations/research-data-external-setup.md). Do not send the keys to the development chat.

## D. Competition submission materials only a human must supply

- [ ] Final Korean team and affiliation names exactly as they should appear on certificates.
- [ ] Team member consent for submission and publication.
- [ ] A truthful 80–120 word founder/team introduction.
- [ ] One approved contact email and phone number for organizers.
- [ ] Institution or company logo only if you hold permission to use it.
- [ ] Final decision on whether the app name `앎` is used in competition materials.
- [ ] Signed originality and intellectual-property declarations.
- [ ] Confirmation that no submitted item contains client secrets, private repositories, PHI, or unlicensed raw data.
- [ ] Human review and final click on each submission before its deadline.

## E. Company foundation — prepare once, not required for current coding

- [ ] Korean legal entity name, registration number, representative, business address, and certificate.
- [ ] Product owner, privacy officer, security incident owner, billing owner, and provider-review contact.
- [ ] Domain-controlled emails for support, privacy, security/abuse, and provider review.
- [ ] Privacy policy, terms, account deletion, consent withdrawal, retention/deletion table.
- [ ] Written intended-use statement stating what the service does not diagnose, prescribe, or replace.
- [ ] Korean trademark and international name clearance for `앎` and the final company mark.
- [ ] Domain ownership and MFA for `genome-companion.kr` or the final approved domain.
- [ ] GitHub organization ownership, branch protection, required reviewers, recovery owners.
- [ ] AWS organization/account ownership, Identity Center users, MFA, billing alerts, break-glass custody.

## F. Identity providers — later staging setup

- [ ] Kakao Developers staging app, legal/business owner, exact callback URLs, OIDC `openid` only.
- [ ] Kakao production app only after staging conformance and service review.
- [ ] Naver Developers staging app, exact callback URLs, OIDC `openid` only.
- [ ] Naver production app only after staging conformance and review.
- [ ] Separate client credentials per environment, stored only as exact-version secrets.
- [ ] Provider screenshots, privacy/deletion pages, support contacts, unlink/revoke behavior.

## G. Korean health/public APIs — later and purpose-specific

- [ ] HIRA institution information `15001698`.
- [ ] HIRA institution details `15001699`.
- [ ] HIRA non-covered historical amounts `15001700`.
- [ ] NHIS checkup institution `15154419`.
- [ ] Optional KDCA/NEMC/MFDS datasets only after their matching user screen exists.
- [ ] For each dataset: terms version, attribution, quota, field schema, freshness, kill switch, secret VersionId.
- [ ] Do not request a generic member-password or scraping route for NHIS personal records.

## H. Personal health exchange — institutional work, not an API-key task

- [ ] Confirm eligible participating-organization status for the Health Information Highway/MyHealthWay route.
- [ ] Register the organization and named technical/privacy/security contacts.
- [ ] Obtain the current testbed guide, certificates, and KR Core/FHIR scope through the official channel.
- [ ] Approve exact purposes, categories, duration, revocation, correction, retention, and deletion.
- [ ] Complete testbed, conformity, privacy, security, and production-transition reviews.

## I. Mobile and public release — only after release candidates exist

- [ ] Apple Developer Program and App Store Connect legal ownership.
- [ ] Google Play Console legal ownership and Play App Signing.
- [ ] Store privacy/data-safety declarations based on the actual build.
- [ ] Distribution signing custody outside ordinary CI.
- [ ] Demo accounts containing no PHI.
- [ ] App-store medical/intended-use review notes and Korean support contact.

## J. Independent assurance before real users

- [ ] Korean privacy-law review of actual data flows and processors.
- [ ] MFDS intended-use/classification assessment of the actual product build.
- [ ] DPIA and threat model.
- [ ] Independent penetration test and remediation verification.
- [ ] Incident response and disaster-recovery drills.
- [ ] Dataset/model/font/icon/content license register.
- [ ] Cyber insurance and external breach counsel decision, if appropriate for the entity and launch scope.

## What Jason does not need to do now

- No OpenAI API key for the current offline medical-document pipeline.
- No real health record or provider member account for automated tests.
- No production AWS access key; GitHub must use short-lived OIDC roles.
- No Kakao/Naver secret before staging routes and policies are ready.
- No MyHealthWay credential before institutional eligibility and testbed acceptance.
- No AIDA model download for the current public-metadata agent.

## Immediate founder sequence

1. Resolve Daejeon student eligibility by 2026-08-14.
2. Send the two organizer question lists.
3. Choose the exact submitters and team names.
4. Create DataON and AIDA accounts, but do not send credentials to the development team.
5. Select and record the NRF/Innopolis datasets for the Daejeon entry.
6. Review the two distinct Korean entry titles and intended-use boundary.
7. Leave the remaining sections deferred while development continues.
