package kr.co.genomecompanion.benchmark

import com.fasterxml.jackson.annotation.JsonInclude
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import java.nio.file.Files
import java.nio.file.Path
import java.security.MessageDigest
import java.util.HexFormat
import java.util.Locale


object BenchmarkJson {
    val mapper: ObjectMapper = jacksonObjectMapper().setDefaultPropertyInclusion(JsonInclude.Include.NON_NULL)

    fun sha256(bytes: ByteArray): String = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes))

    fun sha256(text: String): String = sha256(text.toByteArray(Charsets.UTF_8))
}


data class GoldEvidence(val page: Int, val blockId: String, val box: Box, val sourceTextSha256: String)


data class GoldMeasurement(
    val fieldId: String,
    val label: String,
    val value: String,
    val unit: String,
    val observedAt: String,
    val evidence: GoldEvidence,
    val semanticRole: String = "measurement",
    /** The rendered 참고치 text the parser must carry verbatim; null when the variant prints none. Never a clinical range. */
    val expectedReferenceRangeText: String? = null,
)


data class GoldAbstention(val fieldId: String, val label: String, val acceptedReasons: List<String>)


data class GoldDocument(
    val documentId: String,
    val documentSha256: String,
    val documentType: String,
    val expectedMeasurements: List<GoldMeasurement>,
    val requiredAbstentions: List<GoldAbstention>,
    val language: String = "ko-KR",
    val synthetic: Boolean = true,
)


data class Corpus(
    val documents: List<GoldDocument>,
    val corpusId: String,
    val schemaVersion: String = "medical-document-corpus.v1",
    val description: String = "합성 한국 검진 결과지 4 레이아웃 × 6 변형 + 생년월일 선행 1종 (25종, 1종은 텍스트 레이어 없는 스캔, 1종은 무날짜). PDFBox 텍스트 레이어 파서 채점용. 실제 데이터 없음.",
    val syntheticOnly: Boolean = true,
)


/** Writes `<documentId>.pdf` files and `corpus.json` (medical-document-corpus.v1). The rendered 참고치 text is written as expectedReferenceRangeText (corpus text, never a clinical range). */
object CorpusWriter {
    const val CORPUS_ID_PREFIX = "synthetic-ko-checkup-r2-"

    /** sha256 over `"<documentId> <sha256(pdf bytes)>"` lines in corpus order. Recomputed by the TypeScript scripts. */
    fun pdfDigest(documents: List<GeneratedDocument>): String =
        BenchmarkJson.sha256(documents.joinToString("\n") { "${it.documentId} ${BenchmarkJson.sha256(it.bytes)}" })

    fun corpusId(documents: List<GeneratedDocument>): String = CORPUS_ID_PREFIX + pdfDigest(documents).take(16)

    fun write(documents: List<GeneratedDocument>, out: Path): Corpus {
        Files.createDirectories(out)
        val corpus = Corpus(
            documents = documents.map { generated ->
                Files.write(out.resolve("${generated.documentId}.pdf"), generated.bytes)
                gold(generated)
            },
            corpusId = corpusId(documents),
        )
        BenchmarkJson.mapper.writerWithDefaultPrettyPrinter().writeValue(out.resolve("corpus.json").toFile(), corpus)
        return corpus
    }

    fun gold(generated: GeneratedDocument): GoldDocument {
        val observedOn = generated.observedOn
        val measurements = if (observedOn == null) {
            emptyList()
        } else {
            generated.rows.mapIndexed { index, row ->
                GoldMeasurement(
                    fieldId = row.spec.conceptCode,
                    label = row.label,
                    value = row.value,
                    unit = row.unit,
                    observedAt = observedOn,
                    evidence = GoldEvidence(
                        page = row.page,
                        blockId = String.format(Locale.ROOT, "block-row-%02d", index + 1),
                        box = row.box,
                        sourceTextSha256 = "sha256:" + BenchmarkJson.sha256(row.text),
                    ),
                    expectedReferenceRangeText = row.referenceRangeText,
                )
            }
        }
        val abstentions = buildList {
            if (generated.imageOnly) add(GoldAbstention("document", "문서 전체", listOf("unreadable")))
            if (observedOn == null) {
                generated.rows.forEach { add(GoldAbstention(it.spec.conceptCode, it.label, listOf("missing_evidence"))) }
            }
            generated.ambiguousLabel?.let { add(GoldAbstention("ldl-cholesterol", it, listOf("ambiguous_value"))) }
        }
        return GoldDocument(
            documentId = generated.documentId,
            documentSha256 = "sha256:" + BenchmarkJson.sha256(generated.bytes),
            documentType = generated.layout.documentType,
            expectedMeasurements = measurements,
            requiredAbstentions = abstentions,
        )
    }
}
