-- Wave 2B: a person may confirm that the document states a different exam date than the parser
-- proposed. observed_on keeps the confirmed date; the parser's date is kept here (NULL = unchanged).
-- The candidate row keeps its own observed_on untouched. Audit rows never carry either date.
ALTER TABLE gc_health_record
    ADD COLUMN original_observed_on DATE,
    ADD CONSTRAINT gc_health_record_original_observed_on_differs CHECK (
        original_observed_on IS NULL OR original_observed_on <> observed_on
    );
