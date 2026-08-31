ALTER TABLE gc_document DROP CONSTRAINT gc_document_status;
ALTER TABLE gc_document ALTER COLUMN status TYPE VARCHAR(32);

UPDATE gc_document SET status = CASE status
    WHEN 'REQUESTED' THEN 'UPLOAD_PENDING'
    WHEN 'QUARANTINED' THEN 'UNTRUSTED_OBJECT'
    WHEN 'INSPECTED' THEN 'SECURITY_APPROVED'
    WHEN 'REJECTED' THEN 'SECURITY_REJECTED'
    ELSE status
END;

ALTER TABLE gc_document
    ADD COLUMN expected_sha256 CHAR(64),
    ADD COLUMN approved_object_key VARCHAR(160),
    ADD COLUMN preview_object_key VARCHAR(160),
    ADD COLUMN state_version BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN failure_code VARCHAR(80),
    ADD COLUMN updated_at TIMESTAMPTZ,
    ADD COLUMN finalized_at TIMESTAMPTZ,
    ADD COLUMN approved_at TIMESTAMPTZ,
    ADD COLUMN completed_at TIMESTAMPTZ;

UPDATE gc_document
SET expected_sha256 = sha256,
    updated_at = created_at
WHERE expected_sha256 IS NULL;

ALTER TABLE gc_document
    ADD CONSTRAINT gc_document_status CHECK (status IN (
        'UPLOAD_PENDING', 'UNTRUSTED_OBJECT', 'SECURITY_INSPECTION',
        'SECURITY_REJECTED', 'SECURITY_APPROVED', 'EXTRACTION_QUEUED',
        'EXTRACTION_RUNNING', 'REVIEW_REQUIRED', 'COMPLETED',
        'DELETION_PENDING', 'DELETED', 'FAILED_RETRYABLE', 'FAILED_TERMINAL'
    )),
    ADD CONSTRAINT gc_document_expected_digest_shape CHECK (
        expected_sha256 IS NULL OR expected_sha256 ~ '^[0-9a-f]{64}$'
    ),
    ADD CONSTRAINT gc_document_failure_shape CHECK (
        failure_code IS NULL OR failure_code ~ '^[a-z0-9_]{3,80}$'
    );

CREATE TABLE gc_upload_capability (
    capability_id UUID PRIMARY KEY,
    document_id UUID NOT NULL REFERENCES gc_document(document_id) ON DELETE CASCADE,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expected_length BIGINT NOT NULL,
    expected_sha256 CHAR(64) NOT NULL,
    issued_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    CONSTRAINT gc_upload_capability_expiry CHECK (expires_at > issued_at),
    CONSTRAINT gc_upload_capability_length CHECK (expected_length BETWEEN 64 AND 10485760),
    CONSTRAINT gc_upload_capability_digest CHECK (expected_sha256 ~ '^[0-9a-f]{64}$')
);

CREATE INDEX gc_upload_capability_document_idx
    ON gc_upload_capability(document_id, expires_at DESC);

CREATE TABLE gc_document_job (
    job_id UUID PRIMARY KEY,
    document_id UUID NOT NULL REFERENCES gc_document(document_id) ON DELETE CASCADE,
    job_type VARCHAR(32) NOT NULL,
    status VARCHAR(24) NOT NULL,
    attempt INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    available_at TIMESTAMPTZ NOT NULL,
    lease_token_hash CHAR(64),
    lease_expires_at TIMESTAMPTZ,
    worker_id_hash CHAR(64),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    failure_code VARCHAR(80),
    CONSTRAINT gc_document_job_type CHECK (job_type IN ('SECURITY_INSPECTION', 'SYNTHETIC_EXTRACTION')),
    CONSTRAINT gc_document_job_status CHECK (status IN (
        'QUEUED', 'LEASED', 'COMPLETED', 'FAILED_RETRYABLE', 'FAILED_TERMINAL', 'DEAD_LETTER'
    )),
    CONSTRAINT gc_document_job_attempts CHECK (attempt BETWEEN 0 AND max_attempts AND max_attempts BETWEEN 1 AND 10),
    CONSTRAINT gc_document_job_lease CHECK (
        (status = 'LEASED' AND lease_token_hash IS NOT NULL AND lease_expires_at IS NOT NULL AND worker_id_hash IS NOT NULL)
        OR (status <> 'LEASED')
    ),
    CONSTRAINT gc_document_job_failure_shape CHECK (
        failure_code IS NULL OR failure_code ~ '^[a-z0-9_]{3,80}$'
    )
);

