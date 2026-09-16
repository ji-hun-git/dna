package kr.co.genomecompanion.benchmark

import kr.co.genomecompanion.documentboundary.MedicalConceptCatalogue
import org.apache.pdfbox.pdmodel.PDDocument
import org.apache.pdfbox.pdmodel.PDDocumentInformation
import org.apache.pdfbox.pdmodel.PDPage
import org.apache.pdfbox.pdmodel.PDPageContentStream
import org.apache.pdfbox.pdmodel.common.PDRectangle
import org.apache.pdfbox.pdmodel.font.PDFont
import org.apache.pdfbox.pdmodel.font.PDType0Font
import org.apache.pdfbox.pdmodel.graphics.image.LosslessFactory
import java.awt.Color
import java.awt.image.BufferedImage
import java.io.ByteArrayOutputStream
import java.nio.file.Path
import java.util.Calendar
import java.util.GregorianCalendar
import java.util.Locale
import java.util.TimeZone
import kotlin.math.roundToLong
import kotlin.random.Random


enum class Layout(val id: String, val documentType: String) {
    NHIS_TABLE("nhis-table", "health-screening-lab-report"),
    HOSPITAL_TWO_COLUMN("hospital-two-column", "public-health-lab-report"),
    CENTER_SUMMARY("center-summary", "health-screening-lab-report"),
    TWO_PAGE("two-page", "health-screening-lab-report"),
}


enum class DateStyle { ISO, DOTTED, KOREAN }


data class Variant(
    val index: Int,
    val englishLabels: Boolean,
    val lowercaseUnits: Boolean,
    val extraDecimal: Boolean,
    val dateStyle: DateStyle,
    val rangeColumn: Boolean,
    val rangeSeparator: String,
    val thousandsComma: Boolean,
    /** Print a 생년월일 line first and the labelled 검사일 later, mid-line (first-date mistakes are scored). */
    val birthDateFirst: Boolean = false,
)


/**
 * One printable row of the synthetic corpus. `spanLow..spanHigh` is only the span the generator
 * draws values from and prints as the 참고치 column so the parser has text to ignore. It is corpus
 * text, never a clinical reference range, and core never receives it.
 */
data class RowSpec(
    val conceptCode: String,
    val englishLabel: String,
    val unit: String,
    val lowercaseUnit: String,
    val spanLow: Double,
    val spanHigh: Double,
    val decimals: Int,
    val countLike: Boolean = false,
    val koreanLabelOverride: String? = null,
) {
    val koreanLabel: String
        get() = koreanLabelOverride ?: checkNotNull(MedicalConceptCatalogue.byCode(conceptCode)) { conceptCode }.displayKo
}


data class Box(val x: Double, val y: Double, val width: Double, val height: Double)


data class PlacedRow(
    val spec: RowSpec,
    val label: String,
    val value: String,
    val unit: String,
    val page: Int,
    val text: String,
    val box: Box,
)


class GeneratedDocument(
    val documentId: String,
    val layout: Layout,
    val variant: Variant,
    val bytes: ByteArray,
    val observedOn: String?,
    val rows: List<PlacedRow>,
    val ambiguousLabel: String?,
    val imageOnly: Boolean,
)


class CheckupCorpusGenerator(private val fontFile: Path) {
    fun generateAll(): List<GeneratedDocument> =
        Layout.entries.flatMap { layout -> VARIANTS.map { variant -> generate(layout, variant) } } +
            generate(Layout.HOSPITAL_TWO_COLUMN, BIRTH_DATE_VARIANT)

