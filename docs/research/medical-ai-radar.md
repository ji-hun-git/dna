# Medical AI radar

**Review date:** 2026-08-30
**Current verdict:** there is no evidence-backed universal “best medical identification AI model.” Model selection must follow a frozen task, corpus, comparator, safety threshold, hardware/privacy boundary, and intended use.

## Decompose “identification” before selecting a model

| Task | Correct first comparator | Candidate tools | Product authority |
|---|---|---|---|
| Document structure and OCR | Deterministic template parser plus human transcription baseline | PaddleOCR, Docling | Propose text/regions only; cannot create canonical facts |
| Medical field normalization | Rules/terminology plus exact schema validator | Bounded local model experiment, potentially MedGemma 1.5 | Propose typed candidates with evidence span and confidence; abstain otherwise |
| Medication reference matching | Exact product/ingredient identifiers and versioned HIRA/MFDS reference data | Deterministic lookup; model only for ranked candidate search | Cannot infer that the person used a medication |
| Longitudinal summarization | Deterministic evidence query with source/time filters | Constrained LLM explanation layer | Read-only; cite every fact and separate source fact from derivation |
| Diagnosis, treatment, triage, prescribing | None in current intended use | Excluded | `REJECTED` |

## Candidate radar

| Candidate | Evidence state | What is promising | What blocks adoption | Status |
|---|---|---|---|---|
| HAPI FHIR + deterministic Kotlin rules | Local executable evidence | Typed R4 parsing, strict subject/time/code/unit/provenance gates | KR Core validation and broader resource model not implemented | `ADOPTED` for parsing/candidate projection |
| PaddleOCR | Upstream project reviewed | Broad OCR/document pipeline and planned offline path | No frozen Korean medical corpus result; model/container/license/security receipts absent | `EVALUATING` |
| Docling | Upstream project reviewed | Alternative document conversion/layout pipeline | Same missing project benchmark; medical-template behavior unproven | `EVALUATING` |
| MedGemma 1.5 | Official model card reviewed | Medical text/image foundation-model starting point | No independent Korean task result; no artifact admitted; publisher requires task-specific validation and excludes direct clinical decision use | `WATCHING / BENCHMARK ONLY` |
| AgentClinic and other medical-agent benchmarks | Research/preprint only | Useful for failure taxonomy and tool-use scenarios | Simulated scores do not establish clinical safety, Korean applicability, or product permission | `WATCHING` |
| General autonomous medical agent | No admissible product evidence | None for current intended use | Excessive agency, unverifiable reasoning, PHI leakage, prompt injection, clinical/regulatory risk | `REJECTED` |

Primary sources: [MedGemma model card](https://developers.google.com/health-ai-developer-foundations/medgemma/model-card), [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR), [Docling](https://github.com/docling-project/docling), [AgentClinic](https://arxiv.org/abs/2405.07960).

## Frozen benchmark required before any document model choice

The project benchmark must contain only synthetic or expressly authorized redacted artifacts and must freeze:

- Korean laboratory/checkup result templates, scans, photographs, rotations, blur, glare, tables, handwriting, stamps, multi-page PDFs, and adversarial text;
- exact ground truth for document type, patient/date/provider identifiers, test name/code, value, unit, reference interval, flags, specimen, page, and bounding/evidence span;
- per-field exact match, numeric/date/unit exactness, false admission, false merge, abstention, calibration, latency, peak RAM/VRAM, and zero-egress measurements;
- deterministic template parser, human transcription, PaddleOCR, Docling, and any bounded multimodal model under the same conditions;
- subgroup/template breakdowns rather than one aggregate score;
- a release gate of zero known false admission for safety-critical fields in the supported-template set, with unsupported layouts forced to abstain.

No upstream benchmark substitutes for this corpus. A model wins only a specific task/version/hardware comparison and loses authority when the input leaves the supported set.

## Agent safety contract

1. The agent reads a versioned evidence snapshot and cannot write canonical facts.
2. Tools are allowlisted, typed, timeout/resource-bounded, subject-scoped, and deny network by default.
3. Source text and embedded instructions are data, never commands.
4. Every answer distinguishes source-recorded fact, deterministic derivation, correlation, hypothesis, and unknown.
5. Medication and public-reference tools may annotate an already sourced fact; they may not create personal medication history.
6. A final deterministic policy gate can block unsupported medical, privacy, or action claims regardless of model output.

## Next decision

Build the frozen synthetic/redacted Korean document benchmark before downloading or deploying any model weight. Run PaddleOCR and Docling first; evaluate MedGemma only if deterministic and document-native baselines leave a clearly defined normalization gap.
