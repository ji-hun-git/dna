# Intended-use decision — measurement history, three computed numbers and a plain graph of the person's own values (2026-09-17)

Recorded from the founder's answers in the 2026-09-17 planning session (Claude QA/FDE session, Wave 4 scoping). This is the decision document required by `docs/superpowers/specs/2026-09-16-phi-qa-and-gap-plan-design.md` §5 before gated item (c) enters code, and by `PROJECT_GUIDE.md` operating rule 5. It sits beside `governance/intended-use-decision-reference-range-and-delta-2026-09-17.md` and does not replace it.

## Decision

Asked "시계열을 어느 수준까지 보여줄까요?", the founder chose **"숫자 + 단순 그래프"**. The founder approves, and only approves:

1. **Measurement history.** For each concept and unit, the person's own confirmed values in exam-date order, as a table and through `GET /api/foundation/series`.
2. **Three computed numbers per series**, each plain arithmetic on the person's own values, always computed in time order:
   - the difference between the last two measurements (the Wave 3 calculator and its narrowed rules);
   - that difference scaled to 30 days;
   - the arithmetic mean of the last three values.
3. **A plain graph of the person's own values.** Points at the measurements, joined in time order, scaled only to that person's own minimum and maximum.

## What the founder excluded in the same answer

- No reference band, threshold, target or population comparison on the graph or anywhere else.
- No fitted line, regression, smoothing that invents values, slope label, projection or forecast.
- No colour, width, icon or motion that carries meaning about a value (colour may identify a series or a position in time only).
- No sentence that describes direction, speed or meaning ("상승", "하락", "증가", "감소", "빨라", "좋아", "나빠" and equivalents stay forbidden). The option that added such sentences was offered and not chosen.
- The page must say that the line between two measurements is not data.

## Founder statements

- These are displays of, and arithmetic on, values the person already confirmed from their own documents. They are not a diagnosis, normality, risk, treatment or medication claim, and no model is involved (`PHI_MASTER_PRODUCT_DOCUMENT.md` §23: temporal calculation is not delegated to an LLM).
- Regulatory review: as with the Wave 3 decision, the founder judges that none is required while the release target is `HOSTED_SYNTHETIC_STAGING` with synthetic data only. This judgement must be revisited, with a regulatory review, before any real personal health information is processed or before any excluded item above is added.
- Gated items (d) explanation templates and (e) model/OCR extraction providers, and Level 1–3 forecasting language in `PHI_MASTER_PRODUCT_DOCUMENT.md` §24, remain **not approved**.

## Not approved by this note

- Any change to `release/readiness.json` or to the release verdict (NO_GO).
- Real documents, real PHI, hosted inference, third-party AI.
