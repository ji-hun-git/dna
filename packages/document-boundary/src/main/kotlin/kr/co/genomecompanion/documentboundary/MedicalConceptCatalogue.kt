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
    /** Canonical spellings a row may carry for this concept; the first is [canonicalUnit]. Spelling only, never a conversion. */
    val acceptedUnits: List<String> = listOf(canonicalUnit),
    /** True only when a public loinc.org read showed the code is no more specific than the labels (docs/status/2026-09-17/loinc-audit.md). */
    val loincExport: Boolean = false,
) {
    init {
        require(conceptCode.matches(Regex("^[a-z0-9-]{1,64}$"))) { "concept code shape: $conceptCode" }
        require(displayKo.length in 1..80) { "display label length: $conceptCode" }
        require(canonicalUnit.length in 1..32) { "canonical unit length: $conceptCode" }
        require(aliases.isNotEmpty()) { "at least one alias: $conceptCode" }
        require(acceptedUnits.firstOrNull() == canonicalUnit) { "accepted units start with the canonical unit: $conceptCode" }
        require(acceptedUnits.distinct().size == acceptedUnits.size) { "duplicate accepted unit: $conceptCode" }
        require(acceptedUnits.all { MedicalUnitSpelling.canonical(it) == it }) { "accepted units are canonical spellings: $conceptCode" }
        require(!loincExport || loincCode != null) { "loincExport needs a code: $conceptCode" }
    }

    /** The unit guard: true when the row's unit, after spelling unification, is one this concept accepts. */
    fun accepts(unit: String): Boolean = MedicalUnitSpelling.canonical(unit) in acceptedUnits
}