CREATE UNIQUE INDEX gc_document_job_one_active_type_idx
    ON gc_document_job(document_id, job_type)
    WHERE status IN ('QUEUED', 'LEASED', 'FAILED_RETRYABLE');

CREATE INDEX gc_document_job_available_idx
    ON gc_document_job(job_type, available_at, created_at)
    WHERE status IN ('QUEUED', 'FAILED_RETRYABLE');

CREATE TABLE gc_document_inspection (
    inspection_id UUID PRIMARY KEY,
    job_id UUID NOT NULL UNIQUE REFERENCES gc_document_job(job_id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES gc_document(document_id) ON DELETE CASCADE,
    source_sha256 CHAR(64) NOT NULL,
    source_length BIGINT NOT NULL,
    decision VARCHAR(24) NOT NULL,
    reason VARCHAR(80) NOT NULL,
    identified_media_type VARCHAR(80),
    page_count INTEGER,
    indirect_object_count INTEGER,
    total_image_pixels BIGINT,
    encrypted BOOLEAN,
    active_content BOOLEAN,
    embedded_files BOOLEAN,
    policy_version VARCHAR(64) NOT NULL,
    scanner_name VARCHAR(80) NOT NULL,
    scanner_version VARCHAR(80) NOT NULL,
    signature_version VARCHAR(120) NOT NULL,
    inspected_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT gc_document_inspection_digest CHECK (source_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT gc_document_inspection_decision CHECK (decision IN ('APPROVED', 'REJECTED', 'RETRYABLE_FAILURE'))
);

CREATE TABLE gc_source_promotion (
    promotion_id UUID PRIMARY KEY,
    document_id UUID NOT NULL UNIQUE REFERENCES gc_document(document_id) ON DELETE CASCADE,
    inspection_id UUID NOT NULL REFERENCES gc_document_inspection(inspection_id),
    source_sha256 CHAR(64) NOT NULL,
    untrusted_object_key VARCHAR(160) NOT NULL,
    approved_object_key VARCHAR(160) NOT NULL,
    promoted_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT gc_source_promotion_digest CHECK (source_sha256 ~ '^[0-9a-f]{64}$')
);

ALTER TABLE gc_extraction_job DROP CONSTRAINT gc_extraction_job_status;
ALTER TABLE gc_extraction_job ALTER COLUMN status TYPE VARCHAR(24);
ALTER TABLE gc_extraction_job
    ADD COLUMN worker_job_id UUID REFERENCES gc_document_job(job_id),
    ADD COLUMN source_sha256 CHAR(64),
    ADD COLUMN worker_image_digest CHAR(64),
    ADD COLUMN generator_version VARCHAR(80),
    ADD COLUMN attempt INTEGER NOT NULL DEFAULT 1,
    ADD CONSTRAINT gc_extraction_job_status CHECK (status IN ('COMPLETED', 'FAILED')),
    ADD CONSTRAINT gc_extraction_source_digest CHECK (
        source_sha256 IS NULL OR source_sha256 ~ '^[0-9a-f]{64}$'
    ),
    ADD CONSTRAINT gc_extraction_image_digest CHECK (
        worker_image_digest IS NULL OR worker_image_digest ~ '^[0-9a-f]{64}$'
    );

CREATE UNIQUE INDEX gc_extraction_job_worker_job_idx
    ON gc_extraction_job(worker_job_id)
    WHERE worker_job_id IS NOT NULL;

CREATE TABLE gc_preview_artifact (
    preview_id UUID PRIMARY KEY,
    document_id UUID NOT NULL UNIQUE REFERENCES gc_document(document_id) ON DELETE CASCADE,
    source_sha256 CHAR(64) NOT NULL,
    preview_sha256 CHAR(64) NOT NULL,
    object_key VARCHAR(160) NOT NULL,
    media_type VARCHAR(32) NOT NULL,
    generator_version VARCHAR(80) NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT gc_preview_source_digest CHECK (source_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT gc_preview_digest CHECK (preview_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT gc_preview_media_type CHECK (media_type = 'image/png')
);