    fun generate(layout: Layout, variant: Variant): GeneratedDocument {
        val documentId = "synthetic-${layout.id}-v${variant.index}"
        if (layout == Layout.NHIS_TABLE && variant.index == 5) return imageOnly(documentId, layout, variant)
        val random = Random(layout.ordinal * 100 + variant.index)
        val omitDate = layout == Layout.HOSPITAL_TWO_COLUMN && variant.index == 4
        val isoDate = DATES[variant.index]
        pinnedDocument().use { document ->
            val font = PDType0Font.load(document, fontFile.toFile())
            val rows = mutableListOf<PlacedRow>()
            var ambiguousLabel: String? = null
            when (layout) {
                Layout.NHIS_TABLE -> Canvas(document, font, 1).use { canvas ->
                    canvas.line(listOf(56f to "국가건강검진 결과통보서 (합성 예시)"), 14f)
                    canvas.line(listOf(56f to "수검자 합성-${variant.index}"))
                    if (!omitDate) canvas.line(listOf(56f to dateLine(isoDate, variant.dateStyle)))
                    canvas.skip()
                    tableHeader(canvas, variant)
                    NHIS_ROWS.forEach { rows += tableRow(canvas, it, variant, random) }
                }
                Layout.HOSPITAL_TWO_COLUMN -> Canvas(document, font, 1).use { canvas ->
                    canvas.line(listOf(56f to "혈액검사 결과 (합성 예시)"), 14f)
                    when {
                        variant.birthDateFirst -> {
                            canvas.line(listOf(56f to "생년월일: $BIRTH_DATE"))
                            canvas.line(listOf(56f to "수검자 합성-${variant.index}", 320f to dateLine(isoDate, variant.dateStyle)))
                        }
                        !omitDate -> canvas.line(listOf(56f to dateLine(isoDate, variant.dateStyle)))
                    }
                    canvas.skip()
                    canvas.line(listOf(56f to "검사항목", 320f to "결과"))
                    canvas.rule()
                    HOSPITAL_ROWS.forEach { rows += twoColumnRow(canvas, it, variant, random) }
                }
                Layout.CENTER_SUMMARY -> Canvas(document, font, 1).use { canvas ->
                    canvas.line(listOf(56f to "검진센터 요약 (합성 예시)"), 14f)
                    if (!omitDate) canvas.line(listOf(56f to dateLine(isoDate, variant.dateStyle)))
                    canvas.skip()
                    CENTER_ROWS.forEach { rows += summaryRow(canvas, it, variant, random) }
                    if (variant.index == 3) {
                        val label = if (variant.englishLabels) "LDL Cholesterol" else "LDL 콜레스테롤"
                        canvas.line(listOf(56f to "· $label 110 115 mg/dL"))
                        ambiguousLabel = label
                    }
                }
                Layout.TWO_PAGE -> {
                    Canvas(document, font, 1).use { cover ->
                        cover.line(listOf(56f to "검진 결과지 (합성 예시)"), 14f)
                        if (!omitDate) cover.line(listOf(56f to dateLine(isoDate, variant.dateStyle)))
                        cover.line(listOf(56f to "검사 항목은 다음 쪽에 있어요"))
                    }
                    Canvas(document, font, 2).use { canvas ->
                        tableHeader(canvas, variant)
                        TWO_PAGE_ROWS.forEach { rows += tableRow(canvas, it, variant, random) }
                    }
                }
            }
            val bytes = ByteArrayOutputStream().also { document.save(it) }.toByteArray()
            return GeneratedDocument(
                documentId = documentId,
                layout = layout,
                variant = variant,
                bytes = bytes,
                observedOn = if (omitDate) null else isoDate,
                rows = rows.toList(),
                ambiguousLabel = ambiguousLabel,
                imageOnly = false,
            )
        }
    }

    /**
     * PDFBox otherwise derives the trailer /ID from the wall clock and stamps creation time, so the
     * same seed would give different bytes. No XMP metadata stream is written at all.
     */
    private fun pinnedDocument(): PDDocument = PDDocument().apply {
        documentId = FIXED_DOCUMENT_ID
        documentInformation = PDDocumentInformation().apply {
            producer = "korean-checkup-benchmark"
            creationDate = fixedTimestamp()
            modificationDate = fixedTimestamp()
        }
    }

    private fun tableHeader(canvas: Canvas, variant: Variant) {
        val columns = mutableListOf(56f to "항목", 300f to "결과", 380f to "단위")
        if (variant.rangeColumn) columns += 470f to "참고치"
        canvas.line(columns)
        canvas.rule()
    }

