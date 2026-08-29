# Public and government data radar

**Review date:** 2026-08-30 (Asia/Seoul)
**Boundary:** public/reference data and personal health data are separate products of separate authorization flows.

## Personal-record route

| Source | Plane | Verified capability | Access reality | Product state | Unknowns / next evidence |
|---|---|---|---|---|---|
| MyHealthWay / Health Information Highway | Personal health data | Official clinical/public query APIs, dynamic consent, authentication support, and FHIR exchange; public data-type page lists 12 FHIR items | Utilization-service designation → testbed application/approval → test cases → conformity review → operations transition | `DISABLED ADAPTER SEAM`; no key, account, testbed, conformity, or production connection | One-time snapshot/local retention/disconnection semantics are `UNKNOWN`; obtain current implementation guide and written program answer |
| User upload | Personal health data | Product-controlled intake route for PDF/image/CSV/DICOM only after type-specific controls | Local synthetic pipeline exists for one allowlisted PDF flow | Synthetic fixture only; OCR/model worker absent | Template corpus, consent copy, malware/parser isolation, deletion, correction, and OCR abstention benchmark |
| Phone/wearable | Personal health data | Platform APIs can expose user-authorized measurements, subject to device/platform contracts | No connector implemented or authorized | `PLANNED` | Select first platform and exact fields only after product-value/privacy review |

Primary sources: [MyHealthWay API](https://myhealthway.go.kr/portal/index?page=Individual%2FPortal%2FMediMyData%2FMydataApi), [data types](https://www.myhealthway.go.kr/portal/index?page=Individual%2FPortal%2FMediMyData%2FMydataType), [designation](https://myhealthway.go.kr/portal/index?page=Organization%2FPortal%2FPortalFunction%2FOrFunctionPerScreeing), [testbed](https://tb.myhealthway.go.kr/portal/index?page=MediMyData%2FTestbedManual).

## Public/reference routes

| Dataset | What it can support | What it cannot support | Credential / rights state | Engineering state |
|---|---|---|---|---|
| HIRA drug ingredients, dataset 15021027 | Product/ingredient/classification reference context | A person's prescription, dispensing, adherence, diagnosis, or response | Catalog states REST/XML, automatic development approval, Public Nuri Type 1; no key obtained | Contract and provenance fields to be designed; connector disabled |
| MFDS DUR, dataset 15059486 | Published contraindication/restriction reference categories | Patient-specific interaction clearance, prescribing, dosing, or treatment | Public Data Portal access still requires project registration/key and dataset-specific review; no key obtained | Contract and safety copy to be designed; connector disabled |
| HIRA non-covered price, dataset 15001700 | Provider/item amounts and aggregate comparison context | Final quote, bill, provider quality, recommendation, or referral | Development access described as automatic, but rights/content-use review remains; no key obtained | Existing plan only; connector not production-ready |
| NHIS health-checkup institution, dataset 15154419 | Searchable facility reference for the annual-checkup wedge | Appointment availability, quality, eligibility, or individual records | No key obtained | Candidate after freshness/schema review |
| KOSIS / KDCA aggregates | Population context with dimensions, units, notes, and dates | Individual inference or personal medical advice | Dataset-specific license/access; no key obtained | Research/reference only |

Primary sources: [HIRA ingredients](https://www.data.go.kr/data/15021027/openapi.do), [MFDS DUR](https://www.data.go.kr/data/15059486/openapi.do), [HIRA non-covered](https://www.data.go.kr/data/15001700/openapi.do), [Public Data policy](https://www.data.go.kr/ugs/selectPortalPolicyView.do).

## Connector admission gates

1. A dataset-specific owner, purpose, fields, schema/version, license, attribution, freshness rule, rate limit, and deletion/refresh behavior are committed.
2. Credentials stay server-side and are scoped to the exact connector; no browser token or shared cross-plane credential.
3. Raw response receipts, retrieval time, source period, transform version, and displayed caveat remain linked.
4. A public reference record can annotate a user-confirmed medication fact but can never create one.
5. Contract, replay, stale-data, schema-drift, rate-limit, outage, and wrong-join tests pass before enablement.
6. MyHealthWay activation requires its own designation/conformity evidence and cannot inherit approval from Public Data Portal connectors.

## Founder batch later—not required for current local development

When external setup is finally authorized, perform it once from the maintained founder action register: create the organizational identities, apply for exact dataset access, provide exact redirect/callback domains, and store credentials in the approved secret manager. Until then every connector remains disabled and tests use synthetic fixtures.
