package kr.co.genomecompanion.documentworker

import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatIllegalArgumentException
import org.junit.jupiter.api.Test
import java.io.ByteArrayOutputStream
import java.io.PrintStream

class WorkerLogTest {
    @Test
    fun `emits only the event code, job id and failure code`() {
        val out = ByteArrayOutputStream()
        val original = System.out
        System.setOut(PrintStream(out, true, Charsets.UTF_8))
        try {
            WorkerLog.emit("job_failed", "6f2b7f3e-9c7b-4d3a-9b0e-1a2b3c4d5e6f", "render_error")
            WorkerLog.emit("lease_empty", null)
        } finally {
            System.setOut(original)
        }
        assertThat(out.toString(Charsets.UTF_8).lines().filter { it.isNotBlank() }).containsExactly(
            "event=job_failed job_id=6f2b7f3e-9c7b-4d3a-9b0e-1a2b3c4d5e6f code=render_error",
            "event=lease_empty job_id=none code=none",
        )
    }

    /** The point of the object: anything that is not an event code or a failure code cannot be said. */
    @Test
    fun `rejects an event or code carrying document content`() {
        assertThatIllegalArgumentException().isThrownBy {
            WorkerLog.emit("결과지 Cholesterol 188 mg/dL", null)
        }
        assertThatIllegalArgumentException().isThrownBy {
            WorkerLog.emit("job_failed", null, "julyResults.pdf")
        }
        assertThatIllegalArgumentException().isThrownBy {
            WorkerLog.emit("job_failed", null, "Cholesterol 188")
        }
    }
}
