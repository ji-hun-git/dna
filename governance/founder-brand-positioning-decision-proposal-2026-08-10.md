# Founder Brand and Positioning Decision Proposal — 2026-08-10

**Status:** Proposed for founder decision; not approved

**Source input:** [`../research/source-materials/2026-08-10-founder-brief-ko.txt`](../research/source-materials/2026-08-10-founder-brief-ko.txt)

## Decision requested

The founder brief introduces a stronger category and product narrative without necessarily changing the approved launch wedge. This proposal separates the parts that can become positioning language from the parts that would change product scope, intended use, or implementation.

The proposed positioning stack is:

| Layer | Proposed language | Meaning in the approved baseline |
|---|---|---|
| Company category | **AI-native preventive health** | A market-positioning phrase, not a claim that the product prevents disease or practices medicine. |
| Product category | **Personal Health Intelligence** | A private health-information and record companion that helps a person understand verified records over time. |
| Core product asset | **Longitudinal Personal Health Model** | A provenance-preserving view of verified facts, time, relationships, interventions, responses, uncertainty, and missingness. It is not a diagnostic model or a replacement clinical truth layer. |
| Experience loop | **Collect → Connect → Know** | Collect user-owned evidence; connect verified facts across sources and time; help the user understand what is known, changing, uncertain, or missing. |
| Brand candidate | **앎 (ALM)** | A proposed service name expressing self-knowledge. It is not approved for public use until the clearance gates below pass. |
| Philosophy candidate | **Health is knowledge of oneself.** | Brand philosophy only, never a medical definition, outcome guarantee, or substitute for professional care. |

## What would change if approved

1. The program design would add the positioning stack to the product promise while retaining the existing annual-checkup, lab-history, record, provider-information, and non-covered-price launch wedge.
2. Product information architecture would be evaluated against four user surfaces from the brief: `Me`, `Collect`, `Insights`, and `Timeline`. This is a navigation hypothesis for usability testing, not an automatic replacement for the reviewed routes.
3. Onboarding would frame the first import as **Build your baseline** and show coverage by domain using `what we know`, `what changed`, `what connects`, `what we do not know yet`, and `what could be collected next`.
4. The UX would continue to reject a universal health score. Coverage and missingness must be evidence-based, domain-specific, uncertainty-visible, and non-coercive.
5. The visual identity could explore an incomplete pattern made from accumulating points. Medical crosses, hearts, ECG traces, DNA helices, and completion checkmarks would remain disfavored.

## What would not change

Approval of this positioning would not authorize:

- implementation, deployment, procurement, external-account mutation, or personal-data processing;
- diagnosis, disease prediction, symptom triage beyond the approved deterministic emergency route, prescribing, dose/adherence advice, or autonomous clinical agents;
- claiming that the product prevents disease, improves outcomes, or knows a user's complete health state;
- collecting more tests merely to increase engagement or revenue;
- provider ranking or personalized referral based on health data;
- wearable alerts, continuous clinical monitoring, automatic intervention measurement, or background mobile sync;
- a remote general-purpose model, personal-health embeddings, or model training on user data;
- server-side genetics, raw genomic data, genetic risk scoring, or bypass of G0;
- moving MyHealthWay into MVP before its existing onboarding and conformance gates;
- replacing source provenance, user verification, uncertainty, evidence review, or professional escalation with a generated narrative.

## Safety interpretation of the language

### “AI-native preventive health”

This is acceptable only as category positioning. Public copy must not imply prevention efficacy, screening performance, clinical surveillance, or a regulated intended use that the actual build has not established. Counsel and the MFDS owner must review the exact screens and campaign copy before beta.

### “Longitudinal Personal Health Model”

The model is an explicit data-and-explanation abstraction with separate layers for verified traits, current state, behavior, timeline, personal baseline, relationships, interventions, responses, evidence, uncertainty, and missingness. Every displayed conclusion remains bounded by the existing truth hierarchy and source chain. `Model` must not be used to hide probabilistic inference, unsupported causality, or a medical judgment.

### “What you could collect next”

The product may explain an information gap only when the gap follows from an approved rule and the user can understand why the information would matter. It must also support `nothing additional is currently needed`. It may not recommend tests through paid referral mechanics, fear, completeness pressure, or unsupported clinical necessity.

### “Learns you over time”

If used, this phrase must be accompanied by a plain-language explanation that the product accumulates user-approved, provenance-linked records and updates deterministic views. It must not imply hidden surveillance, autonomous experimentation, or a general model trained on the user's private data.

## Brand-name clearance gates

`앎 (ALM)` remains a candidate until all of the following are recorded:

- Korean and relevant international trademark clearance by qualified counsel;
- company, service, app-store, domain, and social-handle collision review;
- Korean pronunciation, recall, searchability, accessibility, and trust testing with target users;
- English-language review for acronym collisions and pronunciation outside Korea;
- privacy, clinical-safety, consumer-advertising, and intended-use review of the proposed philosophy and tagline;
- a rollback name and migration plan before any public identifier, signing identity, package name, or durable infrastructure name adopts the brand.

Until those gates pass, repository, package, service, cloud-resource, certificate, signing, and API identifiers remain `Genome Companion`/`gc-*`. A naming decision does not rename cryptographic or infrastructure identifiers retroactively.

## Required follow-on edits after approval

If the founder approves the positioning stack, make a separate planning-only commit that:

1. updates the program design's product promise, journeys, experience direction, and launch copy boundaries;
2. updates D-016 without weakening its accessibility and evidence-ledger constraints;
3. adds Korean-first copy fixtures and prohibited-claim tests to the UX and AI plans;
4. maps `Me | Collect | Insights | Timeline` to the existing public/private route and consent architecture;
5. adds coverage/missingness schemas and rules only where they can be produced from verified facts;
6. records any new regulatory, consumer-interpretation, brand, or coercion risks in the risk register;
7. leaves every workstream status `Plan-ready; not executed` until a separate execution authorization is recorded.

## Founder resolution

No option is selected in this proposal.

- [ ] Approve the full positioning stack and authorize the follow-on planning edits, while keeping `앎 (ALM)` provisional until clearance.
- [ ] Approve category/product/core-asset/experience language only; hold the name and philosophy.
- [ ] Request revisions before any part is added to the approved design.
- [ ] Reject this proposal and retain the current Genome Companion positioning.
