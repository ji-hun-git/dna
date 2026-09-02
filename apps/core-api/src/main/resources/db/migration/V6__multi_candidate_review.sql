ALTER TABLE gc_candidate ADD COLUMN ordinal INTEGER NOT NULL DEFAULT 1;

ALTER TABLE gc_candidate ADD CONSTRAINT gc_candidate_ordinal CHECK (ordinal > 0);

CREATE UNIQUE INDEX gc_candidate_document_ordinal_idx ON gc_candidate(document_id, ordinal);
