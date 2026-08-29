<!--
claim_intent_manifest:
  output: rapid evidence-to-engineering brief
  question: How should the synthetic-only Kotlin/Spring foundation admit FHIR R4 observations into a provenance-preserving candidate graph without implying clinical validity, KR Core conformance, or MyHealthWay readiness?
  intended_use: internal product and engineering decision support
  excluded_use: diagnosis, treatment, regulatory opinion, production approval, real-PHI processing
  evidence_cutoff: 2026-08-30 Asia/Seoul
  review_mode: academic-research-suite quick mode
-->

# From synthetic FHIR to a trustworthy personal Health History

**Date:** 2026-08-30 · **Mode:** rapid evidence-to-engineering review
**Decision:** proceed with a provenance-preserving **candidate** evidence graph; do not yet build a production government connector or medical agent.

## Research question and FINER assessment

**Question:** How should the current synthetic-only Kotlin/Spring foundation admit Synthea FHIR R4 observations into a provenance-preserving candidate model without implying MyHealthWay readiness, KR Core conformance, or clinical validity?

The question is feasible because HAPI FHIR, a synthetic generator, and tests are available without real health data. It is interesting and relevant because every later ingestion door needs the same subject, time, code, unit, source, and correction semantics. Its novelty is product-level: Korean government-route readiness plus a user-controlled evidence ledger, not a new clinical method. It is ethical within the synthetic candidate-only boundary. Overall FINER rating: **4.7/5**.

## Method

This was a rapid review, not a systematic review or legal opinion. Searches covered MyHealthWay, FHIR R4, Synthea, provenance, patient-generated data integration, longitudinal FHIR systems, and synthetic-data validation. Twenty-four records were screened for relevance, currency, authority, and retrievability. Ten were included: six peer-reviewed articles (60%), two normative HL7 pages, one Korean government source cluster, and one upstream release/repository. Preprints informed only the radar.

## Findings

### 1. The product object should be an evidence history, not a medical chatbot

