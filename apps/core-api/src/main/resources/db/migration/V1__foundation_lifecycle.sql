CREATE TABLE gc_subject (
    subject_id VARCHAR(80) PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT gc_subject_synthetic_only CHECK (subject_id ~ '^synthetic-[a-z0-9-]+$')
);

CREATE TABLE gc_session (
    session_id UUID PRIMARY KEY,
    token_hash CHAR(64) NOT NULL UNIQUE,
    csrf_hash CHAR(64) NOT NULL,
    subject_id VARCHAR(80) NOT NULL REFERENCES gc_subject(subject_id),
    created_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    CONSTRAINT gc_session_expiry CHECK (expires_at > created_at)
);

CREATE INDEX gc_session_subject_idx ON gc_session(subject_id);

CREATE TABLE gc_consent_grant (
    consent_id UUID PRIMARY KEY,
    subject_id VARCHAR(80) NOT NULL REFERENCES gc_subject(subject_id),
    purpose_code VARCHAR(80) NOT NULL,
    status VARCHAR(16) NOT NULL,
    policy_version VARCHAR(40) NOT NULL,
    granted_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    CONSTRAINT gc_consent_purpose CHECK (purpose_code = 'DOCUMENT_EXTRACTION'),
    CONSTRAINT gc_consent_status CHECK (status IN ('ACTIVE', 'REVOKED')),
    CONSTRAINT gc_consent_revocation CHECK (
        (status = 'ACTIVE' AND revoked_at IS NULL)
        OR (status = 'REVOKED' AND revoked_at IS NOT NULL)
    )
);

CREATE UNIQUE INDEX gc_consent_one_active_purpose_idx
    ON gc_consent_grant(subject_id, purpose_code)
    WHERE status = 'ACTIVE';

CREATE TABLE gc_document (
    document_id UUID PRIMARY KEY,
    subject_id VARCHAR(80) NOT NULL REFERENCES gc_subject(subject_id),
    consent_id UUID NOT NULL REFERENCES gc_consent_grant(consent_id),
    status VARCHAR(20) NOT NULL,
    media_type VARCHAR(80) NOT NULL,
    expected_length BIGINT NOT NULL,
    actual_length BIGINT,
    sha256 CHAR(64),
    object_key VARCHAR(160),
    created_at TIMESTAMPTZ NOT NULL,
    inspected_at TIMESTAMPTZ,
    CONSTRAINT gc_document_status CHECK (status IN ('REQUESTED', 'QUARANTINED', 'INSPECTED', 'REJECTED')),
    CONSTRAINT gc_document_media_type CHECK (media_type = 'application/pdf'),
    CONSTRAINT gc_document_length CHECK (expected_length BETWEEN 8 AND 10485760),
    CONSTRAINT gc_document_digest_shape CHECK (sha256 IS NULL OR sha256 ~ '^[0-9a-f]{64}$')
);

CREATE INDEX gc_document_subject_idx ON gc_document(subject_id, document_id);

CREATE TABLE gc_extraction_job (
    job_id UUID PRIMARY KEY,
    document_id UUID NOT NULL UNIQUE REFERENCES gc_document(document_id) ON DELETE CASCADE,
    subject_id VARCHAR(80) NOT NULL REFERENCES gc_subject(subject_id),
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    finished_at TIMESTAMPTZ,
    CONSTRAINT gc_extraction_job_status CHECK (status IN ('COMPLETED', 'FAILED'))
);

CREATE TABLE gc_candidate (
    candidate_id UUID PRIMARY KEY,
    job_id UUID NOT NULL REFERENCES gc_extraction_job(job_id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES gc_document(document_id) ON DELETE CASCADE,
    subject_id VARCHAR(80) NOT NULL REFERENCES gc_subject(subject_id),
    status VARCHAR(20) NOT NULL,
    label VARCHAR(80) NOT NULL,
    candidate_value VARCHAR(64) NOT NULL,
    unit VARCHAR(32) NOT NULL,
    observed_on DATE NOT NULL,
    evidence_page INTEGER NOT NULL,
    source_text_sha256 CHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    confirmed_at TIMESTAMPTZ,
    CONSTRAINT gc_candidate_status CHECK (status IN ('PENDING', 'CONFIRMED')),
    CONSTRAINT gc_candidate_evidence_page CHECK (evidence_page > 0),
    CONSTRAINT gc_candidate_digest_shape CHECK (source_text_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT gc_candidate_confirmation CHECK (
        (status = 'PENDING' AND confirmed_at IS NULL)
        OR (status = 'CONFIRMED' AND confirmed_at IS NOT NULL)
    )
);

CREATE INDEX gc_candidate_subject_idx ON gc_candidate(subject_id, candidate_id);

CREATE TABLE gc_health_record (
    record_id UUID PRIMARY KEY,
    candidate_id UUID NOT NULL UNIQUE REFERENCES gc_candidate(candidate_id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES gc_document(document_id) ON DELETE CASCADE,
    subject_id VARCHAR(80) NOT NULL REFERENCES gc_subject(subject_id),
    label VARCHAR(80) NOT NULL,
    confirmed_value VARCHAR(64) NOT NULL,
    unit VARCHAR(32) NOT NULL,
    observed_on DATE NOT NULL,
    confirmed_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX gc_health_record_subject_idx ON gc_health_record(subject_id, record_id);

CREATE TABLE gc_deletion_request (
    deletion_id UUID PRIMARY KEY,
    subject_hash CHAR(64) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL,
    requested_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    CONSTRAINT gc_deletion_status CHECK (status IN ('COMPLETED')),
    CONSTRAINT gc_deletion_digest_shape CHECK (subject_hash ~ '^[0-9a-f]{64}$')
);

CREATE TABLE gc_idempotency (
    subject_hash CHAR(64) NOT NULL,
    operation VARCHAR(80) NOT NULL,
    idempotency_key VARCHAR(80) NOT NULL,
    resource_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (subject_hash, operation, idempotency_key),
    CONSTRAINT gc_idempotency_digest_shape CHECK (subject_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT gc_idempotency_key_shape CHECK (idempotency_key ~ '^[A-Za-z0-9._:-]{8,80}$')
);

CREATE TABLE gc_audit_event (
    audit_sequence BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_id UUID NOT NULL UNIQUE,
    subject_hash CHAR(64) NOT NULL,
    actor_session_hash CHAR(64),
    event_type VARCHAR(80) NOT NULL,
    resource_type VARCHAR(40) NOT NULL,
    resource_id UUID,
    outcome VARCHAR(16) NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT gc_audit_subject_digest_shape CHECK (subject_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT gc_audit_session_digest_shape CHECK (actor_session_hash IS NULL OR actor_session_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT gc_audit_outcome CHECK (outcome IN ('SUCCESS', 'DENIED', 'REJECTED'))
);

CREATE INDEX gc_audit_subject_idx ON gc_audit_event(subject_hash, audit_sequence);

