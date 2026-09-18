package kr.co.genomecompanion.documentworker

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Files
import java.nio.file.Path


/**
 * `sha256Database` is the fallback signature version reported to core when `clamscan --version`
 * prints no signature suffix. It has to be a function of the signature *contents* only: two workers
 * running the same image must report the same string, whatever order their filesystems list the
 * directory in.
 */
class SignatureDigestTest {
    @Test
    fun `a signature directory digests the same whatever order its files were written in`(@TempDir root: Path) {
        val forwards = Files.createDirectory(root.resolve("forwards"))
        Files.writeString(forwards.resolve("main.cvd"), "synthetic-main-signatures")
        Files.writeString(forwards.resolve("daily.cld"), "synthetic-daily-signatures")

        val backwards = Files.createDirectory(root.resolve("backwards"))
        Files.writeString(backwards.resolve("daily.cld"), "synthetic-daily-signatures")
        Files.writeString(backwards.resolve("main.cvd"), "synthetic-main-signatures")

        val digest = sha256Database(forwards)
        assertThat(digest).matches("^[0-9a-f]{64}$")
        assertThat(sha256Database(backwards)).isEqualTo(digest)

        // And it is a digest of the contents, not just of the names.
        Files.writeString(backwards.resolve("daily.cld"), "synthetic-daily-signatures-updated")
        assertThat(sha256Database(backwards)).isNotEqualTo(digest)
    }

    @Test
    fun `a single database file digests as the file itself`(@TempDir root: Path) {
        val file = root.resolve("main.cvd")
        Files.writeString(file, "synthetic-main-signatures")

        assertThat(sha256Database(file)).isEqualTo(sha256File(file))
        // Known-answer check so a change to the streaming read cannot silently change the digest.
        assertThat(sha256File(file)).isEqualTo(
            java.util.HexFormat.of().formatHex(
                java.security.MessageDigest.getInstance("SHA-256")
                    .digest("synthetic-main-signatures".toByteArray(Charsets.UTF_8)),
            ),
        )
    }
}
