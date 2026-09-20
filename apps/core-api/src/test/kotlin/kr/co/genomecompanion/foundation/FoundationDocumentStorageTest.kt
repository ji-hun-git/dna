package kr.co.genomecompanion.foundation

import ch.qos.logback.classic.spi.ILoggingEvent
import ch.qos.logback.core.read.ListAppender
import kr.co.genomecompanion.documentboundary.StorageTrustZone
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import org.slf4j.LoggerFactory
import java.nio.file.Files
import java.nio.file.Path
import java.util.Base64
import java.util.UUID


class FoundationDocumentStorageTest {
    @TempDir
    lateinit var root: Path

    @Test
    fun `identical upload replay is idempotent but overwrite is denied`() {
        val storage = storage()
        val documentId = UUID.randomUUID()
        val first = storage.putUntrusted(documentId, "synthetic-pdf-bytes".toByteArray())
        val replay = storage.putUntrusted(documentId, "synthetic-pdf-bytes".toByteArray())

        assertThat(first.createdNew).isTrue()
        assertThat(replay.createdNew).isFalse()
        assertThat(replay.descriptor.sha256).isEqualTo(first.descriptor.sha256)
        assertThatThrownBy {
            storage.putUntrusted(documentId, "different-synthetic-bytes".toByteArray())
        }.isInstanceOf(FoundationConflictException::class.java)
    }

    @Test
    fun `promotion binds approved key to exact inspected digest`() {
        val storage = storage()
        val documentId = UUID.randomUUID()
        val untrusted = storage.putUntrusted(documentId, "synthetic-pdf-bytes".toByteArray())

        val approved = storage.promote(
            documentId,
            untrusted.descriptor.sha256,
            untrusted.descriptor.objectKey,
        )

        assertThat(approved.descriptor.zone).isEqualTo(StorageTrustZone.APPROVED_SOURCE)
        assertThat(approved.descriptor.objectKey).contains(untrusted.descriptor.sha256)
        assertThatThrownBy {
            storage.promote(documentId, "0".repeat(64), untrusted.descriptor.objectKey)
        }.isInstanceOf(FoundationConflictException::class.java)
    }

    @Test
    fun `derived artifact accepts a bounded complete png and rejects trailing bytes`() {
        val storage = storage()
        val documentId = UUID.randomUUID()
        val png = Base64.getDecoder().decode(onePixelPngBase64)

        val stored = storage.putDerivedPreview(documentId, "a".repeat(64), png)

        assertThat(stored.descriptor.zone).isEqualTo(StorageTrustZone.DERIVED_SAFE_ARTIFACT)
        assertThatThrownBy {
            storage.putDerivedPreview(UUID.randomUUID(), "a".repeat(64), png + byteArrayOf(0x00))
        }.isInstanceOf(FoundationBadRequestException::class.java)
        val corruptCrc = png.copyOf().also { it[it.lastIndex] = (it[it.lastIndex].toInt() xor 1).toByte() }
        assertThatThrownBy {
            storage.putDerivedPreview(UUID.randomUUID(), "a".repeat(64), corruptCrc)
        }.isInstanceOf(FoundationBadRequestException::class.java)
    }

    @Test
    fun `deleteAll continues past a failing key, deletes the rest, and logs only event, correlation id, document id and exception class`() {
        val storage = storage()
        val goodDocumentId = UUID.randomUUID()
        val badDocumentId = UUID.randomUUID()
        val goodKey = storage.putUntrusted(goodDocumentId, "synthetic-pdf-bytes".toByteArray()).descriptor.objectKey
        // Fault injection without mocks: make the "file" at the bad key a non-empty directory so the real
        // filesystem's own Files.deleteIfExists throws DirectoryNotEmptyException, a genuine I/O failure.
        val badKey = "$badDocumentId.pdf"
        val badPath = root.resolve("untrusted").resolve(badKey)
        Files.createDirectories(badPath)
        Files.writeString(badPath.resolve("occupied"), "x")

        val logger = LoggerFactory.getLogger(FoundationDocumentStorage::class.java) as ch.qos.logback.classic.Logger
        val appender = ListAppender<ILoggingEvent>().also { it.start() }
        logger.addAppender(appender)
        val failed = try {
            storage.deleteAll(listOf(StorageTrustZone.UNTRUSTED to badKey, StorageTrustZone.UNTRUSTED to goodKey))
        } finally {
            logger.detachAppender(appender)
        }

        assertThat(failed).containsExactly(StorageTrustZone.UNTRUSTED to badKey)
        assertThat(Files.exists(root.resolve("untrusted").resolve(goodKey))).isFalse()
        assertThat(Files.exists(badPath)).isTrue()

        val rendered = appender.list.joinToString("\n") { it.formattedMessage }
        assertThat(rendered).contains("quarantine_file_delete_failed", "DirectoryNotEmptyException", badDocumentId.toString())
        assertThat(rendered).doesNotContain(badKey, goodKey, goodDocumentId.toString(), ".pdf")
    }

    @Test
    fun `streams an upload into place and removes the part file on a digest mismatch`() {
        val storage = storage()
        val bytes = "%PDF-1.7\nsynthetic stream fixture\n%%EOF\n".toByteArray()
        val id = UUID.randomUUID()
        val stored = storage.putUntrusted(id, bytes.inputStream(), bytes.size.toLong(), FoundationHashing.sha256(bytes))
        assertThat(stored.createdNew).isTrue()
        assertThat(Files.readAllBytes(root.resolve("untrusted").resolve("$id.pdf"))).containsExactly(*bytes)
        val other = UUID.randomUUID()
        assertThatThrownBy { storage.putUntrusted(other, bytes.inputStream(), bytes.size.toLong(), "0".repeat(64)) }
            .isInstanceOf(FoundationBadRequestException::class.java).hasMessage("content_digest_mismatch")
        assertThat(Files.exists(root.resolve("untrusted").resolve("$other.pdf"))).isFalse()
        assertThat(Files.exists(root.resolve("untrusted").resolve("$other.pdf.part"))).isFalse()
    }

    private fun storage() = FoundationDocumentStorage(FoundationProperties(quarantineRoot = root))

    companion object {
        private const val onePixelPngBase64 =
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
    }
}
