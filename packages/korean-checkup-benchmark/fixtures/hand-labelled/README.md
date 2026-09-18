# Hand-labelled layout fixtures

Synthetic documents whose layout copies the structure of common Korean check-up sheets and whose
expectations were typed by hand. No file here came from a real document; every value, name and
institution is synthetic (`gc-synthetic-fixture`). The PDF bytes are drawn by
`HandLabelledFixtures.kt` at test/gate time and are never committed. `expected.json` is the
authority for the score `handLabelledAccuracy`; no code generates it.
