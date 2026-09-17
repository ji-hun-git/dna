package kr.co.genomecompanion.documentboundary

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.io.File

/**
 * Parses `docs/status/2026-09-17/loinc-audit.md` § "Final values" — the evidence file built from
 * names actually read on loinc.org — and asserts the catalogue's (conceptCode, loinc, loincExport)
 * triples equal it exactly, so the catalogue can never silently drift from the evidence.
 */
class MedicalConceptLoincAuditTest {
    private data class AuditRow(val conceptCode: String, val loincCode: String?, val loincExport: Boolean)

    private fun findAuditFile(): File {
        var dir = File(System.getProperty("user.dir")).absoluteFile
        repeat(8) {
            val candidate = File(dir, "docs/status/2026-09-17/loinc-audit.md")
            if (candidate.isFile) return candidate
            dir = dir.parentFile ?: return@repeat
        }
        error("could not locate docs/status/2026-09-17/loinc-audit.md by walking up from ${System.getProperty("user.dir")}")
    }

    private fun parseFinalValues(file: File): List<AuditRow> {
        val lines = file.readLines()
        val startIndex = lines.indexOfFirst { it.trim() == "## Final values" }
        require(startIndex >= 0) { "no '## Final values' heading in $file" }
        val rows = mutableListOf<AuditRow>()
        for (line in lines.drop(startIndex + 1)) {
            val trimmed = line.trim()
            if (trimmed.startsWith("##")) break
            if (!trimmed.startsWith("|")) continue
            val cells = trimmed.trim('|').split("|").map { it.trim() }
            if (cells.size != 3) continue
            val (code, loinc, export) = cells
            if (code == "concept_code" || code.matches(Regex("^-+$"))) continue
            rows += AuditRow(
                conceptCode = code,
                loincCode = if (loinc == "NULL") null else loinc,
                loincExport = export == "TRUE",
            )
        }
        return rows
    }

    @Test
    fun `catalogue triples equal the audit's Final values table`() {
        val auditRows = parseFinalValues(findAuditFile())
        assertThat(auditRows).isNotEmpty()

        val catalogueRows = MedicalConceptCatalogue.entries.map {
            AuditRow(it.conceptCode, it.loincCode, it.loincExport)
        }

        assertThat(catalogueRows.map { it.conceptCode })
            .describedAs("catalogue concept codes vs audit concept codes")
            .containsExactlyInAnyOrderElementsOf(auditRows.map { it.conceptCode })

        val auditByCode = auditRows.associateBy { it.conceptCode }
        catalogueRows.forEach { row ->
            val audited = auditByCode.getValue(row.conceptCode)
            assertThat(row).describedAs(row.conceptCode).isEqualTo(audited)
        }
    }
}
