package kr.co.genomecompanion.foundation

import kr.co.genomecompanion.documentboundary.ObjectDescriptor
import kr.co.genomecompanion.documentboundary.StorageTrustZone
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

    fun deleteAll(objectKeys: Collection<Pair<StorageTrustZone, String>>) {
        objectKeys.forEach { (zone, key) -> Files.deleteIfExists(resolve(zone, key)) }
    }

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
