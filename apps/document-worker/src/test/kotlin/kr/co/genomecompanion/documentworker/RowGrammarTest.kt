package kr.co.genomecompanion.documentworker

import kr.co.genomecompanion.documentworker.NativeTextExtractionProvider.RowParse
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test


class RowGrammarTest {
    @Test
    fun `splits a unit glued to its number`() {
        assertThat(RowGrammar.tokenize("HbA1c 5.6%")).containsExactly("HbA1c", "5.6", "%")
        assertThat(RowGrammar.tokenize("혈당 188mg/dL")).containsExactly("혈당", "188", "mg/dL")
        assertThat(RowGrammar.tokenize("백혈구 6,200/µL")).containsExactly("백혈구", "6,200", "/µL")
        assertThat(RowGrammar.tokenize("120-199")).containsExactly("120-199")
        assertThat(RowGrammar.tokenize("2026년")).containsExactly("2026년")
    }

    @Test
    fun `reads a value printed before its label`() {
        assertThat(RowGrammar.parse("120 mg/dL 혈당"))
            .containsExactly(RowParse.Measurement("혈당", "120", "mg/dL", null))
        assertThat(RowGrammar.parse("5.4 % 당화혈색소 (4.0-6.0)"))
            .containsExactly(RowParse.Measurement("당화혈색소", "5.4", "%", "4.0-6.0"))
    }

    @Test
    fun `abstains qualified_value for a comparison-signed number and keeps the printed text in the label`() {
        assertThat(RowGrammar.parse("hs-CRP <0.3 mg/L"))
            .containsExactly(RowParse.Ambiguous("hs-CRP (<0.3 mg/L)", AbstentionReason.QUALIFIED_VALUE))
        assertThat(RowGrammar.parse("eGFR ≥60 mL/min/1.73m²"))
            .containsExactly(RowParse.Ambiguous("eGFR (≥60 mL/min/1.73m²)", AbstentionReason.QUALIFIED_VALUE))
        assertThat(RowGrammar.parse("CRP < 0.5 mg/dL"))
            .containsExactly(RowParse.Ambiguous("CRP (< 0.5 mg/dL)", AbstentionReason.QUALIFIED_VALUE))
    }

    @Test
    fun `abstains qualitative for a judgement word and stores no value`() {
        for (word in listOf("음성", "양성", "정상", "이상")) {
            assertThat(RowGrammar.parse("요단백 $word")).containsExactly(RowParse.Ambiguous("요단백", AbstentionReason.QUALITATIVE))
        }
        assertThat(RowGrammar.parse("B형간염 표면항원 음성 (음성)"))
            .containsExactly(RowParse.Ambiguous("B형간염 표면항원", AbstentionReason.QUALITATIVE))
    }

    @Test
    fun `splits blood pressure into a systolic and a diastolic candidate`() {
        assertThat(RowGrammar.parse("혈압 120/80 mmHg")).containsExactly(
            RowParse.Measurement("혈압(수축기)", "120", "mmHg", null),
            RowParse.Measurement("혈압(이완기)", "80", "mmHg", null),
        )
        assertThat(RowGrammar.parse("Blood Pressure 118/76 mmHg 90-120/60-80")).containsExactly(
            RowParse.Measurement("Blood Pressure(수축기)", "118", "mmHg", "90-120"),
            RowParse.Measurement("Blood Pressure(이완기)", "76", "mmHg", "60-80"),
        )
        assertThat(RowGrammar.parse("비율 3/4 %")).containsExactly(RowParse.Ambiguous("비율", AbstentionReason.AMBIGUOUS_VALUE))
    }

    @Test
    fun `plain rows still parse exactly as before`() {
        assertThat(RowGrammar.parse("Cholesterol: 188 mg/dL 120-199"))
            .containsExactly(RowParse.Measurement("Cholesterol", "188", "mg/dL", "120-199"))
        assertThat(RowGrammar.parse("· 혈색소 14.1 g/dL (참고 12.0-16.0)"))
            .containsExactly(RowParse.Measurement("혈색소", "14.1", "g/dL", "12.0-16.0"))
        assertThat(RowGrammar.parse("페이지 2쪽")).containsExactly(RowParse.Skipped)
    }
}
