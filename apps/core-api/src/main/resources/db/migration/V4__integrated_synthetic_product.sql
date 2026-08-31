ALTER TABLE gc_candidate
    DROP CONSTRAINT gc_candidate_status,
    DROP CONSTRAINT gc_candidate_confirmation,
    ADD COLUMN excluded_at TIMESTAMPTZ,
    ADD CONSTRAINT gc_candidate_status CHECK (status IN ('PENDING', 'CONFIRMED', 'EXCLUDED')),
    ADD CONSTRAINT gc_candidate_review CHECK (
        (status = 'PENDING' AND confirmed_at IS NULL AND excluded_at IS NULL)
        OR (status = 'CONFIRMED' AND confirmed_at IS NOT NULL AND excluded_at IS NULL)
        OR (status = 'EXCLUDED' AND confirmed_at IS NULL AND excluded_at IS NOT NULL)
    );

CREATE TABLE gc_health_record_version (
    version_id UUID PRIMARY KEY,
    record_id UUID NOT NULL REFERENCES gc_health_record(record_id) ON DELETE CASCADE,
    subject_id VARCHAR(80) NOT NULL REFERENCES gc_subject(subject_id),
    status VARCHAR(16) NOT NULL,
    value VARCHAR(64) NOT NULL,
    supersedes_version_id UUID REFERENCES gc_health_record_version(version_id),
    correction_reason VARCHAR(200),
    changed_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT gc_health_record_version_status CHECK (status IN ('CURRENT', 'SUPERSEDED')),
    CONSTRAINT gc_health_record_version_reason CHECK (
        (supersedes_version_id IS NULL AND correction_reason IS NULL)
        OR (supersedes_version_id IS NOT NULL AND length(trim(correction_reason)) BETWEEN 1 AND 200)
    )
);

CREATE UNIQUE INDEX gc_health_record_one_current_version_idx
    ON gc_health_record_version(record_id)
    WHERE status = 'CURRENT';

CREATE INDEX gc_health_record_version_subject_idx
    ON gc_health_record_version(subject_id, record_id, changed_at);

INSERT INTO gc_health_record_version(
    version_id, record_id, subject_id, status, value, supersedes_version_id, correction_reason, changed_at
)
SELECT gen_random_uuid(), record_id, subject_id, 'CURRENT', confirmed_value, NULL, NULL, confirmed_at
FROM gc_health_record;
