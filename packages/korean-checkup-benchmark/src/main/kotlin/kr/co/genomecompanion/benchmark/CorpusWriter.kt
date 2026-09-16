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
    val schemaVersion: String = "medical-document-corpus.v1",
    val corpusId: String = "synthetic-ko-checkup-r1",
    val description: String = "합성 한국 검진 결과지 4 레이아웃 × 6 변형 (24종, 1종은 텍스트 레이어 없는 스캔). PDFBox 텍스트 레이어 파서 채점용. 실제 데이터 없음.",
    val syntheticOnly: Boolean = true,
)


/** Writes `<documentId>.pdf` files and `corpus.json` (medical-document-corpus.v1). No reference range is written. */
object CorpusWriter {
    fun write(documents: List<GeneratedDocument>, out: Path): Corpus {
        Files.createDirectories(out)
        val corpus = Corpus(
            documents = documents.map { generated ->
                Files.write(out.resolve("${generated.documentId}.pdf"), generated.bytes)
                gold(generated)
            },
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