Studies of patient-generated health-data integration describe continuing requirements around resources, standards, delivery, workflow, and review rather than a simple “connect everything” problem. [Tiase et al. (2020)](https://pubmed.ncbi.nlm.nih.gov/33758798/) <!--ref:tiase2020--><!--anchor:section:Discussion--> A review of healthcare provenance likewise shows that provenance is a cross-cutting requirement across capture, exchange, analytics, and use, not a decorative source label. [Alkhaldi et al. (2023)](https://pmc.ncbi.nlm.nih.gov/articles/PMC10384601/) <!--ref:alkhaldi2023--><!--anchor:section:Discussion-->

The practical product implication is to treat each fact as an inspectable object: who or what supplied it, which resource/version and source location it came from, when the clinical event occurred, when the source recorded it, what transformation ran, whether a person confirmed it, and what later correction superseded it. FHIR R4 explicitly distinguishes an Observation's clinically relevant `effective[x]` time from `issued`, the time that version became available. It also warns that Observation is not the diagnosis resource. [HL7 FHIR R4 Observation](https://hl7.org/fhir/R4/observation.html) <!--ref:hl7-observation--><!--anchor:section:Scope and Usage--> FHIR Provenance separately represents entities and processes involved in producing or influencing a target and complements, rather than replaces, access auditing. [HL7 FHIR R4 Provenance](https://hl7.org/fhir/R4/provenance.html) <!--ref:hl7-provenance--><!--anchor:section:Scope and Usage-->

### 2. Synthetic FHIR is useful for structure, but weak evidence for clinical truth

Synthea was designed to generate synthetic longitudinal records for secondary, nonclinical uses and export standards-based formats. Its foundational paper also documents limitations in historical realism and emphasizes that generated records are not a substitute for real clinical evidence. [Walonoski et al. (2018)](https://academic.oup.com/jamia/article/25/3/230/4098271) <!--ref:walonoski2018--><!--anchor:section:Discussion--> A later evaluation found technically realistic longitudinal structure while retaining important limits for simulation and research conclusions. [Chen et al. (2022)](https://academic.oup.com/jamiaopen/article/5/3/ooac067/6658391) <!--ref:chen2022--><!--anchor:section:Discussion-->

Recent work on LLM-assisted Synthea module development reinforces the same engineering lesson: syntactic validity and semantic/clinical validity are different gates, and runnable artifacts can still contain hallucinated medical codes or other defects. [JAMIA Open Synthea model study (2026)](https://academic.oup.com/jamiaopen/article/9/1/ooaf123/8415656) <!--ref:synthea-llm2026--><!--anchor:section:Discussion--> Therefore a passing parser test must be labeled structural interoperability evidence—not clinical correctness, Korean-population realism, or KR Core conformance.

For this project, Synthea `4.0.0` was pinned at commit `0185c09ea9d10a822c6f5f3ef9bdcbcbe960c813`; the upstream project identifies the generator as synthetic and supports FHIR R4 export. [Synthea repository and release](https://github.com/synthetichealth/synthea/releases/tag/v4.0.0) <!--ref:synthea-release--><!--anchor:release:v4.0.0--> One generated transaction Bundle contained 390 resources and 99 Observations. The implemented projector admitted 80 strict UCUM quantity candidates and rejected 19 unsupported or ambiguous Observations. That result proves the narrow contract works on one pinned upstream artifact; it proves nothing about medical accuracy.

### 3. Human review needs source context, especially for unstructured records

The SmartChart longitudinal FHIR study is useful not because its US surveillance metrics transfer to this Korean consumer product—they do not—but because the deployed review interface exposed source context and annotations. Its pilot also found materially different error behavior between structured and unstructured extraction, including date errors in free text. [Stevens et al. (2025)](https://academic.oup.com/jamiaopen/article/8/1/ooae145/7934014) <!--ref:stevens2025--><!--anchor:section:Results--> That supports an interface where selecting any timeline fact reveals the original evidence, date semantics, transformation, and correction state. It does not support copying the paper's disease-specific model or performance numbers.

### 4. MyHealthWay is a real route, but not a switch we can claim is on

MyHealthWay's current public pages describe clinical/public query APIs, dynamic consent, authentication support, and FHIR-based exchange. Separate program pages describe utilization-service designation followed by testbed application, test cases, conformity review, and transition to operations. [MyHealthWay API, designation, and testbed](https://myhealthway.go.kr/portal/index?page=Organization%2FPortal%2FPortalFunction%2FOrFunctionPerScreeing) <!--ref:myhealthway-2026--><!--anchor:section:서비스 기관 선정--> This justifies a disabled adapter architecture now. It does **not** justify UI copy saying the service is connected, nor does a Public Data Portal key activate the route. The public pages reviewed do not establish the proposed one-time snapshot/local-retention/disconnection behavior; that remains `UNKNOWN` until the approved implementation guide or a written program answer resolves it.

## Engineering decision

Adopt a two-stage truth model:

1. **Candidate graph:** deterministic import produces immutable, source-linked candidates or explicit rejection reasons. It accepts only a narrowly specified subject, status, code, value, unit, and time shape. Free text and embedded instructions are inert data.
2. **Canonical Health History:** only deterministic reconciliation plus required user confirmation can promote or supersede a fact. The assistant gets read-only evidence-query tools and may propose explanations, never mutate the record.

This architecture should next add candidate persistence/correction, a pinned KR Core validator, and a source-inspection UI. OCR selection should follow a frozen Korean medical-template benchmark. Government connectivity remains disabled until formal designation and conformity evidence exists.

## Limitations

The rapid English/Korean review was not exhaustive. No clinicians, patients, Korean counsel, MyHealthWay officials, or conformity assessors reviewed it. The experiment used one US-context synthetic Bundle and quantity Observations only. No real PHI, OCR, KR Core validation, persistence, model weights, credentials, or production environment were involved.

## AI-use disclosure

Codex assisted with source discovery, screening, synthesis, implementation, testing, and drafting. Claims were constrained to linked sources and recorded local measurements; the founder and qualified clinical, legal, privacy, security, and interoperability reviewers remain responsible for decisions in their domains.

## Included evidence

1. [Walonoski et al., *Synthea: An approach, method, and software mechanism for generating synthetic patients and the synthetic electronic health care record* (2018)](https://academic.oup.com/jamia/article/25/3/230/4098271) <!--ref:walonoski2018-ref--><!--anchor:doi:10.1093/jamia/ocx079-->
2. [Chen et al., *Assessment of Synthea data quality and utility in health research* (2022)](https://academic.oup.com/jamiaopen/article/5/3/ooac067/6658391) <!--ref:chen2022-ref--><!--anchor:doi:10.1093/jamiaopen/ooac067-->
3. [Alkhaldi et al., healthcare data-provenance systematic review (2023)](https://pmc.ncbi.nlm.nih.gov/articles/PMC10384601/) <!--ref:alkhaldi2023-ref--><!--anchor:pmcid:PMC10384601-->
4. [JAMIA Open, LLM-assisted Synthea module development study (2026)](https://academic.oup.com/jamiaopen/article/9/1/ooaf123/8415656) <!--ref:synthea-llm2026-ref--><!--anchor:article:ooaf123-->
5. [Stevens et al., *SmartChart Suite* (2025)](https://academic.oup.com/jamiaopen/article/8/1/ooae145/7934014) <!--ref:stevens2025-ref--><!--anchor:doi:10.1093/jamiaopen/ooae145-->
6. [Tiase et al., patient-generated health data and EHR integration scoping review (2020)](https://pubmed.ncbi.nlm.nih.gov/33758798/) <!--ref:tiase2020-ref--><!--anchor:pmid:33758798-->
7. [HL7 FHIR R4 Observation](https://hl7.org/fhir/R4/observation.html) <!--ref:hl7-observation-ref--><!--anchor:version:4.0.1-->
8. [HL7 FHIR R4 Provenance](https://hl7.org/fhir/R4/provenance.html) <!--ref:hl7-provenance-ref--><!--anchor:version:4.0.1-->
9. [MyHealthWay official portal and testbed](https://tb.myhealthway.go.kr/portal/index?page=MediMyData%2FTestbedManual) <!--ref:myhealthway-ref--><!--anchor:section:테스트베드 이용절차-->
10. [Synthea 4.0.0 release](https://github.com/synthetichealth/synthea/releases/tag/v4.0.0) <!--ref:synthea-release-ref--><!--anchor:tag:v4.0.0-->
