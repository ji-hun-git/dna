# Primary-Source Register

Accessed: 2026-08-08 (Asia/Seoul). This is a living evidence register, not a formal legal opinion. Before a release or procurement decision, re-open the linked source and record the then-current version, effective date, license, and applicability.

## Evidence rules

- Laws, regulator guidance, government dataset catalogs, standards bodies, vendor documentation, and upstream repositories are primary sources.
- A catalog's “real-time” or “open” label is not a freshness SLA or a blanket commercial-use license.
- `source period`, `published at`, `retrieved at`, `license`, `schema/version`, and `transform version` are separate fields.
- Research datasets are not production APIs. Public aggregate data is not patient-level truth.
- Any conflict is resolved against the current operative legal text, approved implementation guide, signed contract, or regulator decision—not this summary.

## South Korean public and personal health data

| Authority/source | Primary link | What it establishes | Product treatment |
|---|---|---|---|
| Public Data Portal | [API-key/Swagger guide](https://www.data.go.kr/images/biz/swagger-guide/gw/gateway_swagger_guide.pdf) | `serviceKey`, application/approval, endpoint-specific schemas. | Keys remain server-side; build one versioned connector per dataset. |
| Public Data Portal | [License policy](https://www.data.go.kr/ugs/selectPortalPolicyView.do) | Public Nuri types and commercial/modification restrictions. | Type 0/1 usually eligible subject to terms; Type 2/4 excluded from commercial product without permission; Type 3 no-transform limitation reviewed individually. |
| HIRA | [Open API guide](https://opendata.hira.or.kr/op/opc/selectOpenApiInfoView.do) | HIRA catalog/usage route. | Use documented APIs, never scrape the portal. |
| HIRA | [Hospital information API](https://www.data.go.kr/data/15001698/openapi.do) | Hospital identity/location dataset and endpoint terms. | Public-reference plane; retain attribution, timestamps, and caveats. |
| HIRA | [Hospital detail API](https://www.data.go.kr/data/15001699/openapi.do) | Staffing/equipment and institution details. | Public-reference plane; do not represent catalog data as live capacity. |
| HIRA | [Non-covered price API](https://www.data.go.kr/data/15001700/openapi.do) | Non-covered medical fee information. | Core comparison candidate; normalize units/time period and show source/caveat. |
| HIRA | [Health-data access overview](https://opendata.hira.or.kr/op/opb/selectHelhMedDataInfoView.do) | Samples, customized claims, controlled CDM/code and output-review paths. | Controlled-research plane only; no product personalization from research rows. |
| NHIS | [Big Data Platform](https://nhiss.nhis.or.kr/) | Research data environment and services. | Controlled research, not a production feed. |
| NHIS | [Research procedure](https://nhiss.nhis.or.kr/lp/z/z/999/lpzzcms.do?cntsKeyVl=J) and [custom DB](https://nhiss.nhis.or.kr/lp/z/z/999/lpzzcms.do?cntsKeyVl=E) | IRB/review, secure environment, reviewed output, recovery/deletion. | Separate project environment; only approved aggregates can leave. |
| NHIS | [Long-term-care institution API](https://www.data.go.kr/data/15059029/openapi.do) | A public production directory API with its own terms. | Optional livelihood/care-navigation reference source. |
| NHIS | [Health-checkup institution API](https://www.data.go.kr/data/15154419/openapi.do) | Searchable national checkup-provider information. | Candidate for the annual-checkup wedge; verify every displayed facility field and freshness. |
| KDCA | [Public-data directory](https://www.kdca.go.kr/KDCAtemp/5309/subview.do) | Official routes to infectious disease, KNHANES, chronic-disease and file/API data. | Use source-specific adapters and licenses. |
| KDCA | [Community Health Survey data principles](https://chs.kdca.go.kr/chs/rawDta/rawDtaPrncplMain.do) | Distinguishes public-use and controlled pseudonymized data with use/export restrictions. | Research plane only where approval/terms require. |
| KDCA | [Community Health Survey access](https://chs.kdca.go.kr/chs/rawDta/rawDtaProvdMain.do) | Application and file-delivery process. | Not a live production feed. |
| KDCA | [Infectious-disease aggregate API](https://www.data.go.kr/data/15139178/openapi.do) | REST JSON/XML dataset with Public Nuri Type 4 status. | Do not commercially reuse without separate permission. |
| KDCA | [National Health Information Portal API](https://www.data.go.kr/data/15087442/openapi.do) | Expert-reviewed health-information content route. | Evidence candidate only after content-use permission and version review. |
| MOHW | [Public-health-center counts](https://www.data.go.kr/data/15098822/openapi.do), [hospital/clinic counts](https://www.data.go.kr/data/15098823/openapi.do), [insurance aggregates](https://www.data.go.kr/data/15098787/openapi.do) | Annual macro health/welfare indicators and calculation notes. | Market/context analytics, never individual guidance or live capacity. |
| KOSIS | [Open API introduction](https://kosis.kr/openapi/introduce/introduce_01List.do) and [portal](https://kosis.kr/openapi/index/index.jsp) | REST/HTTPS statistics, registration, formats, rate/cell limits. | Preserve table IDs, dimensions, units, notes, source, dates, and suppression. |
| KOSIS | [Table metadata guide](https://kosis.kr/openapi/devGuide/devGuide_060101List.do) | Metadata endpoints for units, notes, dimensions, sources, and update dates. | Ingest metadata with every statistical value. |
| MyHealthWay | [Individual service](https://www.myhealthway.go.kr/portal/index?page=Individual%2FPortal%2FMediMyData%2FMydataService) and [organization service](https://www.myhealthway.go.kr/portal/index?page=Organization%2FPortal%2FMediMyData%2FMydataService) | Official consented personal-data exchange route. | Personal plane only, with verified identity, explicit purpose, consent, revocation, and audit. |
| MyHealthWay | [API description](https://www.myhealthway.go.kr/portal/index?page=Organization%2FPortal%2FMediMyData%2FMydataApi) | Clinical/public queries, dynamic consent, authentication/support, FHIR-based exchange. | Use formal onboarding; do not simulate with scraping or shared credentials. |
| MyHealthWay | [Testbed process](https://tb.myhealthway.go.kr/portal/index?page=MediMyData%2FTestbedManual) | Organization registration, testing, conformity review, production transition. | A product dependency and separate delivery workstream, not an ordinary API signup. |
| KHIS | [FHIR/KR Core overview](https://www.k-his.or.kr/menu.es?mid=a20203020000) and [2026 standard revision](https://www.k-his.or.kr/board.es?act=view&bid=0001&list_no=2265&mid=a10301000000) | Korean profiles/resources and national standard revision. | Conformance suite must pin the approved package and migration path. |
| NEMC | [Emergency institution API](https://www.data.go.kr/data/15000563/openapi.do) and [AED API](https://www.data.go.kr/data/15000652/openapi.do) | Emergency/AED reference datasets with operational caveats. | Reference/navigation only; never replace 119 or emergency dispatch. |
| MFDS | [DUR contraindications](https://www.data.go.kr/data/15056780/openapi.do) and [consumer drug information](https://www.data.go.kr/data/15075057/openapi.do) | Medication reference APIs. | Searchable education/reference; no autonomous prescribing, dosing, or interaction clearance. |

## Interoperability and terminology

| Source | Primary link | Decision |
|---|---|---|
| HL7 Korea | [KR Core STU2 / 2.0.0 downloads](https://www.hl7korea.or.kr/fhir/krcore/STU2/downloads.html) | Korea exchange conformance package for the current FHIR R4 baseline. |
| HL7 | [FHIR R4](https://hl7.org/fhir/R4/) | Canonical patient health exchange model. |
| HL7 | [FHIR R4 Provenance](https://hl7.org/fhir/R4/provenance.html) | Record origin/transformation assertions. |
| HL7 | [FHIR R4 AuditEvent](https://hl7.org/fhir/R4/auditevent.html) | Security event records; updates/deletes normally restricted. |
| LOINC | [FHIR terminology service](https://loinc.org/fhir/) and [license](https://loinc.org/license) | Observation/lab terminology, versioning, and license. The hosted FHIR API is beta and not recommended by LOINC as a production dependency; load a pinned release internally. |
| SNOMED International | [Republic of Korea member page](https://www.snomed.org/members/republic-of-korea) | Korea is a member and KHIS is the national contact. Obtain/distribute through the Korean release/licensing route and version every mapping. |
| UCUM | [Official specification](https://ucum.org/ucum) | Machine-readable units. Preserve source units, normalized value, conversion rule, and original text. |

## Korean legal and regulatory baseline

| Topic | Primary link | Planning conclusion |
|---|---|---|
| PIPA sensitive data | [Article 23](https://www.law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1027416043) | Health information is sensitive; use a separate lawful basis/consent and strengthened safeguards. |
| PIPA security | [Article 29](https://www.law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1033215737) and [security-measures standard](https://www.law.go.kr/LSW/admRulLsInfoP.do?admRulSeq=2100000265956) | Administrative, technical, and physical safeguards are mandatory. |
| PIPA deletion | [Article 21](https://www.law.go.kr/LSW/lsLinkCommonInfo.do?ancYnChk=&chrClsCd=010202&lsJoLnkSeq=1020398651) | Destroy unnecessary data without delay and segregate legally retained data. |
| PIPA overseas transfers | [Article 28-8](https://www.law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1029334953) and [PIPC guidance](https://www.pipc.go.kr/np/default/page.do?mCode=D060040010) | Foreign storage, provision, or remote access needs a statutory basis and prescribed disclosure/safeguards. |
| Pseudonymized data | [Article 28-2](https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1020398653), [Article 28-3](https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1026813369), and [healthcare-data guidance](https://www.pipc.go.kr/np/cop/bbs/selectBoardArticle.do?bbsId=BS217&mCode=&nttId=12183) | Research/statistics pathways are governed; cross-controller combination and export are not ordinary application joins. |
| Medical patient referral | [Medical Service Act Article 27](https://www.law.go.kr/LSW/lsInfoP.do?ancYnChk=0&chrClsCd=010202&efYd=20260212&joNo=002700&lsiSeq=279731&urlMode=lsInfoP) | Baseline excludes profit-driven patient introduction/referral/solicitation. |
| Referral case law | [Supreme Court decision](https://law.go.kr/LSW/precInfoP.do?mode=0&precSeq=207141) | Transaction intermediation plus fee can exceed neutral medical advertising/information. Exact business mechanics need Korean counsel. |
| Digital medical products | [Act definition](https://law.go.kr/LSW/lsLinkCommonInfo.do?lsJoLnkSeq=1031809295), [classification rules](https://www.law.go.kr/admRulLsInfoP.do?admRulId=92541&efYd=0), and [MFDS 2026 guide](https://www.mfds.go.kr/law/board/boardDetail.do?brdId=data0011&menuKey=29&seq=15833) | Intended use—not a disclaimer alone—determines medical-device/health-support obligations. Seek written classification before scope freeze. |
| AI transparency/high impact | [AI Act Article 31](https://www.law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1031809547), [Article 34](https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1031810845), and [PIPC generative-AI privacy guide](https://pipc.go.kr/np/cop/bbs/selectBoardArticle.do?bbsId=BS074&mCode=C020010000&nttId=11410) | Disclose generative AI; assess high-impact status, risk management, explanation, oversight, and documentation. |
| ISMS-P | [KISA scheme and controls](https://isms-p.kisa.or.kr/main/ispims/intro/) and [certification target](https://www.isms-p.or.kr/cert/aply/selectCertTrgtDetail.do) | Build toward the control set from day one; mandatory status is threshold/category dependent and must be reviewed annually. |

## Security and AI governance

| Source | Primary link | Application |
|---|---|---|
| NIST | [CSF 2.0](https://www.nist.gov/publications/nist-cybersecurity-framework-csf-20) | Organization-wide Govern, Identify, Protect, Detect, Respond, Recover program. |
| NIST | [SP 800-207 Zero Trust](https://csrc.nist.gov/pubs/sp/800/207/final) | No implicit trust; authenticate/authorize every human, workload, device, and resource request. |
| NIST | [SP 800-218 SSDF](https://csrc.nist.gov/pubs/sp/800/218/final), [AI profile](https://csrc.nist.gov/pubs/sp/800/218/a/final), and [CI/CD guidance](https://csrc.nist.gov/pubs/sp/800/204/d/final) | Secure development, AI-specific practices, and supply-chain controls. |
| NIST | [AI RMF](https://www.nist.gov/itl/ai-risk-management-framework) | Govern, Map, Measure, Manage AI risk and trustworthiness. |
| NIST | [SP 800-57 key management](https://csrc.nist.gov/pubs/sp/800/57/pt1/r5/final) | Key lifecycle, roles, algorithms, protection, rotation, revocation, recovery. |
| NIST | [SP 800-61r3 incident response](https://csrc.nist.gov/pubs/sp/800/61/r3/final) and [SP 800-88r2 sanitization](https://csrc.nist.gov/pubs/sp/800/88/r2/final) | Incident lifecycle and media/data sanitization. |
| OWASP | [MASVS/MASTG](https://owasp.org/www-project-mobile-app-security/) | Mobile security verification and testing. |
| OWASP | [API Security Top 10 2023](https://owasp.org/API-Security/editions/2023/en/0x00-header/) | Object/property/function authorization, inventory, resource and third-party API risks. |
| OWASP | [LLM Top 10 2025](https://owasp.org/www-project-top-10-for-large-language-model-applications/assets/PDF/OWASP-Top-10-for-LLMs-v2025.pdf) | Prompt injection, sensitive disclosure, excessive agency, output handling, poisoning, and other LLM risks. |
| AWS | [Shared responsibility](https://docs.aws.amazon.com/whitepapers/latest/aws-risk-and-compliance/shared-responsibility-model.html) and [K-ISMS renewal](https://aws.amazon.com/ko/blogs/korea/aws-renews-k-isms-certificate-for-the-asia-pacific/) | Provider certification does not certify the application; recheck certificate scope/expiry before procurement. |
| AWS | [KMS envelope encryption](https://docs.aws.amazon.com/kms/latest/developerguide/kms-cryptography.html) | Per-object/user data keys protected by managed root keys. |
| AWS | [S3 Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html) | WORM retention for narrowly scoped logs/backups; not absolute tamper-proofing and not suitable for unnecessary health content. |

## Conditional US expansion

| Topic | Primary link | Planning conclusion |
|---|---|---|
| HIPAA applicability | [HHS covered entities/business associates](https://www.hhs.gov/hipaa/for-professionals/covered-entities/index.html) and [health apps](https://www.hhs.gov/hipaa/for-professionals/special-topics/health-apps/index.html) | HIPAA applies based on role, not because data is “health data.” A DTC app may be outside HIPAA; a provider integration can create business-associate status and a BAA. |
| HIPAA Security Rule | [HHS Security Rule](https://www.hhs.gov/hipaa/for-professionals/security/index.html) | Administrative, physical, and technical safeguards for ePHI where applicable. The 2024 strengthening proposal is not treated as final law. |
| FTC Health Breach Notification Rule | [Rule](https://www.ftc.gov/legal-library/browse/rules/health-breach-notification-rule) and [business guidance](https://www.ftc.gov/business-guidance/resources/complying-ftcs-health-breach-notification-rule-0) | Likely relevant to a non-HIPAA consumer health app combining multiple sources; unauthorized SDK disclosure may count as a breach. |
| FDA general wellness/CDS | [2026 General Wellness guidance](https://www.fda.gov/media/90652/download) and [2026 CDS guidance](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/clinical-decision-support-software) | Separate US intended-use gate; patient-facing advice can remain device-regulated despite “educational” labels. |
| Washington | [My Health My Data, Attorney General](https://www.atg.wa.gov/protecting-washingtonians-personal-health-data-and-privacy) | State consumer-health privacy obligations outside HIPAA. |

## Known source conflicts and open checks

1. MyHealthWay public pages currently disagree on whether ten or twelve data categories are supported. The approved production implementation guide and conformity test result control.
2. Catalog freshness labels can be stale. Ingestion promotes data only after actual watermarks and plausibility checks pass.
3. AWS's cited K-ISMS certificate is stated as valid through 2026-12-15; procurement must obtain the current Artifact/certificate and scope.
4. PIPA provisions effective in September 2026 and broader ISMS-P changes expected in 2027 require a release-time legal refresh.
5. Every HIRA/KDCA/MOHW/NHIS dataset license and third-party-rights notice is stored at dataset level; agency-level assumptions are prohibited.