    private fun tableRow(canvas: Canvas, spec: RowSpec, variant: Variant, random: Random): PlacedRow {
        val label = label(spec, variant)
        val value = formatValue(spec, variant, random)
        val unit = unit(spec, variant)
        val columns = mutableListOf(56f to label, 300f to value, 380f to unit)
        if (variant.rangeColumn) columns += 470f to rangeText(spec, variant)
        val box = canvas.line(columns)
        return PlacedRow(spec, label, value, unit, canvas.pageNumber, columns.joinToString(" ") { it.second }, box)
    }

    private fun twoColumnRow(canvas: Canvas, spec: RowSpec, variant: Variant, random: Random): PlacedRow {
        val label = label(spec, variant)
        val value = formatValue(spec, variant, random)
        val unit = unit(spec, variant)
        val result = if (variant.rangeColumn) "$value $unit (${rangeText(spec, variant)})" else "$value $unit"
        val box = canvas.line(listOf(56f to label, 320f to result))
        return PlacedRow(spec, label, value, unit, canvas.pageNumber, "$label $result", box)
    }

    private fun summaryRow(canvas: Canvas, spec: RowSpec, variant: Variant, random: Random): PlacedRow {
        val label = label(spec, variant)
        val value = formatValue(spec, variant, random)
        val unit = unit(spec, variant)
        val text = buildString {
            append("· ").append(label).append(' ').append(value).append(' ').append(unit)
            if (variant.rangeColumn) append(" (참고 ").append(rangeText(spec, variant)).append(')')
        }
        val box = canvas.line(listOf(56f to text))
        return PlacedRow(spec, label, value, unit, canvas.pageNumber, text, box)
    }

    private fun label(spec: RowSpec, variant: Variant) = if (variant.englishLabels) spec.englishLabel else spec.koreanLabel

    private fun unit(spec: RowSpec, variant: Variant) = if (variant.lowercaseUnits) spec.lowercaseUnit else spec.unit

    private fun formatValue(spec: RowSpec, variant: Variant, random: Random): String {
        val raw = spec.spanLow + random.nextDouble() * (spec.spanHigh - spec.spanLow)
        if (spec.countLike) {
            val rounded = (raw / 100.0).roundToLong() * 100L
            return if (variant.thousandsComma) String.format(Locale.ROOT, "%,d", rounded) else rounded.toString()
        }
        val decimals = spec.decimals + if (variant.extraDecimal) 1 else 0
        return String.format(Locale.ROOT, "%.${decimals}f", raw)
    }

    private fun rangeText(spec: RowSpec, variant: Variant): String {
        val format = "%.${spec.decimals}f"
        return String.format(Locale.ROOT, format, spec.spanLow) + variant.rangeSeparator + String.format(Locale.ROOT, format, spec.spanHigh)
    }

    private fun dateLine(isoDate: String, style: DateStyle): String {
        val (year, month, day) = isoDate.split("-").map { it.toInt() }
        return when (style) {
            DateStyle.ISO -> "검사일: $isoDate"
            DateStyle.DOTTED -> "Date: " + isoDate.replace('-', '.')
            DateStyle.KOREAN -> "검진일 ${year}년 ${month}월 ${day}일"
        }
    }

    /** A page that is only a picture: what a phone scan looks like. The parser must abstain, not guess. */
    private fun imageOnly(documentId: String, layout: Layout, variant: Variant): GeneratedDocument =
        pinnedDocument().use { document ->
            val page = PDPage(PDRectangle.A4)
            document.addPage(page)
            val image = BufferedImage(1240, 1754, BufferedImage.TYPE_INT_RGB)
            val graphics = image.createGraphics()
            graphics.color = Color.WHITE
            graphics.fillRect(0, 0, image.width, image.height)
            graphics.color = Color.DARK_GRAY
            graphics.drawString("SYNTHETIC SCAN - NO TEXT LAYER", 120, 160)
            repeat(8) { row -> graphics.drawRect(120, 260 + row * 90, 1000, 60) }
            graphics.dispose()
            PDPageContentStream(document, page).use { stream ->
                stream.drawImage(LosslessFactory.createFromImage(document, image), 0f, 0f, page.mediaBox.width, page.mediaBox.height)
            }
            val bytes = ByteArrayOutputStream().also { document.save(it) }.toByteArray()
            GeneratedDocument(documentId, layout, variant, bytes, null, emptyList(), null, true)
        }

