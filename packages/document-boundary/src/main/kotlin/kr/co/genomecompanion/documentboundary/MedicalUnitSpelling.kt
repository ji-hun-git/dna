package kr.co.genomecompanion.documentboundary

import java.text.Normalizer


/**
 * Unit spellings only. `canonical` unifies how a unit is written (`mg/dl` → `mg/dL`); it never
 * converts a number between units.
 */
object MedicalUnitSpelling {
    private val canonicalSpellings = listOf(
        "mg/dL", "%", "ng/mL", "ng/dL", "mmHg", "kg", "cm", "kg/m²", "U/L", "IU/L", "g/dL", "10³/µL", "10⁶/µL",
        "/µL", "mL/min/1.73m²", "mmol/L", "µIU/mL", "mg/L", "회/분", "pg/mL", "mEq/L",
    )

    private val variants = mapOf(
        "㎎/㎗" to "mg/dL", "㎎/dl" to "mg/dL", "mg/㎗" to "mg/dL",
        "kg/m2" to "kg/m²", "kg/㎡" to "kg/m²",
        "10^3/µl" to "10³/µL", "10^3/ul" to "10³/µL", "10³/ul" to "10³/µL", "x10³/µl" to "10³/µL", "k/µl" to "10³/µL",
        "10^6/µl" to "10⁶/µL", "10^6/ul" to "10⁶/µL", "10⁶/ul" to "10⁶/µL", "m/µl" to "10⁶/µL",
        "/ul" to "/µL",
        "ml/min/1.73m2" to "mL/min/1.73m²", "ml/min/1.73㎡" to "mL/min/1.73m²",
        "uiu/ml" to "µIU/mL",
        "bpm" to "회/분", "/min" to "회/분",
    )

    /** NFC, lower-case, whitespace removed, Greek mu (U+03BC) folded to the micro sign (U+00B5). */
    fun key(unit: String): String =
        Normalizer.normalize(unit, Normalizer.Form.NFC)
            .lowercase()
            .filterNot { it.isWhitespace() }
            .replace('μ', 'µ')

    private val byKey: Map<String, String> =
        canonicalSpellings.associateBy { key(it) } + variants.map { (variant, canonical) -> key(variant) to canonical }

    fun canonical(unit: String): String? = byKey[key(unit)]
}
