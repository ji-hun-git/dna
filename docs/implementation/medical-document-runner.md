# Medical document runner handoff

This implementation is an extraction-candidate pipeline, not a diagnostic model and not a medical device authorization.

## Selected candidate pipeline

- Document structure: PaddleOCR-VL 1.6. The official project reports 109-language support and a 96.3% OmniDocBench v1.6 result. Its documentation describes the initial v1 VLM core as 0.9B; the exact v1.6 artifact size must therefore be verified rather than inferred. The source project is Apache-2.0, but every imported model and container artifact still requires its own reviewed receipt.
- Medical semantics: MedGemma 1.5 4B multimodal. It is used only to propose measurement-shaped fields after document parsing. It may not diagnose, classify normality, recommend treatment, or manage a patient.
- Human boundary: every admitted result remains `awaiting-human-confirmation`; no model output becomes a health record automatically.

Official sources:

- <https://www.paddleocr.ai/main/en/version3.x/pipeline_usage/PaddleOCR-VL.html>
- <https://raw.githubusercontent.com/PaddlePaddle/PaddleOCR/main/LICENSE>
- <https://huggingface.co/google/medgemma-1.5-4b-it>
- <https://developers.google.com/health-ai-developer-foundations/terms>
- <https://developers.google.com/health-ai-developer-foundations/prohibited-use-policy>
- <https://developers.google.com/health-ai-developer-foundations/faqs>

## Current machine result

The development workstation exposes an NVIDIA GeForce RTX 3070 with 8,192 MiB VRAM and compute capability 8.6. Google lists the static MedGemma 4B Q4_0 weight footprint at approximately 3.4 GB, but runtime overhead and KV cache are additional. This is enough to justify a bounded single-job experiment, not enough to guarantee that the final runtime will fit.

No OCI runtime is currently installed. The repository does not install Docker, accept model terms, download model weights, or manufacture artifact receipts. `pnpm medical-ai:runner:preflight` reports these facts without mutating the machine.

## Required handoff before real inference

1. A human with authority reviews and accepts the current HAI-DEF terms and prohibited-use policy.
2. A protected artifact job downloads exact revisions, creates canonical content manifests, scans the files, and publishes SHA-256 receipts. Current/list-style model resolution and `latest` tags are forbidden.
3. A reviewed runner image is built and addressed only by its repository digest.
4. The production-reviewed manifest and both artifact receipts are joined into `medical-document-oci-approval.v1` by the founder-approved workflow.
5. Immediately before invocation, the launcher rehashes `job.json`, the document bytes, and every file in both model content manifests. It rejects symbolic links, unlisted files, path escape, mismatched totals, and a non-empty result directory.
6. The runner is invoked as an argument array with `--pull=never`, `--network=none`, read-only root/input/model mounts, an isolated result directory, no added capabilities, no-new-privileges, bounded CPU/memory/PIDs, and exactly three non-secret environment keys.
7. Only strict, digest-bound output from a still-valid job may enter the existing human-confirmation admission gate.

Until all seven conditions are met, deterministic synthetic fixtures are the only executable path.

The current repository validates the approval object's closed shape and every digest it binds. It does not yet authenticate a production approval signature or exact-version object-store coordinate. That authority verifier is a required later integration, and this local contract must not be treated as its substitute.
