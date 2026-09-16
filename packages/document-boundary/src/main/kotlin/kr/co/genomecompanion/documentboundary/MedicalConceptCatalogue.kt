package kr.co.genomecompanion.documentboundary

import java.text.Normalizer


/**
 * One row of the medical concept dictionary: a display label, an optional LOINC code (informational
 * metadata only, never used for matching), a canonical unit spelling and aliases. There is
 * deliberately no reference range, no normal/abnormal rule and no unit conversion factor here.
 */
data class MedicalConcept(
    val conceptCode: String,
    val displayKo: String,
    val loincCode: String?,
    val canonicalUnit: String,
    val aliases: List<String>,
) {
    init {
        require(conceptCode.matches(Regex("^[a-z0-9-]{1,64}$"))) { "concept code shape: $conceptCode" }
        require(displayKo.length in 1..80) { "display label length: $conceptCode" }
        require(canonicalUnit.length in 1..32) { "canonical unit length: $conceptCode" }
        require(aliases.isNotEmpty()) { "at least one alias: $conceptCode" }
    }
}


/**
 * The single Kotlin source of the alias dictionary. Core seeds `gc_medical_concept` from V7 SQL and a
 * PostgreSQL test asserts that seed equals [entries]; the benchmark prints these labels.
 */
object MedicalConceptCatalogue {
    /** Alias comparison key: NFC, trimmed, trailing colon removed, lower-case, whitespace removed. */
    fun aliasKey(label: String): String =
        Normalizer.normalize(label, Normalizer.Form.NFC)
            .trim()
            .trimEnd(':', '：')
            .lowercase()
            .filterNot { it.isWhitespace() }

    val entries: List<MedicalConcept> = listOf(
        concept("total-cholesterol", "총콜레스테롤", "2093-3", "mg/dL", "콜레스테롤", "Total Cholesterol", "Cholesterol", "T-Chol", "TC"),
        concept("ldl-cholesterol", "LDL 콜레스테롤", "13457-7", "mg/dL", "LDL-C", "LDL", "LDL Cholesterol", "저밀도 콜레스테롤"),
        concept("hdl-cholesterol", "HDL 콜레스테롤", "2085-9", "mg/dL", "HDL-C", "HDL", "HDL Cholesterol", "고밀도 콜레스테롤"),
        concept("triglycerides", "중성지방", "2571-8", "mg/dL", "Triglycerides", "Triglyceride", "TG"),
        concept("fasting-glucose", "공복혈당", "1558-6", "mg/dL", "혈당", "Fasting Glucose", "Glucose", "FBS", "FPG"),
        concept("hba1c", "당화혈색소", "4548-4", "%", "HbA1c", "Hemoglobin A1c", "A1c"),
        concept("ast", "AST", "1920-8", "U/L", "AST(GOT)", "GOT", "SGOT", "Aspartate Aminotransferase"),
        concept("alt", "ALT", "1742-6", "U/L", "ALT(GPT)", "GPT", "SGPT", "Alanine Aminotransferase"),
        concept("gamma-gtp", "γ-GTP", "2324-2", "U/L", "감마지티피", "r-GTP", "GGT", "Gamma GT", "γ-GT", "gamma-GTP"),
        concept("alp", "ALP", "6768-6", "U/L", "Alkaline Phosphatase", "알칼리포스파타제"),
        concept("total-bilirubin", "총빌리루빈", "1975-2", "mg/dL", "Total Bilirubin", "T-Bil", "Bilirubin"),
        concept("albumin", "알부민", "1751-7", "g/dL", "Albumin", "Alb"),
        concept("bun", "BUN", "3094-0", "mg/dL", "혈중요소질소", "Blood Urea Nitrogen", "Urea Nitrogen"),
        concept("creatinine", "크레아티닌", "2160-0", "mg/dL", "Creatinine", "Cr", "Creat"),
        concept("egfr", "eGFR", "62238-1", "mL/min/1.73m²", "사구체여과율", "GFR", "estimated GFR", "e-GFR"),
        concept("uric-acid", "요산", "3084-1", "mg/dL", "Uric Acid", "UA"),
        concept("hemoglobin", "혈색소", "718-7", "g/dL", "헤모글로빈", "Hemoglobin", "Hb", "Hgb"),
        concept("red-blood-cells", "적혈구", "789-8", "10⁶/µL", "적혈구수", "RBC", "Red Blood Cell"),
        concept("white-blood-cells", "백혈구", "6690-2", "10³/µL", "백혈구수", "WBC", "White Blood Cell"),
        concept("platelets", "혈소판", "777-3", "10³/µL", "혈소판수", "Platelet", "Platelets", "PLT"),
        concept("urine-protein", "요단백", "5804-0", "mg/dL", "Urine Protein", "Proteinuria"),
        concept("urine-glucose", "요당", "5792-7", "mg/dL", "Urine Glucose", "Glycosuria"),
        concept("systolic-blood-pressure", "수축기 혈압", "8480-6", "mmHg", "최고혈압", "Systolic", "Systolic Blood Pressure", "SBP"),
        concept("diastolic-blood-pressure", "이완기 혈압", "8462-4", "mmHg", "최저혈압", "Diastolic", "Diastolic Blood Pressure", "DBP"),
        concept("pulse", "맥박", "8867-4", "회/분", "맥박수", "심박수", "Pulse", "Heart Rate", "HR"),
        concept("height", "키", "8302-2", "cm", "신장", "Height"),
        concept("weight", "체중", "29463-7", "kg", "몸무게", "Weight", "Body Weight"),
        concept("bmi", "BMI", "39156-5", "kg/m²", "체질량지수", "Body Mass Index"),
        concept("waist-circumference", "허리둘레", "8280-0", "cm", "Waist", "Waist Circumference", "WC"),
        concept("vitamin-d", "비타민 D", "1989-3", "ng/mL", "Vitamin D", "25-OH Vitamin D", "25(OH)D", "Vit D"),
        concept("tsh", "TSH", "3016-3", "µIU/mL", "갑상선자극호르몬", "Thyroid Stimulating Hormone"),
        concept("free-t4", "free T4", "3024-7", "ng/dL", "FT4", "유리 티록신"),
        concept("crp", "CRP", "1988-5", "mg/L", "C-반응단백", "C-Reactive Protein", "hs-CRP"),
        concept("ferritin", "페리틴", "2276-4", "ng/mL", "Ferritin"),
        concept("sodium", "나트륨", "2951-2", "mmol/L", "Sodium", "Na"),
        concept("potassium", "칼륨", "2823-3", "mmol/L", "Potassium", "K"),
        concept("calcium", "칼슘", "17861-6", "mg/dL", "Calcium", "Ca"),
        concept("total-protein", "총단백", "2885-2", "g/dL", "Total Protein", "TP"),
    )

    private val byAlias: Map<String, MedicalConcept> = buildMap {
        this@MedicalConceptCatalogue.entries.forEach { medicalConcept ->
            (listOf(medicalConcept.displayKo) + medicalConcept.aliases).forEach { alias ->
                val key = aliasKey(alias)
                require(put(key, medicalConcept) == null) { "duplicate alias key '$key' for ${medicalConcept.conceptCode}" }
            }
        }
    }

    private val byCode: Map<String, MedicalConcept> = entries.associateBy { it.conceptCode }

    fun find(label: String): MedicalConcept? = byAlias[aliasKey(label)]

    fun byCode(code: String): MedicalConcept? = byCode[code]

    private fun concept(code: String, displayKo: String, loinc: String?, unit: String, vararg aliases: String) =
        MedicalConcept(code, displayKo, loinc, unit, aliases.toList())
}
