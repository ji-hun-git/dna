package kr.co.genomecompanion.documentworker


/** Kotlin port of `buildSyntheticResultPdf` (apps/web/lib/foundation/synthetic-document.ts). Synthetic only. */
object SyntheticResultPdf {
    val july: ByteArray = build(
        listOf(
            "GC SYNTHETIC EXAMPLE - NO REAL HEALTH DATA", "Date: 2026-07-28",
            "Cholesterol: 188 mg/dL", "HbA1c: 5.2 %", "Vitamin D: 42 ng/mL",
        ),
    )
    val january: ByteArray = build(
        listOf(
            "GC SYNTHETIC EXAMPLE - NO REAL HEALTH DATA", "Date: 2026-01-15",
            "Cholesterol: 194 mg/dL", "HbA1c: 5.4 %", "Vitamin D: 45 ng/mL",
        ),
    )

    fun build(lines: List<String>): ByteArray {
        val content = "BT /F1 16 Tf 48 740 Td 28 TL " +
            lines.mapIndexed { index, line -> (if (index > 0) "T* " else "") + "($line) Tj" }.joinToString("\n") +
            " ET"
        val objects = listOf(
            "<< /Type /Catalog /Pages 2 0 R >>",
            "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
            "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
            "<< /Length ${content.length} >>\nstream\n$content\nendstream",
        )
        val pdf = StringBuilder("%PDF-1.7\n%GC-SYNTHETIC-ONLY\n")
        val offsets = mutableListOf<Int>()
        objects.forEachIndexed { index, obj ->
            offsets += pdf.length
            pdf.append("${index + 1} 0 obj\n$obj\nendobj\n")
        }
        val xref = pdf.length
        pdf.append("xref\n0 ${objects.size + 1}\n0000000000 65535 f \n")
        offsets.forEach { pdf.append("${it.toString().padStart(10, '0')} 00000 n \n") }
        pdf.append("trailer\n<< /Size ${objects.size + 1} /Root 1 0 R >>\nstartxref\n$xref\n%%EOF\n")
        return pdf.toString().toByteArray(Charsets.UTF_8)
    }
}
