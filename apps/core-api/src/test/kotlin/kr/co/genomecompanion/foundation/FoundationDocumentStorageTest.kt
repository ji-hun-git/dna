package kr.co.genomecompanion.foundation

import kr.co.genomecompanion.documentboundary.StorageTrustZone
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
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

    private fun storage() = FoundationDocumentStorage(FoundationProperties(quarantineRoot = root))

    companion object {
        private const val onePixelPngBase64 =
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
    }
}
