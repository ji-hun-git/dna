ALTER TABLE gc_candidate
    ADD COLUMN extraction_method VARCHAR(32) NOT NULL DEFAULT 'native-text',
    ADD COLUMN evidence_box_x NUMERIC(6,5),
    ADD COLUMN evidence_box_y NUMERIC(6,5),
    ADD COLUMN evidence_box_w NUMERIC(6,5),
    ADD COLUMN evidence_box_h NUMERIC(6,5),
    ADD COLUMN concept_code VARCHAR(64),
    ADD CONSTRAINT gc_candidate_extraction_method CHECK (extraction_method = 'native-text'),
    ADD CONSTRAINT gc_candidate_concept_code_shape CHECK (concept_code IS NULL OR concept_code ~ '^[a-z0-9-]{1,64}$'),
    ADD CONSTRAINT gc_candidate_evidence_box CHECK (
        (evidence_box_x IS NULL AND evidence_box_y IS NULL AND evidence_box_w IS NULL AND evidence_box_h IS NULL)
        OR (
            evidence_box_x BETWEEN 0 AND 1 AND evidence_box_y BETWEEN 0 AND 1
            AND evidence_box_w BETWEEN 0 AND 1 AND evidence_box_h BETWEEN 0 AND 1
        )
    );

ALTER TABLE gc_health_record_version
    ADD COLUMN concept_code VARCHAR(64),
    ADD CONSTRAINT gc_health_record_version_concept_code_shape CHECK (
        concept_code IS NULL OR concept_code ~ '^[a-z0-9-]{1,64}$'
    );

ALTER TABLE gc_extraction_job
    ADD COLUMN abstentions JSONB NOT NULL DEFAULT '[]',
    ADD CONSTRAINT gc_extraction_job_abstentions_array CHECK (jsonb_typeof(abstentions) = 'array');

-- Alias dictionary only: display label, informational LOINC code, canonical unit spelling, aliases.
-- No reference range, no normal/abnormal rule, no conversion factor (PROJECT_GUIDE section 6).
-- Rows mirror MedicalConceptCatalogue.entries in packages/document-boundary; a PostgreSQL test asserts equality.
CREATE TABLE gc_medical_concept (
    concept_code VARCHAR(64) PRIMARY KEY,
    display_ko VARCHAR(80) NOT NULL,
    loinc_code VARCHAR(16),
    canonical_unit VARCHAR(32) NOT NULL,
    aliases JSONB NOT NULL,
    CONSTRAINT gc_medical_concept_code_shape CHECK (concept_code ~ '^[a-z0-9-]{1,64}$'),
    CONSTRAINT gc_medical_concept_aliases_array CHECK (jsonb_typeof(aliases) = 'array')
);

