package kr.co.genomecompanion.benchmark

import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.fasterxml.jackson.module.kotlin.readValue
import kr.co.genomecompanion.documentboundary.MedicalConceptCatalogue
import kr.co.genomecompanion.documentworker.NativeTextExtractionProvider
import kr.co.genomecompanion.documentworker.ParsedAbstention
import kr.co.genomecompanion.documentworker.ParsedCandidate
import java.nio.file.Files
import java.nio.file.Path
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.Locale


@JsonIgnoreProperties(ignoreUnknown = true)
data class CorpusDocumentRef(val documentId: String, val documentType: String)


@JsonIgnoreProperties(ignoreUnknown = true)
data class CorpusIndex(val documents: List<CorpusDocumentRef>)


data class RunEvidence(val page: Int, val blockId: String, val box: Box, val sourceTextSha256: String)


data class RunCandidate(
    val fieldId: String,
    val label: String,
    val value: String,
    val unit: String,
    val observedAt: String,
    val evidence: RunEvidence,
    val semanticRole: String = "measurement",
    val confidence: Double = 1.0,
    val referenceRangeText: String? = null,
)


data class RunAbstention(val fieldId: String, val label: String, val reason: String)


data class PinnedModel(
    val artifactSha256: String,
    val modelId: String = "pdfbox-native-text",
    val executionMode: String = "offline-pinned",
)


data class RunModels(val layout: PinnedModel, val semantic: PinnedModel)


data class NativeTextRun(
    val runId: String,
    val documentId: String,
    val documentSha256: String,
    val documentType: String,
    val createdAt: String,
    val models: RunModels,
    val candidates: List<RunCandidate>,
    val abstentions: List<RunAbstention>,
    val schemaVersion: String = "medical-document-run.v1",
    val pipelineId: String = "pdfbox-native-text",
    val language: String = "ko-KR",
    val synthetic: Boolean = true,
)


/**
 * Runs the worker's provider over a generated corpus and writes `medical-document-run.v1` records.
 * There is no model: both "models" are the provider class, pinned by the digest of its bytecode.
 * `blockId` is `block-row-NN` from the candidate ordinal, the same rule the gold writer uses.
 */
object NativeTextRunner {
    fun providerArtifactSha256(): String {
        val stream = checkNotNull(
            NativeTextExtractionProvider::class.java.getResourceAsStream("NativeTextExtractionProvider.class"),
        ) { "provider class bytes are not on the classpath" }
        return "sha256:" + BenchmarkJson.sha256(stream.use { it.readAllBytes() })
    }

    fun run(corpusDir: Path, createdAt: OffsetDateTime = OffsetDateTime.now(ZoneOffset.UTC)): List<NativeTextRun> {
        val index: CorpusIndex = BenchmarkJson.mapper.readValue(corpusDir.resolve("corpus.json").toFile())
        val model = PinnedModel(providerArtifactSha256())
        val stamp = createdAt.format(DateTimeFormatter.ISO_OFFSET_DATE_TIME)
        return index.documents.map { document ->
            val bytes = Files.readAllBytes(corpusDir.resolve("${document.documentId}.pdf"))
            val outcome = NativeTextExtractionProvider.extract(bytes)
            val usedFieldIds = mutableSetOf<String>()
            NativeTextRun(
                runId = "run-native-text-" + document.documentId.removePrefix("synthetic-"),
                documentId = document.documentId,
                documentSha256 = "sha256:" + BenchmarkJson.sha256(bytes),
                documentType = document.documentType,
                createdAt = stamp,
                models = RunModels(layout = model, semantic = model),
                candidates = outcome.candidates.map { toCandidate(it, usedFieldIds) },
                abstentions = outcome.abstentions.mapIndexed { index, abstention -> toAbstention(abstention, index, usedFieldIds) },
            )
        }
    }

    private fun toCandidate(candidate: ParsedCandidate, used: MutableSet<String>) = RunCandidate(
        fieldId = fieldIdFor(candidate.label, candidate.ordinal, used),
        label = candidate.label,
        value = candidate.value,
        unit = candidate.unit,
        observedAt = candidate.observedOn.toString(),
        evidence = RunEvidence(
            page = candidate.evidencePage,
            blockId = String.format(Locale.ROOT, "block-row-%02d", candidate.ordinal),
            box = Box(candidate.evidenceBox.x, candidate.evidenceBox.y, candidate.evidenceBox.width, candidate.evidenceBox.height),
            sourceTextSha256 = "sha256:" + candidate.sourceTextSha256,
        ),
        referenceRangeText = candidate.referenceRangeText,
    )

    private fun toAbstention(abstention: ParsedAbstention, index: Int, used: MutableSet<String>) = RunAbstention(
        fieldId = fieldIdFor(abstention.label, index, used),
        label = abstention.label,
        reason = abstention.reason.code,
    )

    private fun fieldIdFor(label: String, fallbackIndex: Int, used: MutableSet<String>): String {
        val base = if (label == NativeTextExtractionProvider.DOCUMENT_LABEL) {
            "document"
        } else {
            MedicalConceptCatalogue.find(label)?.conceptCode ?: slug(label).ifEmpty { "unknown-$fallbackIndex" }
        }
        var candidate = base
        var suffix = 2
        while (!used.add(candidate)) {
            candidate = "$base-${suffix++}"
        }
        return candidate
    }

    private fun slug(label: String): String =
        label.lowercase(Locale.ROOT).replace(Regex("[^a-z0-9]+"), "-").trim('-')
}
