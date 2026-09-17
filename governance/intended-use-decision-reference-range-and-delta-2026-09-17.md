# Intended-use decision — original reference-range preservation and deterministic value differences (2026-09-17)

Recorded from the founder's answers in the 2026-09-17 planning session (Claude QA/FDE session, Wave 3 scoping). This is the decision document required by `docs/superpowers/specs/2026-09-16-phi-qa-and-gap-plan-design.md` §5 before gated items (a) and (b) enter code, and by `PROJECT_GUIDE.md` operating rule 5.

## Decision

The founder approves two items, and only these two:

1. **(a) Original reference-range preservation.** When a result sheet prints a reference range on a row, the worker keeps that text verbatim as `referenceRangeText` (bounded, characters limited to digits, separators and comparison signs). Core stores it on the candidate and copies it to the confirmed record version. It is **never displayed** in the product, never returned by the candidate, records, health-events or what-changed APIs, never compared against a value, and never used to derive a state. It appears **only** in the person's own export file (`GET /api/foundation/health-events/export`), as the original document text, because the export is the person's own data.
2. **(b) Deterministic value differences.** The what-changed summary may state the arithmetic difference between the latest value and the previous value of the same concept in the same unit (absolute difference and percentage of the previous value). The computation is plain subtraction and division, shown as signed numbers in text. The product attaches **no direction word, colour, arrow, threshold or meaning** to the number.

## Founder statements

- Item (a) is data preservation of text the person already holds on paper (`PHI_MASTER_PRODUCT_DOCUMENT.md` "절대 보존해야 하는 것"). Item (b) is arithmetic on two values the person already sees side by side. Neither is a diagnosis, normality, risk, treatment or medication claim, and neither introduces a model.
- Regulatory review: the founder judges that no regulatory review is required for these two items while the release target is `HOSTED_SYNTHETIC_STAGING` with synthetic data only. This judgement must be revisited, with a regulatory review, before any real personal health information is processed or before either item is extended (display of a reference range, comparison of a value against a range, trend or direction language, projections).
- Items (c) trend narration, (d) explanation templates and (e) model/OCR extraction providers remain **not approved** and need their own decision documents.

## Rule amendments this decision authorises

- `AGENTS.md` boundary line: reference ranges remain forbidden in UI copy, comparisons and derived states; storing and exporting the original document text is permitted under this decision.
- `PROJECT_GUIDE.md` rule 5: unchanged in substance; a pointer to this document is added.
- `apps/web/tests/korean-ux-copy.test.ts` forbidden-term list gains direction words (상승, 하락, 증가, 감소) so item (b) cannot drift into trend language.

## Not approved by this note

- Showing a reference range anywhere in the product, or any wording that relates a value to a range.
- Any statement about direction, trend, speed, projection, or what a difference means.
- Any change to `release/readiness.json` or to the release verdict (NO_GO).
- Real documents, real PHI, hosted inference.
