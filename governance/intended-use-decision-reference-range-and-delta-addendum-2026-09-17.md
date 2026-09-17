# Addendum — reference-range text in the FHIR export (2026-09-17)

Addendum to `governance/intended-use-decision-reference-range-and-delta-2026-09-17.md`, recorded from the founder's answer in the 2026-09-17 Wave 4 scoping session. The original document is unchanged.

## Question and answer

Asked "FHIR export에 참고치 원문을 포함할까요? (Wave 3 결정은 JSON export 한 곳만 명시했습니다)", the founder chose **"포함 — Observation.referenceRange.text 원문"**.

## What this adds

- The original decision named one place where the preserved reference-range text may appear: the person's own JSON export. This addendum names a second: the person's own FHIR export, `GET /api/foundation/health-events/export/fhir`, as `Observation.referenceRange[0].text`, verbatim.
- The text is never parsed into `low`/`high` quantities, never compared with a value, and never used to set `Observation.interpretation`. `interpretation` is not emitted at all.

## What stays as decided

- The text appears on no screen and in no other API response.
- Everything listed under "Not approved by this note" in the original decision.
- The regulatory-review judgement applies to synthetic staging only and must be revisited before real PHI.
