package kr.co.genomecompanion.foundation

import kr.co.genomecompanion.documentboundary.StorageTrustZone
import java.io.IOException
import java.util.concurrent.ConcurrentHashMap

/**
 * Test double that lets a test make exactly one delete attempt against a chosen object key fail with a
 * genuine [IOException], then succeed on every attempt after that (including retries against the same
 * key). Registered as the [FoundationDocumentStorage] bean only for tests that need it (see
 * `FoundationLifecyclePostgresIntegrationTest.PreviewDeleteFaultInjectionConfig`).
 *
 * This exists so fault injection for "the file delete failed" tests goes through the storage seam
 * ([deleteObject]) instead of a filesystem permission trick. A read-only bit or a same-named
 * non-empty directory is not portable: this suite's Linux CI runner executes as root, which ignores
 * read-only permissions entirely, and directory-vs-file delete semantics also differ enough across
 * platforms that such tricks are not deterministic. Throwing directly from the seam is deterministic
 * on every platform.
 */
class FaultInjectingFoundationDocumentStorage(
    properties: FoundationProperties,
) : FoundationDocumentStorage(properties) {
    private val keysWhoseNextDeleteShouldFail = ConcurrentHashMap.newKeySet<String>()

    /** The next delete attempt against [objectKey] throws [IOException] instead of deleting; every attempt after that (for this or any other key) succeeds normally. */
    fun failNextDeleteOf(objectKey: String) {
        keysWhoseNextDeleteShouldFail.add(objectKey)
    }

    @Volatile
    private var nextListObjectKeysShouldFail: Boolean = false

    /**
     * The next [listObjectKeys] call throws [IOException] instead of listing; every call after that
     * succeeds normally. The seam a test uses to fail exactly one janitor category — an unreadable
     * quarantine root is not portable (this suite's CI runner executes as root and ignores read-only
     * bits), while throwing from here is deterministic everywhere.
     */
    fun failNextListObjectKeys() {
        nextListObjectKeysShouldFail = true
    }

    fun reset() {
        keysWhoseNextDeleteShouldFail.clear()
        nextListObjectKeysShouldFail = false
    }

    override fun listObjectKeys(): List<StoredObjectListing> {
        if (nextListObjectKeysShouldFail) {
            nextListObjectKeysShouldFail = false
            throw IOException("synthetic-injected-list-failure")
        }
        return super.listObjectKeys()
    }

    override fun deleteObject(zone: StorageTrustZone, key: String) {
        if (keysWhoseNextDeleteShouldFail.remove(key)) {
            throw IOException("synthetic-injected-delete-failure:$key")
        }
        super.deleteObject(zone, key)
    }
}