    /** One A4 page: draws columns on a shared baseline and reports the merged box the way the stripper measures it. */
    private class Canvas(document: PDDocument, private val font: PDFont, val pageNumber: Int) : AutoCloseable {
        private val page = PDPage(PDRectangle.A4).also { document.addPage(it) }
        private val stream = PDPageContentStream(document, page)
        private val width = page.mediaBox.width
        private val height = page.mediaBox.height
        private var cursor = height - 64f
        private val glyphHeight: Float = font.fontDescriptor.let { descriptor ->
            val capHeight = descriptor.capHeight
            val ascent = descriptor.ascent
            (if (ascent > 0f && ascent < capHeight) ascent else capHeight) / 1000f
        }

        fun line(columns: List<Pair<Float, String>>, size: Float = 11f): Box {
            val baseline = cursor
            columns.forEach { (x, text) ->
                stream.beginText()
                stream.setFont(font, size)
                stream.newLineAtOffset(x, baseline)
                stream.showText(text)
                stream.endText()
            }
            val left = columns.first().first
            val right = columns.maxOf { (x, text) -> x + font.getStringWidth(text) / 1000f * size }
            val top = height - baseline - glyphHeight * size
            cursor -= 22f
            return Box(
                x = (left / width).toDouble(),
                y = (top / height).toDouble(),
                width = ((right - left) / width).toDouble(),
                height = (glyphHeight * size / height).toDouble(),
            )
        }

        fun rule() {
            stream.setStrokingColor(Color.GRAY)
            stream.moveTo(56f, cursor + 6f)
            stream.lineTo(width - 56f, cursor + 6f)
            stream.stroke()
        }

        fun skip(points: Float = 12f) {
            cursor -= points
        }

        override fun close() = stream.close()
    }

