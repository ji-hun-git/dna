# Founder Final-Direction Recommendation — 2026-08-10

**Status:** Founder-approved direction on 2026-08-10; public brand remains provisional

**Research owner:** Founder, with Codex-assisted synthesis

**Reviewed:** 2026-08-10 (Asia/Seoul)

**Inputs:**

- [`founder-brief-2026-08-10`](../research/source-materials/2026-08-10-founder-brief-ko.txt)
- [`founder-brand-positioning-decision-proposal-2026-08-10`](founder-brand-positioning-decision-proposal-2026-08-10.md)
- [`founder-approval-2026-08-09`](founder-approval-2026-08-09.md)
- [`approved program design`](../docs/superpowers/specs/2026-08-08-genome-companion-program-design.md)
- Founder conversation on naming, longitudinal differentiation, capital use, milestones, and valuation, preserved as user-supplied source material outside this public repository

## Recommendation in one sentence

> **Build `앎` as a Korea-first personal health-history product that turns user-owned, source-verifiable checkup and laboratory records into an understandable timeline of change over years.**

The company is not primarily an AI medical chatbot, a diagnostics company, a DNA company, a laboratory, a provider marketplace, or a generic wellness tracker. It is a **longitudinal personal health intelligence company** whose first product object is the user's verified **Health History**.

The durable product promise is:

> **Bring the records you already have. See how your body has changed over time.**

Korean-first expression:

> **이미 가진 건강기록을 모아, 시간 속의 나를 이해합니다.**

## Positioning stack

| Layer | Recommended direction | Public-use constraint |
|---|---|---|
| Consumer brand | **앎** | Korean wordmark first. Do not lead with `ALM` until collision, trademark, domain, and international-language review pass. |
| Brand line | **나를 알아가는 건강** | Preferred launch line because it is understandable and does not claim prevention efficacy. |
| Philosophy | **건강은 자기 자신을 아는 것이다.** | Manifesto language only, not a medical definition or outcome claim. |
| English line | **Know yourself over time.** | Supporting line, not a promise that the system completely knows the person. |
| Company category | **Korea-first longitudinal personal health intelligence** | `AI-native preventive health` may be investor/category context, but must not become an unproven disease-prevention claim. |
| Product object | **My Health History / 나의 건강 연대기** | A source-linked, user-verified longitudinal record, not a diagnostic profile or health score. |
| Core engine | **Longitudinal Health History Engine** | Normalizes facts, units, ranges, dates, sources, corrections, uncertainty, and missingness across time. |
| Experience loop | **Collect → Connect → Know** | Collect existing evidence first; connect only verified facts; explain known, changing, uncertain, and missing information. |

`앎` is the strongest concept from the founder conversation because the Korean name and the company's philosophy are the same idea. This is a strategic recommendation, not legal clearance. A preliminary web check also makes the earlier alternatives less attractive: a live iOS product already uses **Nosce** with the same “know thyself” concept, while **EON.health** already operates in health and fitness. `ALM` is also a crowded international acronym, including a current fitness app, so the Korean word `앎` should lead while the English rendering remains provisional. Qualified Korean and international trademark counsel must still search the relevant classes and confusingly similar marks before public adoption.

## Product strategy

### The core object is the Health History

The user should not experience the product as “a chatbot that has my files.” The primary screen is a verified history of the person across time:

- what changed;
- what stayed stable;
- which verified observations moved together;
- what happened after a user-recorded change, without claiming causality;
- what the product still does not know;
- which source supports every displayed fact.

The product's internal standard is:

- one document: trustworthy extraction, explanation, correction, and provenance;
- two or more dated records: visible personal change and baseline comparison;
- three or more time points: a genuinely differentiated longitudinal experience;
- future modalities: admitted only when they deepen the same verified history safely.

The moat is therefore not the phrase `Personal Health Intelligence`, a general-purpose model, or the number of uploaded PDFs. Those are increasingly common. The moat is a high-quality Korea-specific history graph: heterogeneous checkup forms, laboratory names, units, reference ranges, dates, corrections, source provenance, and personal baselines normalized without fabricating clinical truth.

### The four product surfaces

1. **Me** — what is well supported, what has changed, and what remains uncertain.
2. **Timeline** — verified events and observations across years, always linked to source and correction history.
3. **Insights** — bounded explanations of change, stability, co-movement, and questions to discuss with a professional.
4. **Collect** — import an existing record or understand an information gap; `nothing additional is needed now` must be a valid result.

