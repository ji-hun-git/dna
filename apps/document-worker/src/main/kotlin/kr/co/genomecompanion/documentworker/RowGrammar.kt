package kr.co.genomecompanion.documentworker

import kr.co.genomecompanion.documentboundary.MedicalUnitSpelling
import kr.co.genomecompanion.documentworker.NativeTextExtractionProvider.RowParse

/**
 * Row grammar of the text-layer parser: zero or more [RowParse] per printed row. Every row that
 * shows a label and a numeric-looking token yields a Measurement or an Ambiguous with a reason;
 * only rows with no label before the first number are Skipped. Labels stay raw (core normalizes).
 * Nothing here interprets a value.
 */
object RowGrammar {
    private const val MAX_REFERENCE_RANGE = 40
    private const val MAX_LABEL = 80
    internal val valueToken = Regex("^-?(\\d{1,3}(,\\d{3})+|\\d+)(\\.\\d+)?$")
    private val qualifiedToken = Regex("^[<>≤≥]\\s*-?(\\d{1,3}(,\\d{3})+|\\d+)(\\.\\d+)?$")
    private val comparisonSign = Regex("^[<>≤≥]$")
    private val pressurePair = Regex("^(\\d{2,3})/(\\d{2,3})$")
    /** Any digit-slash-digit token, e.g. `3/4`: broader than [pressurePair] so a non-pressure fraction is still detected as numeric-like (and thus abstains rather than being skipped) instead of silently falling through with no numeric token found. */
    private val fractionLike = Regex("^\\d+/\\d+$")
    private val pressureRangePair = Regex("^(\\d{2,3}-\\d{2,3})/(\\d{2,3}-\\d{2,3})$")
    private val qualitativeWords = setOf("음성", "양성", "정상", "이상", "negative", "positive")
    private val separators = Regex("[:：\\t]")
    private val leadingBullets = Regex("^[·•\\-*]+\\s*")
    /** A number followed directly by a unit spelling: `5.6%`, `188mg/dL`, `6,200/µL`. Never `120-199`, never `2026년`. */
    private val gluedUnit = Regex("^(-?(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?)([%/A-Za-zµ][^\\s]*)$")
    private val rangeText = Regex(
        "^\\(?\\s*(?:참고치?|기준치?|정상\\s*범위|reference|ref\\.?)?\\s*[:：]?\\s*[<>≤≥]?\\s*" +
            "\\d[\\d,]*(?:\\.\\d+)?(?:\\s*[-–~]\\s*\\d[\\d,]*(?:\\.\\d+)?)?\\s*[^\\s()]*\\s*\\)?$",
    )
    private val rangeBody = Regex("[<>≤≥]?\\s*\\d[\\d,]*(?:\\.\\d+)?(?:\\s*[-–~]\\s*\\d[\\d,]*(?:\\.\\d+)?)?")
    private val rangeBoundaryMarker = Regex("[<>≤≥]|\\d\\s*[-–~]\\s*\\d")

    fun tokenize(text: String): List<String> =
        text.replace(separators, " ").trim().replace(leadingBullets, "").trim()
            .split(Regex("\\s+")).filter { it.isNotEmpty() }
            .flatMap { token ->
                val glued = gluedUnit.matchEntire(token)
                if (glued != null && MedicalUnitSpelling.canonical(glued.groupValues[2]) != null) {
                    listOf(glued.groupValues[1], glued.groupValues[2])
                } else {
                    listOf(token)
                }
            }

    internal fun parse(raw: String): List<RowParse> {
        val tokens = tokenize(raw)
        val numericIndex = tokens.indexOfFirst { isNumericLike(it) }
        if (numericIndex < 0) return qualitativeOrSkipped(tokens)
        if (numericIndex == 0) return valueFirst(tokens)
        val label = tokens.subList(0, numericIndex).joinToString(" ")
        val value = tokens[numericIndex]
        val unitToken = tokens.getOrNull(numericIndex + 1)
        val signed = qualifiedToken.matches(value) ||
            (comparisonSign.matches(value) && unitToken != null && valueToken.matches(unitToken))
        if (signed) {
            val printed = tokens.drop(numericIndex).joinToString(" ")
            return listOf(RowParse.Ambiguous("$label ($printed)".take(MAX_LABEL), AbstentionReason.QUALIFIED_VALUE))
        }
        pressurePair.matchEntire(value)?.let { pair ->
            if (unitToken != null && MedicalUnitSpelling.canonical(unitToken) == "mmHg") {
                val ranges = tokens.drop(numericIndex + 2).singleOrNull()?.let { pressureRangePair.matchEntire(it) }
                return listOf(
                    RowParse.Measurement("$label(수축기)", pair.groupValues[1], unitToken, ranges?.groupValues?.get(1)),
                    RowParse.Measurement("$label(이완기)", pair.groupValues[2], unitToken, ranges?.groupValues?.get(2)),
                )
            }
            return listOf(RowParse.Ambiguous(label, AbstentionReason.AMBIGUOUS_VALUE))
        }
        if (!valueToken.matches(value)) return listOf(RowParse.Ambiguous(label, AbstentionReason.AMBIGUOUS_VALUE))
        val unit = when {
            unitToken == null -> return listOf(RowParse.Ambiguous(label, AbstentionReason.AMBIGUOUS_UNIT))
            MedicalUnitSpelling.canonical(unitToken) != null -> unitToken
            valueToken.matches(unitToken) -> return listOf(RowParse.Ambiguous(label, AbstentionReason.AMBIGUOUS_VALUE))
            else -> return listOf(RowParse.Ambiguous(label, AbstentionReason.AMBIGUOUS_UNIT))
        }
        return listOf(finish(label, value, unit, tokens.drop(numericIndex + 2)))
    }

