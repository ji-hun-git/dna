package kr.co.genomecompanion.foundation

import com.fasterxml.jackson.core.JsonFactory
import com.fasterxml.jackson.core.StreamReadConstraints
import com.fasterxml.jackson.core.exc.StreamConstraintsException
import com.fasterxml.jackson.databind.ObjectMapper
import javax.xml.datatype.Duration
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test

class JacksonNumberConstraintTest {
    @Test
    fun xmlDurationStringsRespectTheNumberLengthLimit() {
        val factory = JsonFactory.builder()
            .streamReadConstraints(StreamReadConstraints.builder().maxNumberLength(20).build())
            .build()
        val mapper = ObjectMapper(factory)

        assertThat(mapper.readValue("\"P1Y\"", Duration::class.java).years).isEqualTo(1)
        // A small fixture exercises CVE-2026-68497 without an expensive numeric parse.
        val oversizedDuration = "\"P" + "9".repeat(30) + "Y\""
        assertThatThrownBy { mapper.readValue(oversizedDuration, Duration::class.java) }
            .isInstanceOf(StreamConstraintsException::class.java)
    }
}
