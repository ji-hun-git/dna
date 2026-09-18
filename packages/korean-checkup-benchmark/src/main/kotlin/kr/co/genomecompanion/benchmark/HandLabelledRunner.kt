package kr.co.genomecompanion.benchmark

import java.nio.file.Files
import java.nio.file.Path
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

/**
 * Runs the worker's provider over the hand-labelled corpus written by [HandLabelledFixtures.writeAll].
 * Same `medical-document-run.v1` shape as [NativeTextRunner]; scored separately by `evaluateHandLabelled`,
 * never folded into the r2 corpus metrics.
 */
object HandLabelledRunner {
    fun run(corpusDir: Path, createdAt: OffsetDateTime = OffsetDateTime.now(ZoneOffset.UTC)): List<NativeTextRun> {
        val model = PinnedModel(NativeTextRunner.providerArtifactSha256())
        val stamp = createdAt.format(DateTimeFormatter.ISO_OFFSET_DATE_TIME)
        return HandLabelledFixtures.ids.map { id ->
            val bytes = Files.readAllBytes(corpusDir.resolve("$id.pdf"))
            NativeTextRunner.toRun(id, "health-screening-lab-report", bytes, stamp, model)
        }
    }
}