    /** `120 mg/dL 혈당`: number, unit, then the label up to the next range or number. */
    private fun valueFirst(tokens: List<String>): List<RowParse> {
        val value = tokens[0]
        if (!valueToken.matches(value)) return listOf(RowParse.Skipped)
        val unit = tokens.getOrNull(1)?.takeIf { MedicalUnitSpelling.canonical(it) != null } ?: return listOf(RowParse.Skipped)
        val rest = tokens.drop(2)
        val labelEnd = rest.indexOfFirst { rangeText.matches(it) || isNumericLike(it) }.let { if (it < 0) rest.size else it }
        val label = rest.take(labelEnd).joinToString(" ")
        if (label.isEmpty()) return listOf(RowParse.Skipped)
        return listOf(finish(label, value, unit, rest.drop(labelEnd)))
    }

    private fun isNumericLike(token: String): Boolean =
        valueToken.matches(token) || qualifiedToken.matches(token) || pressurePair.matches(token) ||
            fractionLike.matches(token) || comparisonSign.matches(token)

    private fun qualitativeOrSkipped(tokens: List<String>): List<RowParse> {
        val index = tokens.indexOfFirst { it.trim('(', ')') in qualitativeWords }
        if (index < 1) return listOf(RowParse.Skipped)
        return listOf(RowParse.Ambiguous(tokens.subList(0, index).joinToString(" ").take(MAX_LABEL), AbstentionReason.QUALITATIVE))
    }

    /** Tail rule (unchanged from Wave 3, plus Task 1's second-measurement guard): leftovers are one/two range bodies or a second value (ambiguous). */
    private fun finish(label: String, value: String, unit: String, rest: List<String>): RowParse {
        val restText = rest.joinToString(" ")
        val restIsRange = rest.isNotEmpty() && rangeText.matches(restText)
        // A genuine range boundary (comparison sign, or two numbers joined by a dash/tilde) means a
        // repeated trailing unit word ("15 - 35 U/L") is not a second result.
        val restHasRangeBoundary = rangeBoundaryMarker.containsMatchIn(restText)
        // A second full "value unit" pair in the rest (e.g. "100 mg/dL") is a second result printed on
        // the same row, not a reference range, checked ahead of range classification since the
        // permissive rangeText pattern would otherwise silently absorb it.
        val restHasSecondMeasurement = !restHasRangeBoundary && rest.zipWithNext()
            .any { (candidateValue, candidateUnit) -> valueToken.matches(candidateValue) && MedicalUnitSpelling.canonical(candidateUnit) != null }
        if (rest.isNotEmpty() && (restHasSecondMeasurement || (!restIsRange && rest.any { valueToken.matches(it) }))) {
            return RowParse.Ambiguous(label, AbstentionReason.AMBIGUOUS_VALUE)
        }
        val bodies = if (restIsRange) rangeBody.findAll(restText).map { it.value.trim() }.toList() else emptyList()
        val twoRanges = bodies.size == 2 &&
            bodies.all { rangeBoundaryMarker.containsMatchIn(it) } &&
            bodies.fold(restText) { remaining, body -> remaining.replaceFirst(body, "") }.isBlank()
        val rangeBodyMatch = if (twoRanges) bodies.joinToString(" ") else bodies.firstOrNull()
        val referenceRangeText = rangeBodyMatch?.takeIf { it.length <= MAX_REFERENCE_RANGE && rangeBoundaryMarker.containsMatchIn(it) }
        return RowParse.Measurement(label, value, unit, referenceRangeText)
    }
}
