-- Wave 5 final-review fix (Minor 5). V11 seeded every concept row with an explicit loinc_export value
-- (TRUE or FALSE), so this migration changes nothing for existing rows; it only changes what a future
-- row gets when the column is left unset. The Kotlin default for MedicalConcept.loincExport is false
-- (LOINC export is opt-in), so the column default must match it instead of defaulting to TRUE.
--
-- gc_test is a persistent local Flyway database and V11 is already applied there, so V11 itself is
-- never edited after being applied (that would break Flyway's checksum). This also carries a
-- correction to V11's header comment, which cannot be edited in place: V11's "New concepts" comment
-- undercounts by miscounting hs-crp as a numeric item. hs-crp is a third sibling split out of crp's
-- alias list (crp loses the "hs-CRP" alias per the Wave 5 alias rule), alongside postprandial-glucose
-- (split from glucose/fasting-glucose) and direct-bilirubin (split from bilirubin/total-bilirubin).
-- The correct breakdown of V11's 31 INSERT rows is: 3 generic concepts (glucose, bilirubin, gfr) +
-- 3 specific siblings split out of aliases that were too broad (postprandial-glucose, direct-bilirubin,
-- hs-crp) + 25 numeric check-up items = 28 new (non-generic) concepts, 31 inserts total.
ALTER TABLE gc_medical_concept
    ALTER COLUMN loinc_export SET DEFAULT FALSE;