There is no universal health score, biological-age score, disease countdown, streak pressure, or anxiety feed.

### The initial wedge

The first narrow job is **multi-year Korean health-checkup and common laboratory history**:

1. import a supported PDF or photo;
2. inspect the source overlay;
3. correct and verify extracted facts;
4. add a second dated record;
5. see a source-linked comparison and timeline;
6. purchase or unlock a bounded Health History Review;
7. return when a new checkup or result becomes available.

InBody/body-composition records may be the first adjacent format after the checkup/lab flow proves trustworthy. Wearables, CGM, imaging, and certified-result genetics remain later modules with separate evidence, privacy, intended-use, and product-value gates.

MyHealthWay is strategically important but remains post-MVP. The official service already enables consented access to health-checkup, treatment, medication, laboratory, surgery, and other data through a national FHIR-based exchange route. That validates the long-term interoperability direction, but formal onboarding must not become a launch dependency.

### Role of the existing public-information wedge

Provider and non-covered-price transparency remains useful, but it should become a **supporting acquisition and decision-preparation utility**, not the company's identity or equal product center. It must remain neutral, provenance-visible, and free of personal-data-based ranking or referral compensation.

## Business model

The first revenue test is consumer-paid software/information value:

- a one-time **Health History Review**;
- an annual membership only after new-record return behavior creates real recurring value;
- later fixed-fee B2B software or interoperability products that do not sell personal health data or depend on patient-referral compensation.

Do not build the plan around speculative valuation ladders. Financing should follow evidence of demand, trust, and history depth. Capital should buy what the founder cannot safely provide alone: clinical review, Korean health-data normalization, privacy/security/legal assurance, and high-quality user research. It should not fund a large team, wet lab, generic AI features, or broad paid acquisition before the repeat-use loop is demonstrated.

## The proprietary KPI

Use **Health History Depth** as an internal KPI family, never as a user-facing score.

Measure at least:

- verified-timeline completion rate;
- percentage adding a second dated record;
- percentage reaching three or more time points;
- median historical span in years;
- supported normalized observations per person;
- extraction correction and abstention rates by source/template;
- source-linked insight usefulness and trust;
- paid Health History Review conversion;
- return rate when a genuinely new record becomes available;
- deletion, export, and consent completion without support failure.

Raw sign-ups, uploaded document count, chat-message count, and model benchmark scores are secondary metrics.

## Validation sequence before scale

### Gate A — demand without personal data

- Interview at least 20 adults who keep or can retrieve past checkup results.
- Test a Korean clickable prototype using only clearly marked synthetic records.
- Compare the perceived value of one-record explanation against a three-time-point Health History.
- Test the `앎` name, pronunciation, recall, trust, and searchability alongside a neutral working name.
- Test a real price choice rather than asking only whether the concept sounds useful.

### Gate B — bounded private study

Only after separate authorization, counsel/privacy review, and a study protocol:

- support a very small, closed set of checkup templates;
- measure extraction, correction, verification, deletion, and timeline comprehension;
- determine whether qualified users can and will add a second historical record;
- do not enable remote general-purpose AI, wearables, genetics, or automatic test recommendations.

### Gate C — paid narrow MVP

Only after the implementation and beta gates in the approved plans pass:

- sell the bounded Health History Review;
- expand document support based on observed demand and error rates;
- evaluate annual membership from actual return behavior;
- begin formal MyHealthWay readiness without delaying the standalone import product.

### Gate D — longitudinal expansion

Add InBody, selected wearables, or another modality one at a time only when it improves an already-used Health History job. Genetics remains an independently gated certified-result wallet. Continuous monitoring, disease prediction, treatment advice, raw genomics, and a remote model remain separate products requiring new approval.

## What the company must refuse

- “AI doctor,” diagnosis, treatment, prescribing, or prevention-efficacy positioning;
- competing with Persly or a general chatbot on open-ended answer quality;
- collecting tests merely to complete a profile or increase revenue;
- paid personal referrals, rankings, or success fees;
- hidden training, health-data sale, advertising SDKs, or personal-health targeting;
- a universal score that collapses evidence and uncertainty;
- wet-lab ownership before a validated product need;
- treating DNA, wearables, or continuous alerts as MVP retention shortcuts;
- claiming that accumulated data automatically creates a defensible business.

## Why this direction can win