INSERT INTO gc_medical_concept (concept_code, display_ko, loinc_code, canonical_unit, aliases) VALUES
    ('total-cholesterol', '총콜레스테롤', '2093-3', 'mg/dL', '["콜레스테롤","Total Cholesterol","Cholesterol","T-Chol","TC"]'),
    ('ldl-cholesterol', 'LDL 콜레스테롤', '13457-7', 'mg/dL', '["LDL-C","LDL","LDL Cholesterol","저밀도 콜레스테롤"]'),
    ('hdl-cholesterol', 'HDL 콜레스테롤', '2085-9', 'mg/dL', '["HDL-C","HDL","HDL Cholesterol","고밀도 콜레스테롤"]'),
    ('triglycerides', '중성지방', '2571-8', 'mg/dL', '["Triglycerides","Triglyceride","TG"]'),
    ('fasting-glucose', '공복혈당', '1558-6', 'mg/dL', '["혈당","Fasting Glucose","Glucose","FBS","FPG"]'),
    ('hba1c', '당화혈색소', '4548-4', '%', '["HbA1c","Hemoglobin A1c","A1c"]'),
    ('ast', 'AST', '1920-8', 'U/L', '["AST(GOT)","GOT","SGOT","Aspartate Aminotransferase"]'),
    ('alt', 'ALT', '1742-6', 'U/L', '["ALT(GPT)","GPT","SGPT","Alanine Aminotransferase"]'),
    ('gamma-gtp', 'γ-GTP', '2324-2', 'U/L', '["감마지티피","r-GTP","GGT","Gamma GT","γ-GT","gamma-GTP"]'),
    ('alp', 'ALP', '6768-6', 'U/L', '["Alkaline Phosphatase","알칼리포스파타제"]'),
    ('total-bilirubin', '총빌리루빈', '1975-2', 'mg/dL', '["Total Bilirubin","T-Bil","Bilirubin"]'),
    ('albumin', '알부민', '1751-7', 'g/dL', '["Albumin","Alb"]'),
    ('bun', 'BUN', '3094-0', 'mg/dL', '["혈중요소질소","Blood Urea Nitrogen","Urea Nitrogen"]'),
    ('creatinine', '크레아티닌', '2160-0', 'mg/dL', '["Creatinine","Cr","Creat"]'),
    ('egfr', 'eGFR', '62238-1', 'mL/min/1.73m²', '["사구체여과율","GFR","estimated GFR","e-GFR"]'),
    ('uric-acid', '요산', '3084-1', 'mg/dL', '["Uric Acid","UA"]'),
    ('hemoglobin', '혈색소', '718-7', 'g/dL', '["헤모글로빈","Hemoglobin","Hb","Hgb"]'),
    ('red-blood-cells', '적혈구', '789-8', '10⁶/µL', '["적혈구수","RBC","Red Blood Cell"]'),
    ('white-blood-cells', '백혈구', '6690-2', '10³/µL', '["백혈구수","WBC","White Blood Cell"]'),
    ('platelets', '혈소판', '777-3', '10³/µL', '["혈소판수","Platelet","Platelets","PLT"]'),
    ('urine-protein', '요단백', '5804-0', 'mg/dL', '["Urine Protein","Proteinuria"]'),
    ('urine-glucose', '요당', '5792-7', 'mg/dL', '["Urine Glucose","Glycosuria"]'),
    ('systolic-blood-pressure', '수축기 혈압', '8480-6', 'mmHg', '["최고혈압","Systolic","Systolic Blood Pressure","SBP"]'),
    ('diastolic-blood-pressure', '이완기 혈압', '8462-4', 'mmHg', '["최저혈압","Diastolic","Diastolic Blood Pressure","DBP"]'),
    ('pulse', '맥박', '8867-4', '회/분', '["맥박수","심박수","Pulse","Heart Rate","HR"]'),
    ('height', '키', '8302-2', 'cm', '["신장","Height"]'),
    ('weight', '체중', '29463-7', 'kg', '["몸무게","Weight","Body Weight"]'),
    ('bmi', 'BMI', '39156-5', 'kg/m²', '["체질량지수","Body Mass Index"]'),
    ('waist-circumference', '허리둘레', '8280-0', 'cm', '["Waist","Waist Circumference","WC"]'),
    ('vitamin-d', '비타민 D', '1989-3', 'ng/mL', '["Vitamin D","25-OH Vitamin D","25(OH)D","Vit D"]'),
    ('tsh', 'TSH', '3016-3', 'µIU/mL', '["갑상선자극호르몬","Thyroid Stimulating Hormone"]'),
    ('free-t4', 'free T4', '3024-7', 'ng/dL', '["FT4","유리 티록신"]'),
    ('crp', 'CRP', '1988-5', 'mg/L', '["C-반응단백","C-Reactive Protein","hs-CRP"]'),
    ('ferritin', '페리틴', '2276-4', 'ng/mL', '["Ferritin"]'),
    ('sodium', '나트륨', '2951-2', 'mmol/L', '["Sodium","Na"]'),
    ('potassium', '칼륨', '2823-3', 'mmol/L', '["Potassium","K"]'),
    ('calcium', '칼슘', '17861-6', 'mg/dL', '["Calcium","Ca"]'),
    ('total-protein', '총단백', '2885-2', 'g/dL', '["Total Protein","TP"]');
