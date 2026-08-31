# Regulatory radar

**Review date:** 2026-08-30 (Asia/Seoul)
**Purpose:** engineering issue-spotting, not legal advice. Operative law, regulator guidance, program implementation guides, contracts, and written counsel control.

| Topic | Current evidence | Product boundary | Status / next gate |
|---|---|---|---|
| Intended use / digital medical product | Korean law and MFDS classification materials make actual intended use and function material, not a disclaimer alone. | Personal-record organization, provenance, correction, descriptive trends, and source-linked education; no diagnosis, treatment, triage, prescribing, or patient management. | `OPEN LEGAL GATE`: obtain written Korean classification before scope freeze or real-data beta. |
| PIPA sensitive health information | Health information is sensitive data; security, minimization, purpose, deletion, and transfer duties apply. | Synthetic-only current development; separate consent and lifecycle required for any real data. | `NO-GO REAL DATA` until counsel, processor map, controls, notices/consents, incident/deletion/backup tests pass. |
| MyHealthWay | Official personal-data route exists, but utilization-service designation and testbed/conformity precede operations transition. | Disabled adapter only; no scraping, shared credentials, or government-connected UI claim. | `POST-MVP / UNKNOWN`: obtain designation materials and current implementation guide; verify snapshot/retention semantics. |
| KR Core / FHIR | D-008 selects FHIR R4 and `hl7.fhir.kr.core#2.0.0`; current projector only parses strict R4 observations. | Never call parsing “KR Core conformance.” | `NOT IMPLEMENTED`: package pin, validator, official profiles, terminology, fixtures, and negative conformance suite. |
| AI transparency and high-impact review | Korean AI transparency/high-impact duties and PIPC generative-AI privacy guidance require review of disclosure, risk, oversight, and documentation. | Disclose AI use; keep canonical facts deterministic/human-confirmed; prohibit general autonomous medical agent. | `OPEN`: complete applicability assessment before public AI feature. |
| Medical reference data | HIRA/MFDS public APIs provide reference content under dataset-specific terms. | Clear reference label; source/version/date; no personal-history inference, prescribing, or interaction clearance. | `DISABLED`: obtain exact keys/terms only after connector design and founder authorization. |
| Medical referral/business model | Medical Service Act Article 27 and cited case law create risk for profit-driven introduction/referral/intermediation. | No per-patient, per-booking, or success-based medical referral fee in the baseline. | `LEGAL REVIEW` before provider monetization or booking mechanics. |
| Genetics | Genetic data and interpretation carry a separate, higher-risk boundary. | Post-MVP device-only certified-result tuples under D-007; raw VCF/BAM/FASTQ and server genetics interpretation excluded. | `REJECTED CURRENTLY`; new regulated specification and approvals required. |
| Research / competition data | DataON/AIDA and controlled NHIS/KDCA data can carry competition, license, access, IP, publication, and export conditions. | Separate research plane; approved/public/synthetic data only; no product-personalization join. | `PROJECT-SPECIFIC REVIEW` before download, submission, publication, or model release. |

## Primary-source anchors

- [PIPA Article 23—sensitive data](https://www.law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1027416043)
- [PIPA Article 29—security](https://www.law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1033215737)
- [PIPA Article 21—deletion](https://www.law.go.kr/lsLinkCommonInfo.do?ancYnChk=&chrClsCd=010202&lsJoLnkSeq=1020398651)
- [Digital Medical Products Act](https://www.law.go.kr/법령/디지털의료제품법)
- [MFDS 2026 guide](https://www.mfds.go.kr/law/board/boardDetail.do?brdId=data0011&menuKey=29&seq=15833)
- [AI Act Article 31](https://www.law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1031809547) and [Article 34](https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1031810845)
- [MyHealthWay designation](https://myhealthway.go.kr/portal/index?page=Organization%2FPortal%2FPortalFunction%2FOrFunctionPerScreeing) and [testbed](https://tb.myhealthway.go.kr/portal/index?page=MediMyData%2FTestbedManual)
- [Medical Service Act Article 27](https://www.law.go.kr/LSW/lsInfoP.do?ancYnChk=0&chrClsCd=010202&efYd=20260212&joNo=002700&lsiSeq=279731&urlMode=lsInfoP)

## Change triggers

Re-run the regulatory review before any change to intended use, medical language, source-document retention, personal-data route, overseas processor/access, model/tool authority, research reuse, provider compensation, genetics, or real-user testing. A launch date never downgrades a failed gate.
