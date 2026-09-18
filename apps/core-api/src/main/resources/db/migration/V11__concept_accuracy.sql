-- Wave 5 (concept accuracy). Forward-only and safe on a populated database: new columns are nullable
-- or defaulted, seed changes are UPDATEs keyed by concept_code plus INSERTs of new codes. Existing
-- candidate and record rows are NOT re-normalised: their raw label was never stored, so they keep the
-- concept they were given and a NULL original_label.
-- original_label is the item name exactly as the result sheet printed it (document text the person
-- already sees). It is copied to the record version at confirmation and inherited by corrections;
-- no request can write it and no audit row carries it.
ALTER TABLE gc_candidate
    ADD COLUMN original_label VARCHAR(80),
    ADD CONSTRAINT gc_candidate_original_label_length CHECK (original_label IS NULL OR char_length(original_label) BETWEEN 1 AND 80);

ALTER TABLE gc_health_record_version
    ADD COLUMN original_label VARCHAR(80),
    ADD CONSTRAINT gc_health_record_version_original_label_length CHECK (original_label IS NULL OR char_length(original_label) BETWEEN 1 AND 80);

-- accepted_units: canonical spellings a row may carry for the concept (first = canonical_unit). A label
-- whose unit is not listed gets no concept. Spelling only; never a conversion factor.
-- loinc_export: FALSE when the code is more specific than the labels, per docs/status/2026-09-17/loinc-audit.md.
ALTER TABLE gc_medical_concept
    ADD COLUMN accepted_units JSONB NOT NULL DEFAULT '[]',
    ADD COLUMN loinc_export BOOLEAN NOT NULL DEFAULT TRUE,
    ADD CONSTRAINT gc_medical_concept_accepted_units_array CHECK (jsonb_typeof(accepted_units) = 'array');

-- The statements below were generated from packages/document-boundary's
-- MedicalConceptCatalogue.entries (the single Kotlin source of truth) so that this seed is byte-for-byte
-- equal to it; a PostgreSQL test (medicalConceptSeedMatchesTheSharedCatalogue) asserts that equality.
-- LOINC values come from docs/status/2026-09-17/loinc-audit.md § Final values.

