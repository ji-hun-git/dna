# Founder research-to-engineering authorization record

**Recorded:** 2026-08-30 (Asia/Seoul) · **Evidence:** founder instructions in the active Codex task
**Recorder:** Codex, as an accurate transcript of scope—not a legal signature or external approval

## Authorized direction

The founder directed the team to continue development around one product object: a living, source-verifiable personal **Health History** that turns scattered Korean health records into a longitudinal evidence graph. The assistant may help collect, connect, summarize, and explain evidence, but it may not diagnose, prescribe, or silently change canonical facts.

The founder authorized:

- continued local development and design with synthetic data;
- a continuous research → evidence → experiment → engineering → verification loop;
- maintenance of the six research registers under `docs/research/`;
- a synthetic Synthea FHIR R4 experiment that projects supported observations into provenance-preserving candidates;
- red-team tests for malformed input, subject confusion, temporal ambiguity, prompt injection, unsupported semantics, duplicates, and non-final states;
- truthful preparation of disabled MyHealthWay, public-reference, OCR, medication, and medical-model seams before external credentials are obtained.

## Still not authorized

This record does **not** authorize:

- processing real personal health information or genetic data;
- deployment, public beta, production traffic, or a claim of release readiness;
- creating or changing MyHealthWay, Kakao, Naver, Public Data Portal, cloud, or other external accounts;
- obtaining, storing, or using external API keys or production credentials;
- claiming MyHealthWay designation, testbed approval, conformity, production access, KR Core conformance, or a particular retention/disconnection behavior;
- deploying a medical AI model, autonomous clinical agent, or model that diagnoses, treats, triages, prescribes, or manages a patient;
- adopting a public brand or making clinical, legal, privacy, security, or competition-award claims.

## Truth gates

1. Every imported datum remains a candidate until its source, subject, temporal semantics, unit, code, and provenance pass deterministic checks and any required human confirmation.
2. Synthetic test success proves only the measured structural behavior; it does not prove clinical correctness, Korean-population realism, KR Core conformance, or production safety.
3. Public-reference APIs and personal-record APIs stay separate. A Public Data Portal key cannot activate MyHealthWay.
4. Any assistant output must distinguish source-recorded fact, derived computation, correlation, uncertainty, and unknown.
5. Real-data work, external account action, deployment, clinical scope expansion, or canonical fact mutation needs a new explicit authorization and its own evidence.

## Recorded decision

This authorization is the evidence record for D-034 in [`decision-log.md`](decision-log.md). It narrows implementation to reversible local work and preserves every earlier stop-ship boundary.