/**
 * The single Kotlin source of the alias dictionary. Core seeds `gc_medical_concept` from V7 + V11 SQL and a
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

    private val mgDl = listOf("mg/dL")
    private val mgDlMmol = listOf("mg/dL", "mmol/L")
    private val uL = listOf("U/L", "IU/L")
    private val ngMl = listOf("ng/mL")

    val entries: List<MedicalConcept> = listOf(
        concept("total-cholesterol", "총콜레스테롤", "2093-3", true, mgDlMmol, "콜레스테롤", "Total Cholesterol", "Cholesterol", "T-Chol", "TC"),
        concept("ldl-cholesterol", "LDL 콜레스테롤", "2089-1", true, mgDlMmol, "LDL-C", "LDL", "LDL Cholesterol", "저밀도 콜레스테롤"),
        concept("hdl-cholesterol", "HDL 콜레스테롤", "2085-9", true, mgDlMmol, "HDL-C", "HDL", "HDL Cholesterol", "고밀도 콜레스테롤"),
        concept("triglycerides", "중성지방", "2571-8", true, mgDlMmol, "Triglycerides", "Triglyceride", "TG"),
        concept("fasting-glucose", "공복혈당", "1558-6", true, mgDlMmol, "Fasting Glucose", "FBS", "FPG", "식전혈당"),
        concept("hba1c", "당화혈색소", "4548-4", true, listOf("%"), "HbA1c", "Hemoglobin A1c", "A1c"),
        concept("ast", "AST", "1920-8", true, uL, "AST(GOT)", "GOT", "SGOT", "Aspartate Aminotransferase"),
        concept("alt", "ALT", "1742-6", true, uL, "ALT(GPT)", "GPT", "SGPT", "Alanine Aminotransferase"),
        concept("gamma-gtp", "γ-GTP", "2324-2", true, uL, "감마지티피", "r-GTP", "GGT", "Gamma GT", "γ-GT", "gamma-GTP"),
        concept("alp", "ALP", "6768-6", true, uL, "Alkaline Phosphatase", "알칼리포스파타제"),
        concept("total-bilirubin", "총빌리루빈", "1975-2", true, mgDl, "Total Bilirubin", "T-Bil"),
        concept("albumin", "알부민", "1751-7", true, listOf("g/dL"), "Albumin", "Alb"),
        concept("bun", "BUN", "3094-0", true, mgDl, "혈중요소질소", "Blood Urea Nitrogen", "Urea Nitrogen"),
        concept("creatinine", "크레아티닌", "2160-0", true, listOf("mg/dL", "µmol/L"), "Creatinine", "Cr", "Creat"),
        concept("egfr", "eGFR", "62238-1", false, listOf("mL/min/1.73m²"), "e-GFR", "estimated GFR", "추정 사구체여과율", "신사구체여과율(e-GFR)"),
        concept("uric-acid", "요산", "3084-1", true, mgDl, "Uric Acid", "UA"),
        concept("hemoglobin", "혈색소", "718-7", true, listOf("g/dL", "g/L"), "헤모글로빈", "Hemoglobin", "Hb", "Hgb"),
        concept("red-blood-cells", "적혈구", "26453-1", true, listOf("10⁶/µL"), "적혈구수", "RBC", "Red Blood Cell"),
        concept("white-blood-cells", "백혈구", "26464-8", true, listOf("10³/µL", "/µL"), "백혈구수", "WBC", "White Blood Cell"),
        concept("platelets", "혈소판", "26515-7", true, listOf("10³/µL", "/µL"), "혈소판수", "Platelet", "Platelets", "PLT"),
        concept("urine-protein", "요단백", "2888-6", true, mgDl, "Urine Protein", "Proteinuria"),
        concept("urine-glucose", "요당", "2350-7", true, mgDl, "Urine Glucose", "Glycosuria"),
        concept("systolic-blood-pressure", "수축기 혈압", "8480-6", true, listOf("mmHg"), "최고혈압", "Systolic", "Systolic Blood Pressure", "SBP"),
        concept("diastolic-blood-pressure", "이완기 혈압", "8462-4", true, listOf("mmHg"), "최저혈압", "Diastolic", "Diastolic Blood Pressure", "DBP"),
        concept("pulse", "맥박", "8867-4", true, listOf("회/분"), "맥박수", "심박수", "Pulse", "Heart Rate", "HR"),
        concept("height", "키", "8302-2", true, listOf("cm"), "신장", "Height"),
        concept("weight", "체중", "29463-7", true, listOf("kg"), "몸무게", "Weight", "Body Weight"),
        concept("bmi", "BMI", "39156-5", true, listOf("kg/m²"), "체질량지수", "Body Mass Index"),
        concept("waist-circumference", "허리둘레", "8280-0", false, listOf("cm"), "Waist", "Waist Circumference", "WC"),
        concept("vitamin-d", "비타민 D", "1989-3", false, ngMl, "Vitamin D", "25-OH Vitamin D", "25(OH)D", "Vit D"),
        concept("tsh", "TSH", "3016-3", true, listOf("µIU/mL"), "갑상선자극호르몬", "Thyroid Stimulating Hormone"),
        concept("free-t4", "free T4", "3024-7", true, listOf("ng/dL"), "FT4", "유리 티록신"),
        concept("crp", "CRP", "1988-5", true, listOf("mg/L", "mg/dL"), "C-반응단백", "C-Reactive Protein"),
        concept("ferritin", "페리틴", "2276-4", true, ngMl, "Ferritin"),
        concept("sodium", "나트륨", "2951-2", true, listOf("mmol/L", "mEq/L"), "Sodium", "Na"),
        concept("potassium", "칼륨", "2823-3", true, listOf("mmol/L", "mEq/L"), "Potassium"),
        concept("calcium", "칼슘", "17861-6", true, mgDl, "Calcium", "Ca"),
        concept("total-protein", "총단백", "2885-2", true, listOf("g/dL"), "Total Protein", "TP"),
        // Wave 5: generic concepts for labels that do not say which specific test they are. No LOINC.
        // "Glucose"/"GLU" alone does not state the specimen (the same word appears in urine sections
        // of a result sheet), so it is deliberately not an alias here; a bare label like that resolves
        // to no concept and the raw label is kept downstream. See coordinator review, Fix 1.
        concept("glucose", "혈당", null, false, mgDlMmol, "Blood Glucose", "혈당(Glucose)", "Serum Glucose", "Plasma Glucose"),
        concept("bilirubin", "빌리루빈", null, false, mgDl, "Bilirubin"),
        concept("gfr", "사구체여과율", null, false, listOf("mL/min/1.73m²"), "GFR"),
        // Wave 5: specific siblings split out of the old broad aliases.
        concept("postprandial-glucose", "식후혈당", null, false, mgDlMmol, "식후 2시간 혈당", "PP2", "2hr PP", "Postprandial Glucose"),
        concept("direct-bilirubin", "직접빌리루빈", "1968-7", true, mgDl, "Direct Bilirubin", "D-Bil"),
        concept("hs-crp", "고감도 CRP", "30522-7", true, listOf("mg/L", "mg/dL"), "hs-CRP", "hsCRP", "고감도 C-반응단백"),
        // Wave 5: numeric check-up items.
        concept("hematocrit", "헤마토크릿", null, false, listOf("%"), "Hematocrit", "Hct", "적혈구용적률"),
        concept("mcv", "MCV", "30428-7", true, listOf("fL"), "평균적혈구용적", "Mean Corpuscular Volume"),
        concept("mch", "MCH", "28539-5", true, listOf("pg"), "평균적혈구혈색소", "Mean Corpuscular Hemoglobin"),
        concept("mchc", "MCHC", "28540-3", true, listOf("g/dL", "%"), "평균적혈구혈색소농도", "Mean Corpuscular Hemoglobin Concentration"),
        concept("chloride", "염소", "2075-0", true, listOf("mmol/L", "mEq/L"), "Chloride", "Cl", "클로라이드"),
        concept("phosphorus", "인(P)", "2777-1", true, mgDl, "Phosphorus", "Inorganic Phosphorus", "무기인", "IP"),
        concept("magnesium", "마그네슘", "19123-9", true, listOf("mg/dL", "mmol/L", "mEq/L"), "Magnesium", "Mg"),
        concept("iron", "혈청철", "2498-4", true, listOf("µg/dL"), "Iron", "Serum Iron", "Fe", "철(Fe)"),
        concept("tibc", "TIBC", "2500-7", true, listOf("µg/dL"), "총철결합능", "Total Iron Binding Capacity"),
        concept("vitamin-b12", "비타민 B12", "2132-9", true, listOf("pg/mL"), "Vitamin B12", "Vit B12", "Cobalamin"),
        concept("folate", "엽산", "2284-8", true, ngMl, "Folate", "Folic Acid"),
        concept("esr", "ESR", "30341-2", true, listOf("mm/hr"), "적혈구침강속도", "Erythrocyte Sedimentation Rate"),
        concept("ldh", "LDH", "2532-0", true, uL, "젖산탈수소효소", "Lactate Dehydrogenase", "LD"),
        concept("amylase", "아밀라아제", "1798-8", true, uL, "Amylase", "아밀라제"),
        concept("ck", "CK", "2157-6", true, uL, "크레아틴키나아제", "Creatine Kinase", "CPK"),
        concept("free-t3", "free T3", "3051-0", true, listOf("pg/mL"), "FT3", "유리 T3"),
        concept("t3", "T3", "3053-6", true, listOf("ng/dL", "ng/mL"), "Total T3", "Triiodothyronine"),
        concept("non-hdl-cholesterol", "non-HDL 콜레스테롤", "43396-1", true, mgDlMmol, "Non-HDL Cholesterol", "Non-HDL", "Non-HDL-C"),
        concept("insulin", "인슐린", "20448-7", true, listOf("µU/mL", "µIU/mL"), "Insulin"),
        concept("afp", "AFP", "1834-1", true, listOf("ng/mL", "IU/mL"), "알파태아단백", "Alpha-Fetoprotein", "α-FP"),
        concept("cea", "CEA", "2039-6", true, ngMl, "암태아성항원", "Carcinoembryonic Antigen"),
        concept("psa", "PSA", "2857-1", true, ngMl, "전립선특이항원", "Prostate Specific Antigen"),
        concept("ca19-9", "CA19-9", "24108-3", true, listOf("U/mL"), "CA-19-9", "Carbohydrate Antigen 19-9"),
        concept("ca125", "CA125", "10334-1", true, listOf("U/mL"), "CA-125", "Cancer Antigen 125"),
        concept("rf", "RF", "11572-5", true, listOf("IU/mL", "U/mL"), "류마티스인자", "Rheumatoid Factor"),
    )

    private val byAlias: Map<String, MedicalConcept> = buildMap {
        this@MedicalConceptCatalogue.entries.forEach { medicalConcept ->
            medicalConcept.aliases.forEach { alias ->
                require(aliasKey(alias).length >= 2) { "one-character alias '$alias' for ${medicalConcept.conceptCode}" }
            }
            (listOf(medicalConcept.displayKo) + medicalConcept.aliases).forEach { alias ->
                val key = aliasKey(alias)
                require(put(key, medicalConcept) == null) { "duplicate alias key '$key' for ${medicalConcept.conceptCode}" }
            }
        }
    }

    private val byCode: Map<String, MedicalConcept> = entries.associateBy { it.conceptCode }

    fun find(label: String): MedicalConcept? = byAlias[aliasKey(label)]

    fun byCode(code: String): MedicalConcept? = byCode[code]

    /** Alias match plus the unit guard. Core applies the same rule to the persisted seed. */
    fun resolve(label: String, unit: String): MedicalConcept? = find(label)?.takeIf { it.accepts(unit) }

    private fun concept(code: String, displayKo: String, loinc: String?, export: Boolean, units: List<String>, vararg aliases: String) =
        MedicalConcept(code, displayKo, loinc, units.first(), aliases.toList(), units, export && loinc != null)
}