-- Existing (V7) concepts: accepted units for every row, plus the alias/LOINC changes the audit and the
-- narrower-than-concept alias rule require.
UPDATE gc_medical_concept SET accepted_units = '["mg/dL", "mmol/L"]', loinc_export = TRUE WHERE concept_code = 'total-cholesterol';
UPDATE gc_medical_concept SET accepted_units = '["mg/dL", "mmol/L"]', loinc_export = TRUE, loinc_code = '2089-1' WHERE concept_code = 'ldl-cholesterol';
UPDATE gc_medical_concept SET accepted_units = '["mg/dL", "mmol/L"]', loinc_export = TRUE WHERE concept_code = 'hdl-cholesterol';
UPDATE gc_medical_concept SET accepted_units = '["mg/dL", "mmol/L"]', loinc_export = TRUE WHERE concept_code = 'triglycerides';
UPDATE gc_medical_concept SET accepted_units = '["mg/dL", "mmol/L"]', loinc_export = TRUE, aliases = '["Fasting Glucose", "FBS", "FPG", "식전혈당"]' WHERE concept_code = 'fasting-glucose';
UPDATE gc_medical_concept SET accepted_units = '["%"]', loinc_export = TRUE WHERE concept_code = 'hba1c';
UPDATE gc_medical_concept SET accepted_units = '["U/L", "IU/L"]', loinc_export = TRUE WHERE concept_code = 'ast';
UPDATE gc_medical_concept SET accepted_units = '["U/L", "IU/L"]', loinc_export = TRUE WHERE concept_code = 'alt';
UPDATE gc_medical_concept SET accepted_units = '["U/L", "IU/L"]', loinc_export = TRUE WHERE concept_code = 'gamma-gtp';
UPDATE gc_medical_concept SET accepted_units = '["U/L", "IU/L"]', loinc_export = TRUE WHERE concept_code = 'alp';
UPDATE gc_medical_concept SET accepted_units = '["mg/dL"]', loinc_export = TRUE, aliases = '["Total Bilirubin", "T-Bil"]' WHERE concept_code = 'total-bilirubin';
UPDATE gc_medical_concept SET accepted_units = '["g/dL"]', loinc_export = TRUE WHERE concept_code = 'albumin';
UPDATE gc_medical_concept SET accepted_units = '["mg/dL"]', loinc_export = TRUE WHERE concept_code = 'bun';
UPDATE gc_medical_concept SET accepted_units = '["mg/dL", "µmol/L"]', loinc_export = TRUE WHERE concept_code = 'creatinine';
UPDATE gc_medical_concept SET accepted_units = '["mL/min/1.73m²"]', loinc_export = FALSE, aliases = '["e-GFR", "estimated GFR", "추정 사구체여과율", "신사구체여과율(e-GFR)"]' WHERE concept_code = 'egfr';
UPDATE gc_medical_concept SET accepted_units = '["mg/dL"]', loinc_export = TRUE WHERE concept_code = 'uric-acid';
UPDATE gc_medical_concept SET accepted_units = '["g/dL", "g/L"]', loinc_export = TRUE WHERE concept_code = 'hemoglobin';
UPDATE gc_medical_concept SET accepted_units = '["10⁶/µL"]', loinc_export = TRUE, loinc_code = '26453-1' WHERE concept_code = 'red-blood-cells';
UPDATE gc_medical_concept SET accepted_units = '["10³/µL", "/µL"]', loinc_export = TRUE, loinc_code = '26464-8' WHERE concept_code = 'white-blood-cells';
UPDATE gc_medical_concept SET accepted_units = '["10³/µL", "/µL"]', loinc_export = TRUE, loinc_code = '26515-7' WHERE concept_code = 'platelets';
UPDATE gc_medical_concept SET accepted_units = '["mg/dL"]', loinc_export = TRUE, loinc_code = '2888-6' WHERE concept_code = 'urine-protein';
UPDATE gc_medical_concept SET accepted_units = '["mg/dL"]', loinc_export = TRUE, loinc_code = '2350-7' WHERE concept_code = 'urine-glucose';
UPDATE gc_medical_concept SET accepted_units = '["mmHg"]', loinc_export = TRUE WHERE concept_code = 'systolic-blood-pressure';
UPDATE gc_medical_concept SET accepted_units = '["mmHg"]', loinc_export = TRUE WHERE concept_code = 'diastolic-blood-pressure';
UPDATE gc_medical_concept SET accepted_units = '["회/분"]', loinc_export = TRUE WHERE concept_code = 'pulse';
UPDATE gc_medical_concept SET accepted_units = '["cm"]', loinc_export = TRUE WHERE concept_code = 'height';
UPDATE gc_medical_concept SET accepted_units = '["kg"]', loinc_export = TRUE WHERE concept_code = 'weight';
UPDATE gc_medical_concept SET accepted_units = '["kg/m²"]', loinc_export = TRUE WHERE concept_code = 'bmi';
UPDATE gc_medical_concept SET accepted_units = '["cm"]', loinc_export = FALSE WHERE concept_code = 'waist-circumference';
UPDATE gc_medical_concept SET accepted_units = '["ng/mL"]', loinc_export = FALSE WHERE concept_code = 'vitamin-d';
UPDATE gc_medical_concept SET accepted_units = '["µIU/mL"]', loinc_export = TRUE WHERE concept_code = 'tsh';
UPDATE gc_medical_concept SET accepted_units = '["ng/dL"]', loinc_export = TRUE WHERE concept_code = 'free-t4';
UPDATE gc_medical_concept SET accepted_units = '["mg/L", "mg/dL"]', loinc_export = TRUE, aliases = '["C-반응단백", "C-Reactive Protein"]' WHERE concept_code = 'crp';
UPDATE gc_medical_concept SET accepted_units = '["ng/mL"]', loinc_export = TRUE WHERE concept_code = 'ferritin';
UPDATE gc_medical_concept SET accepted_units = '["mmol/L", "mEq/L"]', loinc_export = TRUE WHERE concept_code = 'sodium';
UPDATE gc_medical_concept SET accepted_units = '["mmol/L", "mEq/L"]', loinc_export = TRUE, aliases = '["Potassium"]' WHERE concept_code = 'potassium';
UPDATE gc_medical_concept SET accepted_units = '["mg/dL"]', loinc_export = TRUE WHERE concept_code = 'calcium';
UPDATE gc_medical_concept SET accepted_units = '["g/dL"]', loinc_export = TRUE WHERE concept_code = 'total-protein';