Persly currently leads with an AI doctor/health-advisor experience powered by medical information and linked records. Competing on chat quality would place this company in a model and distribution contest. The recommended direction changes the axis to **how long, how accurately, and how transparently the product understands change in the user's own verified history**.

The national data environment supports the long-term thesis: Korea's Health Information Highway exists to let individuals retrieve, save, and transmit consented health data, and the official service uses FHIR for multiple data categories. At the same time, the MFDS's 2026 digital-medical-product framework explicitly covers both medical software and digital health-support products. The exact claims and functions therefore matter more than disclaimers, which is why the launch must remain informational and provenance-first.

## Strongest counterargument

The broad idea is not unique. Current products already market personal health intelligence, AI-built timelines, personal baselines, and longitudinal health records. Users may also experience the historical-record collection job as work and may return only once a year. Large platforms can add file upload, record connection, and chat quickly.

The answer is not broader AI. It is disciplined focus:

1. win the Korean checkup/lab normalization problem;
2. make the second and third time point visibly more valuable than the first;
3. make every fact correctable and source-verifiable;
4. demonstrate willingness to pay before expanding modalities;
5. earn trust through privacy, deletion, export, and calm uncertainty—not engagement tricks.

If users do not retrieve a second record, do not understand the timeline, or do not pay for the bounded review, the company should not proceed to wearables, genetics, or a larger fundraising story. The core thesis would be unproven.

## Founder decision requested

Approve or revise the following single direction:

> **`앎` is a Korea-first longitudinal personal health intelligence product. Its first and defining object is the user's source-verifiable Health History, beginning with multi-year checkup and laboratory records. Provider/price information supports the journey; DNA, wet lab, continuous monitoring, and general medical chat do not define the MVP.**

The founder subsequently approved this direction and separately authorized checkpointed local implementation in [`founder-execution-authorization-2026-08-10.md`](founder-execution-authorization-2026-08-10.md). Deployment, external-account changes, procurement, personal-health-data processing, public brand adoption, and a regulated launch remain unauthorized.

## Evidence and limitations

- [Persly official product page](https://www.persly.ai/ko) — current competitor positioning around an AI doctor, medical information, and linked health records; accessed 2026-08-10.
- [MOHW Health Information Highway launch](https://www.mohw.go.kr/board.es?act=view&bid=0027&cg_code=&list_no=378308&mid=a10503010300&tag=) and [2024 expansion](https://www.mohw.go.kr/board.es?act=view&bid=0027&list_no=1483201&mid=a10503010100&nPage=47&tag=) — official personal-data exchange scope and institutional expansion; accessed 2026-08-10.
- [MyHealthWay data types](https://www.myhealthway.go.kr/portal/index?page=Individual%2FPortal%2FMediMyData%2FMydataType) — official FHIR-based transferable data categories; accessed 2026-08-10.
- [MFDS digital medical products overview](https://emedi.mfds.go.kr/msismext/emd/bif/digitInfoIntrcnView.do) — official 2026 framework covering digital medical devices and digital medical/health-support devices; accessed 2026-08-10.
- [Nosce official product site](https://trynosce.com/) and [App Store listing](https://apps.apple.com/ph/app/nosce-mindful-screen-time/id6778128338) — current product using the same name and “know thyself” concept; accessed 2026-08-10.
- [EON.health Korean App Store listing](https://apps.apple.com/kr/app/eon-health/id6451053065) — current health/fitness product collision relevant to `EONA`; accessed 2026-08-10.
- [ALM Fitness App Store listing](https://apps.apple.com/gb/app/alm-fitness/id6751945570) — one example of the crowded `ALM` acronym in health and fitness; accessed 2026-08-10.
- [Scanmedix official product site](https://www.scanmedix.app/), [PAS AI official product site](https://www.getpasai.com/), and [BioBalance official product site](https://www.biobalancejournal.com/) — examples showing that timelines, personal baselines, and personal-health-intelligence language are not unique; accessed 2026-08-10.

The collision review above is preliminary web research, not a registrability or freedom-to-operate opinion. Market demand, willingness to pay, extraction performance, and retention are unverified hypotheses. No valuation estimate in the founder conversation is adopted as a planning fact.

**AI disclosure:** This recommendation was produced with AI-assisted reading, current-source discovery, source verification, synthesis, counterargument testing, and drafting. Founder judgment, qualified legal/regulatory advice, and direct user research remain required.
