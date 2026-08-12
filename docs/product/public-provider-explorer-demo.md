# Public provider explorer — truthful demo boundary

Updated: 2026-08-12

The `/providers` route is a visual and interaction prototype. It does not call a government API, display a real medical provider, quote a real non-covered price, rank care, recommend a provider, or accept personal health inputs.

## What is real

- The intended source contracts are the official Public Data Portal entries for `건강보험심사평가원_병원정보서비스` and `건강보험심사평가원_비급여진료비정보조회서비스`.
- The UI fields mirror only the public concepts required for the product design: provider name/type/address, non-covered item/code/current amount/effective period, source agency, and catalog URL.
- The route uses accessible tables, neutral provider-name ordering, explicit provenance details, and visible caveats.

## What is synthetic

- Every provider name starts with `예시`.
- Every non-covered code starts with `DEMO-` and every amount is labeled `예시 금액`.
- Addresses end with `합성 주소` and telephone values are null.
- The fixture records `liveApiCalls: 0`, `environment: synthetic-demo`, and `connectionState: not-connected` in a strict schema.

## Gate for removing the demo disclosure

Do not remove the synthetic disclosure until a server-side connector has an approved API key, strict XML parsing, contract fixtures, source timestamp and effective-period handling, neutral ordering, no-store behavior, schema-drift quarantine, provenance verification, and recall/fallback tests. A real amount remains public source information—not a quote, final bill, quality score, or recommendation.
