-- Wave 3 (a): the reference-range text printed on a result-sheet row is kept verbatim so the person's
-- own export can carry it (governance/intended-use-decision-reference-range-and-delta-2026-09-17.md).
-- Range body only: digits, separators and comparison signs, at most 40 characters. It is never
-- returned by the candidate, records, health-events or changes APIs, never displayed, never compared
-- against a value and never used to derive a state. Confirmation copies it to the record version;
-- a correction inherits it and cannot change it.
ALTER TABLE gc_candidate
    ADD COLUMN reference_range_text VARCHAR(40),
    ADD CONSTRAINT gc_candidate_reference_range_shape CHECK (
        reference_range_text IS NULL OR reference_range_text ~ '^[0-9.,[:space:]~<>≤≥–-]{1,40}$'
    );

ALTER TABLE gc_health_record_version
    ADD COLUMN reference_range_text VARCHAR(40),
    ADD CONSTRAINT gc_health_record_version_reference_range_shape CHECK (
        reference_range_text IS NULL OR reference_range_text ~ '^[0-9.,[:space:]~<>≤≥–-]{1,40}$'
    );
