package kr.co.genomecompanion.foundation

import kr.co.genomecompanion.documentboundary.ObjectDescriptor
import kr.co.genomecompanion.documentboundary.StorageTrustZone
import kr.co.genomecompanion.platform.telemetry.CorrelationFilter
import kr.co.genomecompanion.platform.telemetry.PhiSafeLogger
import kr.co.genomecompanion.platform.telemetry.TelemetryEvent
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.stereotype.Component
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.StandardCopyOption
import java.nio.file.StandardOpenOption
import java.nio.charset.StandardCharsets
import java.util.UUID
import java.util.zip.CRC32


data class StoredObjectWrite(
    val descriptor: ObjectDescriptor,
    val createdNew: Boolean,
)


@Component
@ConditionalOnProperty(prefix = "gc.foundation", name = ["enabled"], havingValue = "true")
class FoundationDocumentStorage(
    properties: FoundationProperties,
) {
    private val root = properties.quarantineRoot!!.toAbsolutePath().normalize()
    private val phiSafeLogger = PhiSafeLogger.forClass(FoundationDocumentStorage::class.java)

    fun putUntrusted(documentId: UUID, content: ByteArray): StoredObjectWrite {
        val key = "$documentId.pdf"
        val path = resolve(StorageTrustZone.UNTRUSTED, key)
        Files.createDirectories(path.parent)
        if (Files.exists(path)) {
            val existing = Files.readAllBytes(path)
            if (!existing.contentEquals(content)) throw FoundationConflictException("upload_overwrite_denied")
            return StoredObjectWrite(descriptor(StorageTrustZone.UNTRUSTED, key, existing), createdNew = false)
        }
        Files.write(path, content, StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE)
        return StoredObjectWrite(descriptor(StorageTrustZone.UNTRUSTED, key, content), createdNew = true)
    }

    fun read(zone: StorageTrustZone, objectKey: String): ByteArray = Files.readAllBytes(resolve(zone, objectKey))

    fun promote(documentId: UUID, expectedSha256: String, untrustedObjectKey: String): StoredObjectWrite {
        val source = resolve(StorageTrustZone.UNTRUSTED, untrustedObjectKey)
        val content = Files.readAllBytes(source)
        val actualSha256 = FoundationHashing.sha256(content)
        if (!FoundationHashing.constantTimeHexEquals(actualSha256, expectedSha256)) {
            throw FoundationConflictException("promotion_digest_mismatch")
        }
        val approvedKey = "$documentId-$actualSha256.pdf"
        val destination = resolve(StorageTrustZone.APPROVED_SOURCE, approvedKey)
        Files.createDirectories(destination.parent)
        val createdNew = if (Files.exists(destination)) {
            if (!Files.readAllBytes(destination).contentEquals(content)) {
                throw FoundationConflictException("approved_source_overwrite_denied")
            }
            false
        } else {
            Files.copy(source, destination, StandardCopyOption.COPY_ATTRIBUTES)
            true
        }
        return StoredObjectWrite(descriptor(StorageTrustZone.APPROVED_SOURCE, approvedKey, content), createdNew)
    }

    fun putDerivedPreview(documentId: UUID, expectedSourceSha256: String, content: ByteArray): StoredObjectWrite {
        if (content.size !in 67..2_097_152) throw FoundationBadRequestException("preview_size_invalid")
        val pngSignature = byteArrayOf(
            0x89.toByte(), 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        )
        if (!content.copyOfRange(0, pngSignature.size).contentEquals(pngSignature)) {
            throw FoundationBadRequestException("preview_png_required")
        }
        validatePngStructure(content)
        val key = "$documentId-$expectedSourceSha256.png"
        val path = resolve(StorageTrustZone.DERIVED_SAFE_ARTIFACT, key)
        Files.createDirectories(path.parent)
        if (Files.exists(path)) {
            val existing = Files.readAllBytes(path)
            if (!existing.contentEquals(content)) throw FoundationConflictException("preview_overwrite_denied")
            return StoredObjectWrite(
                descriptor(StorageTrustZone.DERIVED_SAFE_ARTIFACT, key, existing),
                createdNew = false,
            )
        }
        Files.write(path, content, StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE)
        return StoredObjectWrite(
            descriptor(StorageTrustZone.DERIVED_SAFE_ARTIFACT, key, content),
            createdNew = true,
        )
    }

    /**
     * Deletes every key, one at a time. A failing key (a real I/O error — `Files.deleteIfExists` treats
     * an already-absent file as success, not a failure) never stops the rest from being attempted: it is
     * logged once via [PhiSafeLogger] (event code, correlation id, the document id parsed from the key's
     * own `<documentId>[-...].{pdf,png}` naming convention, and the exception's class name only — never
     * the key/path/filename itself) and collected into the returned list so the caller (and ultimately the
     * Task 22 janitor) can retry it later.
     */
    fun deleteAll(objectKeys: Collection<Pair<StorageTrustZone, String>>): List<Pair<StorageTrustZone, String>> {
        val failed = mutableListOf<Pair<StorageTrustZone, String>>()
        for (entry in objectKeys) {
            val (zone, key) = entry
            try {
                deleteObject(zone, key)
            } catch (exception: Exception) {
                failed.add(entry)
                phiSafeLogger.emitResourceFailure(
                    TelemetryEvent.QUARANTINE_FILE_DELETE_FAILED,
                    CorrelationFilter.currentCorrelationId() ?: UUID.randomUUID(),
                    documentIdFromKey(key) ?: UUID(0, 0),
                    exception.javaClass.simpleName,
                )
            }
        }
        return failed
    }

    /**
     * Deletes a single object. Extracted from [deleteAll]'s loop as its own function purely as a test
     * seam: a test can subclass [FoundationDocumentStorage] and override this one method to inject a
     * genuine [java.io.IOException] for a specific object key, instead of relying on filesystem
     * permission tricks (a read-only bit, a same-named non-empty directory) that are not portable —
     * e.g. a CI runner executing as root ignores read-only bits entirely, so such a "failure" would
     * silently never happen there. Production behavior is unchanged: delegate straight to the real
     * filesystem delete.
     */
    protected fun deleteObject(zone: StorageTrustZone, key: String) {
        Files.deleteIfExists(resolve(zone, key))
    }

    private fun documentIdFromKey(key: String): UUID? =
        if (key.length >= 36) runCatching { UUID.fromString(key.substring(0, 36)) }.getOrNull() else null

    private fun descriptor(zone: StorageTrustZone, key: String, bytes: ByteArray): ObjectDescriptor =
        ObjectDescriptor(
            zone = zone,
            objectKey = key,
            version = FoundationHashing.sha256("${zone.name}:$key:${FoundationHashing.sha256(bytes)}"),
            size = bytes.size.toLong(),
            sha256 = FoundationHashing.sha256(bytes),
        )

    private fun resolve(zone: StorageTrustZone, objectKey: String): Path {
        if (!objectKey.matches(Regex("^[a-f0-9-]{36,110}\\.(pdf|png)$"))) {
            throw FoundationForbiddenException("object_key_denied")
        }
        val zoneRoot = root.resolve(zone.name.lowercase()).normalize()
        val path = zoneRoot.resolve(objectKey).normalize()
        if (!path.startsWith(zoneRoot)) throw FoundationForbiddenException("object_path_denied")
        return path
    }

    private fun validatePngStructure(content: ByteArray) {
        var offset = 8
        var chunkCount = 0
        var sawHeader = false
        while (offset <= content.size - 12 && chunkCount < 10_000) {
            val length = ((content[offset].toLong() and 0xff) shl 24) or
                ((content[offset + 1].toLong() and 0xff) shl 16) or
                ((content[offset + 2].toLong() and 0xff) shl 8) or
                (content[offset + 3].toLong() and 0xff)
            if (length > content.size.toLong() - offset - 12) {
                throw FoundationBadRequestException("preview_png_invalid")
            }
            val type = String(content, offset + 4, 4, StandardCharsets.US_ASCII)
            if (!sawHeader) {
                if (type != "IHDR" || length != 13L) throw FoundationBadRequestException("preview_png_invalid")
                val width = readUnsignedInt(content, offset + 8)
                val height = readUnsignedInt(content, offset + 12)
                if (width !in 1..5_000 || height !in 1..5_000 || width * height > 20_000_000) {
                    throw FoundationBadRequestException("preview_dimensions_invalid")
                }
                sawHeader = true
            }
            val crc = CRC32().apply { update(content, offset + 4, 4 + length.toInt()) }
            val expectedCrc = readUnsignedInt(content, offset + 8 + length.toInt())
            if (crc.value != expectedCrc) throw FoundationBadRequestException("preview_png_invalid")
            val nextOffset = offset + 12 + length.toInt()
            if (type == "IEND") {
                if (length != 0L || nextOffset != content.size) {
                    throw FoundationBadRequestException("preview_png_invalid")
                }
                return
            }
            offset = nextOffset
            chunkCount += 1
        }
        throw FoundationBadRequestException("preview_png_invalid")
    }

    private fun readUnsignedInt(content: ByteArray, offset: Int): Long =
        ((content[offset].toLong() and 0xff) shl 24) or
            ((content[offset + 1].toLong() and 0xff) shl 16) or
            ((content[offset + 2].toLong() and 0xff) shl 8) or
            (content[offset + 3].toLong() and 0xff)
}
