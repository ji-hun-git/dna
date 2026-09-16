package kr.co.genomecompanion.foundation

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import kr.co.genomecompanion.documentboundary.MedicalConcept
import kr.co.genomecompanion.documentboundary.MedicalConceptCatalogue
import kr.co.genomecompanion.documentboundary.MedicalUnitSpelling
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Component
import java.time.LocalDate


/** A candidate after core normalization: display label, concept code, unified unit spelling. Value untouched. */
data class NormalizedCandidate(
    val ordinal: Int,
    val label: String,
    val value: String,
    val unit: String,
    val observedOn: LocalDate,
    val evidencePage: Int,
    val evidenceBox: EvidenceBox?,
    val sourceTextSha256: String,
    val conceptCode: String?,
)


fun interface MedicalConceptSource {
    fun concepts(): List<MedicalConcept>
}


/** Reads the V7 seed. `gc_medical_concept` is the persisted authority; the Kotlin catalogue only guards drift. */
@Component
@ConditionalOnProperty(prefix = "gc.foundation", name = ["enabled"], havingValue = "true")
class JdbcMedicalConceptSource(private val jdbc: JdbcTemplate) : MedicalConceptSource {
    private val json = jacksonObjectMapper()

    override fun concepts(): List<MedicalConcept> = jdbc.query(
        "SELECT concept_code, display_ko, loinc_code, canonical_unit, aliases::text AS aliases FROM gc_medical_concept ORDER BY concept_code",
    ) { result, _ ->
        MedicalConcept(
            conceptCode = result.getString("concept_code"),
            displayKo = result.getString("display_ko"),
            loincCode = result.getString("loinc_code"),
            canonicalUnit = result.getString("canonical_unit"),
            aliases = json.readValue<List<String>>(result.getString("aliases")),
        )
    }
}


/**
 * Alias match → concept code and display label; unit spelling unified. No numeric conversion, no
 * reference range, no judgement. Unknown labels keep the raw label and `conceptCode = null`.
 * The dictionary is read once per process because the table is seed-only.
 */
@Component
@ConditionalOnProperty(prefix = "gc.foundation", name = ["enabled"], havingValue = "true")
class MedicalConceptNormalizer(private val source: MedicalConceptSource) {
    private val index: Map<String, MedicalConcept> by lazy {
        buildMap {
            source.concepts().forEach { concept ->
                (listOf(concept.displayKo) + concept.aliases).forEach { alias -> put(MedicalConceptCatalogue.aliasKey(alias), concept) }
            }
        }
    }

    fun normalize(candidate: ExtractedCandidate): NormalizedCandidate {
        val concept = index[MedicalConceptCatalogue.aliasKey(candidate.label)]
        return NormalizedCandidate(
            ordinal = candidate.ordinal,
            label = concept?.displayKo ?: candidate.label,
            value = candidate.value,
            unit = MedicalUnitSpelling.canonical(candidate.unit) ?: candidate.unit,
            observedOn = LocalDate.parse(candidate.observedOn),
            evidencePage = candidate.evidencePage,
            evidenceBox = candidate.evidenceBox,
            sourceTextSha256 = candidate.sourceTextSha256,
            conceptCode = concept?.conceptCode,
        )
    }
}
