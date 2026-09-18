package kr.co.genomecompanion.foundation

import kr.co.genomecompanion.documentboundary.ObjectDescriptor
import kr.co.genomecompanion.documentboundary.StorageTrustZone
import kr.co.genomecompanion.platform.telemetry.CorrelationFilter
import kr.co.genomecompanion.platform.telemetry.PhiSafeLogger
import kr.co.genomecompanion.platform.telemetry.TelemetryEvent
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.stereotype.Component
import java.io.InputStream
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.StandardCopyOption
import java.nio.file.StandardOpenOption
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.time.Instant
import java.util.UUID
import java.util.zip.CRC32


data class StoredObjectWrite(
    val descriptor: ObjectDescriptor,
    val createdNew: Boolean,
)

/**
 * One object found on disk by [FoundationDocumentStorage.listObjectKeys], with the modification time
 * the janitor needs to tell a settled file from one that was written moments ago and whose database row
 * may not have committed yet.
 */
data class StoredObjectListing(
    val zone: StorageTrustZone,
    val objectKey: String,
    val lastModifiedAt: Instant,
)


@Component
@ConditionalOnProperty(prefix = "gc.foundation", name = ["enabled"], havingValue = "true")
class FoundationDocumentStorage(
    properties: FoundationProperties,
) {
    private val root = properties.quarantineRoot!!.toAbsolutePath().normalize()
    private val phiSafeLogger = PhiSafeLogger.forClass(FoundationDocumentStorage::class.java)

    /** Kept only for [FoundationDocumentStorageTest]'s pre-streaming coverage; no production caller remains
     * (the upload path now streams via the [InputStream] overload below). */
    fun putUntrusted(documentId: UUID, content: ByteArray): StoredObjectWrite =
        putUntrusted(documentId, content.inputStream(), content.size.toLong(), FoundationHashing.sha256(content))

    /**
     * Streams [content] to `<key>.part` while hashing it, verifying the exact declared [expectedLength]
     * and [expectedSha256] against what was actually written — never buffering the whole body in memory —
     * then atomically moves the part file into place (or, if the final key already exists, compares the
     * two files byte-by-byte through streams rather than reading either fully into memory).
     */
    fun putUntrusted(documentId: UUID, content: InputStream, expectedLength: Long, expectedSha256: String): StoredObjectWrite {
        val key = "$documentId.pdf"
        val path = resolve(StorageTrustZone.UNTRUSTED, key)
        Files.createDirectories(path.parent)
        val part = path.resolveSibling("$key.part")
        val digest = MessageDigest.getInstance("SHA-256")
        var written = 0L
        try {
            Files.newOutputStream(part, StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE).use { output ->
                val buffer = ByteArray(65_536)
                while (true) {
                    val read = content.read(buffer)
                    if (read < 0) break
                    written += read
                    if (written > expectedLength) throw FoundationBadRequestException("content_length_mismatch")
                    digest.update(buffer, 0, read)
                    output.write(buffer, 0, read)
                }
            }
            if (written != expectedLength) throw FoundationBadRequestException("content_length_mismatch")
            val actual = digest.digest().joinToString("") { "%02x".format(it.toInt() and 0xff) }
            if (!FoundationHashing.constantTimeHexEquals(actual, expectedSha256)) {
                throw FoundationBadRequestException("content_digest_mismatch")
            }
            if (Files.exists(path)) {
                if (Files.mismatch(path, part) != -1L) throw FoundationConflictException("upload_overwrite_denied")
                return StoredObjectWrite(descriptorFromDigest(StorageTrustZone.UNTRUSTED, key, written, actual), createdNew = false)
            }
            Files.move(part, path, StandardCopyOption.ATOMIC_MOVE)
            return StoredObjectWrite(descriptorFromDigest(StorageTrustZone.UNTRUSTED, key, written, actual), createdNew = true)
        } finally {
            Files.deleteIfExists(part)
        }
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

    /**
     * Every object that exists on disk, by zone, each with its last-modified time — the other half of
     * the janitor's orphan comparison (the other half is `FoundationRepository.listKnownObjectKeys`).
     * Only names that are valid object keys are returned: anything else in a zone directory was not
     * written by this class, and a file this class cannot even address is not the janitor's to delete.
     * A missing zone directory is simply empty, never an error.
     *
     * The modification time is what lets the janitor apply an age threshold to *every* candidate, not
     * just to `.part` files: a file whose bytes landed seconds ago may belong to a write whose row has
     * not committed yet (the worker copies an approved PDF and its preview into storage before the
     * `markInspectionCompleted` transaction commits), and such a file must never be treated as an
     * orphan. A file that vanishes between the listing and the `stat` is dropped from the result — it
     * is already gone, so there is nothing for a sweep to do about it.
     */
    fun listObjectKeys(): List<StoredObjectListing> =
        StorageTrustZone.entries.flatMap { zone ->
            val zoneRoot = root.resolve(zone.name.lowercase())
            if (!Files.isDirectory(zoneRoot)) {
                emptyList()
            } else {
                Files.list(zoneRoot).use { entries ->
                    entries.filter(Files::isRegularFile).toList()
                }.mapNotNull { path ->
                    val name = path.fileName.toString()
                    if (!name.matches(objectKeyPattern)) {
                        null
                    } else {
                        runCatching { Files.getLastModifiedTime(path).toInstant() }
                            .getOrNull()
                            ?.let { StoredObjectListing(zone, name, it) }
                    }
                }
            }
        }

    /**
     * Deletes abandoned `<key>.part` files — an upload that died between `CREATE_NEW` and the atomic
     * move, whose `finally` never ran (a killed process, a lost container). Only a part file untouched
     * since [olderThan] is swept: a younger one belongs to an upload that may still be streaming right
     * now, and deleting it would break a live request. Each delete is attempted on its own and a real
     * I/O failure is logged with the exception's class name only — never the path — exactly as
     * [deleteAll] does.
     *
     * @return the number of part files actually removed.
     */
    fun sweepStalePartFiles(olderThan: Instant): Int {
        var removed = 0
        for (zone in StorageTrustZone.entries) {
            val zoneRoot = root.resolve(zone.name.lowercase())
            if (!Files.isDirectory(zoneRoot)) continue
            val parts = Files.list(zoneRoot).use { entries ->
                entries.filter(Files::isRegularFile)
                    .filter { it.fileName.toString().endsWith(".part") }
                    .toList()
            }
            for (path in parts) {
                try {
                    if (Files.getLastModifiedTime(path).toInstant().isAfter(olderThan)) continue
                    if (Files.deleteIfExists(path)) removed += 1
                } catch (exception: Exception) {
                    phiSafeLogger.emitResourceFailure(
                        TelemetryEvent.QUARANTINE_FILE_DELETE_FAILED,
                        CorrelationFilter.currentCorrelationId() ?: UUID.randomUUID(),
                        documentIdFromKey(path.fileName.toString()) ?: UUID(0, 0),
                        exception.javaClass.simpleName,
                    )
                }
            }
        }
        return removed
    }

    private fun documentIdFromKey(key: String): UUID? =
        if (key.length >= 36) runCatching { UUID.fromString(key.substring(0, 36)) }.getOrNull() else null

    private fun descriptor(zone: StorageTrustZone, key: String, bytes: ByteArray): ObjectDescriptor =
        descriptorFromDigest(zone, key, bytes.size.toLong(), FoundationHashing.sha256(bytes))

    private fun descriptorFromDigest(zone: StorageTrustZone, key: String, size: Long, sha256: String): ObjectDescriptor =
        ObjectDescriptor(
            zone = zone,
            objectKey = key,
            version = FoundationHashing.sha256("${zone.name}:$key:$sha256"),
            size = size,
            sha256 = sha256,
        )

    /** The one object-key shape this class will address: `<uuid>[-<sha256>].{pdf,png}`. */
    private val objectKeyPattern = Regex("^[a-f0-9-]{36,110}\\.(pdf|png)$")

    private fun resolve(zone: StorageTrustZone, objectKey: String): Path {
        if (!objectKey.matches(objectKeyPattern)) {
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
