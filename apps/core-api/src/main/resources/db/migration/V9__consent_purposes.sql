-- Wave 2C: consent is stored per purpose. The research and project purposes are recorded so the
-- person can see and withdraw them; nothing in the document lifecycle reads them. One ACTIVE row
-- per (subject, purpose) is still enforced by gc_consent_one_active_purpose_idx. Audit rows may
-- carry the purpose code and nothing else (no value, no date, no policy text).
ALTER TABLE gc_consent_grant DROP CONSTRAINT gc_consent_purpose;
ALTER TABLE gc_consent_grant
    ADD CONSTRAINT gc_consent_purpose CHECK (
        purpose_code ~ '^(DOCUMENT_EXTRACTION|RESEARCH_USE|RESEARCH_CONTACT|PROJECT:[a-z0-9-]{1,40})$'
    );

ALTER TABLE gc_audit_event
    ADD COLUMN purpose_code VARCHAR(48),
    ADD CONSTRAINT gc_audit_purpose_shape CHECK (
        purpose_code IS NULL
        OR purpose_code ~ '^(DOCUMENT_EXTRACTION|RESEARCH_USE|RESEARCH_CONTACT|PROJECT:[a-z0-9-]{1,40})$'
    );
