-- Wave 7. Forward-only and safe on a populated database: nullable columns, one status added to a
-- CHECK, alias UPDATEs keyed by concept_code, and a trigger that only rejects future UPDATE/DELETE.

-- §4 idempotency: the same key with a different target or a different body is a client bug (422),
-- and a key older than 24 h is a new request. Existing rows keep NULL hash (never mismatch) and
-- expire 24 h after their created_at.
ALTER TABLE gc_idempotency
    ADD COLUMN request_sha256 CHAR(64),
    ADD COLUMN expires_at TIMESTAMPTZ,
    ADD CONSTRAINT gc_idempotency_request_digest_shape CHECK (request_sha256 IS NULL OR request_sha256 ~ '^[0-9a-f]{64}$');
UPDATE gc_idempotency SET expires_at = created_at + INTERVAL '24 hours' WHERE expires_at IS NULL;
ALTER TABLE gc_idempotency ALTER COLUMN expires_at SET NOT NULL;
CREATE INDEX gc_idempotency_expires_idx ON gc_idempotency(expires_at);

-- §1 founder decision 2: revoking DOCUMENT_EXTRACTION terminates in-flight and review documents.
ALTER TABLE gc_document DROP CONSTRAINT gc_document_status;
ALTER TABLE gc_document
    ADD CONSTRAINT gc_document_status CHECK (status IN (
        'UPLOAD_PENDING', 'UNTRUSTED_OBJECT', 'SECURITY_INSPECTION',
        'SECURITY_REJECTED', 'SECURITY_APPROVED', 'EXTRACTION_QUEUED',
        'EXTRACTION_RUNNING', 'REVIEW_REQUIRED', 'COMPLETED',
        'DELETION_PENDING', 'DELETED', 'FAILED_RETRYABLE', 'FAILED_TERMINAL',
        'TERMINATED_BY_REVOCATION'
    ));

-- §8 honesty: gc_audit_event is append-only at the database, like security_audit_event (V3).
CREATE FUNCTION reject_gc_audit_event_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'gc_audit_event rows are append-only';
END;
$$;
CREATE TRIGGER gc_audit_event_append_only
    BEFORE UPDATE OR DELETE ON gc_audit_event
    FOR EACH ROW EXECUTE FUNCTION reject_gc_audit_event_mutation();

-- §2 blood pressure split labels (mirrors MedicalConceptCatalogue; the seed-equality test binds them).
UPDATE gc_medical_concept SET aliases = '["최고혈압","Systolic","Systolic Blood Pressure","SBP","혈압(수축기)"]' WHERE concept_code = 'systolic-blood-pressure';
UPDATE gc_medical_concept SET aliases = '["최저혈압","Diastolic","Diastolic Blood Pressure","DBP","혈압(이완기)"]' WHERE concept_code = 'diastolic-blood-pressure';