    companion object {
        const val FIXED_DOCUMENT_ID = 20260917L

        fun fixedTimestamp(): Calendar = GregorianCalendar(TimeZone.getTimeZone("UTC")).apply {
            clear()
            set(2026, Calendar.SEPTEMBER, 17, 0, 0, 0)
        }

        val DATES = listOf("2026-07-28", "2026-06-18", "2026-05-09", "2026-04-21", "2026-03-12", "2026-02-03", "2026-01-20")

        val VARIANTS = listOf(
            Variant(0, englishLabels = false, lowercaseUnits = false, extraDecimal = false, dateStyle = DateStyle.ISO, rangeColumn = false, rangeSeparator = "-", thousandsComma = false),
            Variant(1, englishLabels = true, lowercaseUnits = false, extraDecimal = false, dateStyle = DateStyle.DOTTED, rangeColumn = true, rangeSeparator = "-", thousandsComma = false),
            Variant(2, englishLabels = false, lowercaseUnits = true, extraDecimal = false, dateStyle = DateStyle.KOREAN, rangeColumn = true, rangeSeparator = "-", thousandsComma = false),
            Variant(3, englishLabels = true, lowercaseUnits = false, extraDecimal = true, dateStyle = DateStyle.ISO, rangeColumn = false, rangeSeparator = "-", thousandsComma = false),
            Variant(4, englishLabels = false, lowercaseUnits = false, extraDecimal = false, dateStyle = DateStyle.ISO, rangeColumn = true, rangeSeparator = "-", thousandsComma = true),
            Variant(5, englishLabels = false, lowercaseUnits = false, extraDecimal = false, dateStyle = DateStyle.DOTTED, rangeColumn = true, rangeSeparator = "~", thousandsComma = true),
        )

        const val BIRTH_DATE = "1987-03-14"

        val BIRTH_DATE_VARIANT = Variant(
            6, englishLabels = false, lowercaseUnits = false, extraDecimal = false, dateStyle = DateStyle.ISO,
            rangeColumn = true, rangeSeparator = "-", thousandsComma = false, birthDateFirst = true,
        )

        val NHIS_ROWS = listOf(
            RowSpec("total-cholesterol", "Total Cholesterol", "mg/dL", "mg/dl", 150.0, 199.0, 0),
            RowSpec("ldl-cholesterol", "LDL Cholesterol", "mg/dL", "mg/dl", 70.0, 129.0, 0),
            RowSpec("hdl-cholesterol", "HDL Cholesterol", "mg/dL", "mg/dl", 45.0, 70.0, 0),
            RowSpec("triglycerides", "Triglycerides", "mg/dL", "mg/dl", 60.0, 149.0, 0),
            RowSpec("fasting-glucose", "Fasting Glucose", "mg/dL", "mg/dl", 80.0, 99.0, 0),
            RowSpec("hba1c", "HbA1c", "%", "%", 4.8, 5.6, 1),
            RowSpec("hemoglobin", "Hemoglobin", "g/dL", "g/dl", 12.5, 15.5, 1),
            RowSpec("creatinine", "Creatinine", "mg/dL", "mg/dl", 0.6, 1.1, 2),
        )

        val HOSPITAL_ROWS = listOf(
            RowSpec("ast", "AST", "U/L", "u/l", 15.0, 35.0, 0),
            RowSpec("alt", "ALT", "U/L", "u/l", 10.0, 35.0, 0),
            RowSpec("gamma-gtp", "GGT", "U/L", "u/l", 12.0, 45.0, 0, koreanLabelOverride = "감마지티피"),
            RowSpec("alp", "ALP", "U/L", "u/l", 40.0, 110.0, 0),
            RowSpec("total-bilirubin", "Total Bilirubin", "mg/dL", "mg/dl", 0.3, 1.1, 1),
            RowSpec("albumin", "Albumin", "g/dL", "g/dl", 3.8, 5.0, 1),
            RowSpec("bun", "BUN", "mg/dL", "mg/dl", 8.0, 20.0, 0),
            RowSpec("uric-acid", "Uric Acid", "mg/dL", "mg/dl", 3.0, 6.5, 1),
        )

        val CENTER_ROWS = listOf(
            RowSpec("height", "Height", "cm", "cm", 155.0, 180.0, 1),
            RowSpec("weight", "Weight", "kg", "kg", 50.0, 80.0, 1),
            RowSpec("bmi", "BMI", "kg/m2", "kg/m2", 19.0, 24.5, 1),
            RowSpec("waist-circumference", "Waist", "cm", "cm", 70.0, 88.0, 0),
            RowSpec("systolic-blood-pressure", "Systolic", "mmHg", "mmhg", 105.0, 125.0, 0),
            RowSpec("diastolic-blood-pressure", "Diastolic", "mmHg", "mmhg", 65.0, 80.0, 0),
            RowSpec("pulse", "Pulse", "bpm", "bpm", 60.0, 85.0, 0),
            RowSpec("white-blood-cells", "WBC", "/uL", "/ul", 4500.0, 9500.0, 0, countLike = true),
        )

        val TWO_PAGE_ROWS = listOf(
            RowSpec("vitamin-d", "Vitamin D", "ng/mL", "ng/ml", 30.0, 60.0, 0),
            RowSpec("tsh", "TSH", "uIU/mL", "uiu/ml", 0.8, 3.5, 2),
            RowSpec("free-t4", "Free T4", "ng/dL", "ng/dl", 0.9, 1.6, 2),
            RowSpec("crp", "CRP", "mg/L", "mg/l", 0.1, 0.4, 2),
            RowSpec("ferritin", "Ferritin", "ng/mL", "ng/ml", 30.0, 150.0, 0),
            RowSpec("sodium", "Sodium", "mmol/L", "mmol/l", 137.0, 143.0, 0),
            RowSpec("potassium", "Potassium", "mmol/L", "mmol/l", 3.7, 4.8, 1),
            RowSpec("calcium", "Calcium", "mg/dL", "mg/dl", 8.8, 10.0, 1),
            RowSpec("total-protein", "Total Protein", "g/dL", "g/dl", 6.5, 8.0, 1),
        )
    }
}
