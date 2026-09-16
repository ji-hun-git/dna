# Founder approval — MedGemma 1.5 local synthetic evaluation (2026-09-16)

Recorded from the founder's answer in the 2026-09-16 planning session (Claude QA/FDE session, question "MedGemma(HAI-DEF) 약관을 founder가 수락하고 로컬 평가 실행을 승인하시나요?"; answer "네 — 약관 수락했고 합성 평가 승인").

## What is approved

- The founder states they have reviewed and accepted the Google Health AI Developer Foundations terms and prohibited-use policy for MedGemma 1.5 4B (handoff condition 1 in `docs/implementation/medical-document-runner.md`).
- Approved scope: a **bounded local evaluation experiment** on the development workstation (RTX 3070, 8 GiB) using the Ollama runtime and the `medgemma1.5` model pulled from the Ollama library, run only against the repository's synthetic Korean checkup benchmark corpus, with no network access from the evaluation script beyond the local Ollama endpoint, and results scored by the existing `evaluateMedicalDocumentPipeline` evaluator.
- Output of the experiment is evidence in `docs/status/`, not a readiness gate change and not a product feature.

## What is not approved by this note

- Production or hosted inference, any real document, any PHI.
- Handoff conditions 2–7 (artifact receipts, reviewed OCI image, signed `medical-document-oci-approval.v1`, rehash-before-invoke launcher, sandboxed invocation, digest-bound admission). Those remain open; the local experiment does not substitute for them.
- Any change to `release/readiness.json` or to the "OCR·의료 AI 비활성" statement.

## Pins to record when the experiment runs

- Ollama version, model tag and model digest (`ollama show medgemma1.5`), evaluation script commit, corpus commit and corpus digest, date/time, GPU/driver.