-- New concepts (Wave 5): three generics for broad labels that do not state which specific test they
-- are, two specific siblings split out of aliases that were too broad, and 26 numeric check-up items.
INSERT INTO gc_medical_concept (concept_code, display_ko, loinc_code, canonical_unit, aliases, accepted_units, loinc_export) VALUES
    ('glucose', '혈당', NULL, 'mg/dL', '["Blood Glucose", "혈당(Glucose)", "Serum Glucose", "Plasma Glucose"]', '["mg/dL", "mmol/L"]', FALSE),
    ('bilirubin', '빌리루빈', NULL, 'mg/dL', '["Bilirubin"]', '["mg/dL"]', FALSE),
    ('gfr', '사구체여과율', NULL, 'mL/min/1.73m²', '["GFR"]', '["mL/min/1.73m²"]', FALSE),
    ('postprandial-glucose', '식후혈당', NULL, 'mg/dL', '["식후 2시간 혈당", "PP2", "2hr PP", "Postprandial Glucose"]', '["mg/dL", "mmol/L"]', FALSE),
    ('direct-bilirubin', '직접빌리루빈', '1968-7', 'mg/dL', '["Direct Bilirubin", "D-Bil"]', '["mg/dL"]', TRUE),
    ('hs-crp', '고감도 CRP', '30522-7', 'mg/L', '["hs-CRP", "hsCRP", "고감도 C-반응단백"]', '["mg/L", "mg/dL"]', TRUE),
    ('hematocrit', '헤마토크릿', NULL, '%', '["Hematocrit", "Hct", "적혈구용적률"]', '["%"]', FALSE),
    ('mcv', 'MCV', '30428-7', 'fL', '["평균적혈구용적", "Mean Corpuscular Volume"]', '["fL"]', TRUE),
    ('mch', 'MCH', '28539-5', 'pg', '["평균적혈구혈색소", "Mean Corpuscular Hemoglobin"]', '["pg"]', TRUE),
    ('mchc', 'MCHC', '28540-3', 'g/dL', '["평균적혈구혈색소농도", "Mean Corpuscular Hemoglobin Concentration"]', '["g/dL", "%"]', TRUE),
    ('chloride', '염소', '2075-0', 'mmol/L', '["Chloride", "Cl", "클로라이드"]', '["mmol/L", "mEq/L"]', TRUE),
    ('phosphorus', '인(P)', '2777-1', 'mg/dL', '["Phosphorus", "Inorganic Phosphorus", "무기인", "IP"]', '["mg/dL"]', TRUE),
    ('magnesium', '마그네슘', '19123-9', 'mg/dL', '["Magnesium", "Mg"]', '["mg/dL", "mmol/L", "mEq/L"]', TRUE),
    ('iron', '혈청철', '2498-4', 'µg/dL', '["Iron", "Serum Iron", "Fe", "철(Fe)"]', '["µg/dL"]', TRUE),
    ('tibc', 'TIBC', '2500-7', 'µg/dL', '["총철결합능", "Total Iron Binding Capacity"]', '["µg/dL"]', TRUE),
    ('vitamin-b12', '비타민 B12', '2132-9', 'pg/mL', '["Vitamin B12", "Vit B12", "Cobalamin"]', '["pg/mL"]', TRUE),
    ('folate', '엽산', '2284-8', 'ng/mL', '["Folate", "Folic Acid"]', '["ng/mL"]', TRUE),
    ('esr', 'ESR', '30341-2', 'mm/hr', '["적혈구침강속도", "Erythrocyte Sedimentation Rate"]', '["mm/hr"]', TRUE),
    ('ldh', 'LDH', '2532-0', 'U/L', '["젖산탈수소효소", "Lactate Dehydrogenase", "LD"]', '["U/L", "IU/L"]', TRUE),
    ('amylase', '아밀라아제', '1798-8', 'U/L', '["Amylase", "아밀라제"]', '["U/L", "IU/L"]', TRUE),
    ('ck', 'CK', '2157-6', 'U/L', '["크레아틴키나아제", "Creatine Kinase", "CPK"]', '["U/L", "IU/L"]', TRUE),
    ('free-t3', 'free T3', '3051-0', 'pg/mL', '["FT3", "유리 T3"]', '["pg/mL"]', TRUE),
    ('t3', 'T3', '3053-6', 'ng/dL', '["Total T3", "Triiodothyronine"]', '["ng/dL", "ng/mL"]', TRUE),
    ('non-hdl-cholesterol', 'non-HDL 콜레스테롤', '43396-1', 'mg/dL', '["Non-HDL Cholesterol", "Non-HDL", "Non-HDL-C"]', '["mg/dL", "mmol/L"]', TRUE),
    ('insulin', '인슐린', '20448-7', 'µU/mL', '["Insulin"]', '["µU/mL", "µIU/mL"]', TRUE),
    ('afp', 'AFP', '1834-1', 'ng/mL', '["알파태아단백", "Alpha-Fetoprotein", "α-FP"]', '["ng/mL", "IU/mL"]', TRUE),
    ('cea', 'CEA', '2039-6', 'ng/mL', '["암태아성항원", "Carcinoembryonic Antigen"]', '["ng/mL"]', TRUE),
    ('psa', 'PSA', '2857-1', 'ng/mL', '["전립선특이항원", "Prostate Specific Antigen"]', '["ng/mL"]', TRUE),
    ('ca19-9', 'CA19-9', '24108-3', 'U/mL', '["CA-19-9", "Carbohydrate Antigen 19-9"]', '["U/mL"]', TRUE),
    ('ca125', 'CA125', '10334-1', 'U/mL', '["CA-125", "Cancer Antigen 125"]', '["U/mL"]', TRUE),
    ('rf', 'RF', '11572-5', 'IU/mL', '["류마티스인자", "Rheumatoid Factor"]', '["IU/mL", "U/mL"]', TRUE);

ALTER TABLE gc_medical_concept
    ADD CONSTRAINT gc_medical_concept_loinc_export_needs_code CHECK (loinc_export = FALSE OR loinc_code IS NOT NULL);
