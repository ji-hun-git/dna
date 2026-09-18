package kr.co.genomecompanion.foundation

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import java.time.Clock
import java.time.Duration
import java.time.Instant

/** What one sweep removed. All six counts are zero on a system with nothing to clean. */
data class JanitorReport(
    val sessions: Int,
    val capabilities: Int,
    val idempotencyKeys: Int,
    val orphanFiles: Int,
    val partFiles: Int,
    val staleJobs: Int,
)

/**
 * Periodic cleanup of everything in the foundation that expires or can be orphaned. Idempotent by
 * construction: every step is a predicate over rows or files that are already dead, so a second sweep
 * immediately after the first finds nothing.
 *
 * Three properties this class deliberately keeps:
 *
 * 1. **No lock inversion.** Each category is its own short transaction of plain `DELETE`/`UPDATE …
 *    WHERE` statements with no explicit row locks, and the job sweep touches job rows before document
 *    rows — the same order every worker and revocation path takes (see
 *    `FoundationRepository.lockDocument`). A sweep running against a live request therefore blocks at
 *    worst; it can never deadlock one, and it never sits between a target-row lock and an idempotency
 *    lock.
 * 2. **Nothing in flight is deleted.** See [sweepFiles]: the disk listing is taken *before* the
 *    database read, and no file is deleted until it has been untouched for [IN_FLIGHT_GRACE].
 * 3. **One failing category does not cost the others.** Each of the five categories runs inside its
 *    own [inCategory] guard: a failure is logged as `janitor_category_failed` with the category name
 *    and the exception's class name only, that category contributes zero to the report, and the sweep
 *    carries on. A database hiccup while deleting expired sessions must not leave stale jobs queued
 *    forever, and an unreadable quarantine root must not stop sessions expiring.
 *
 * The schedule is off in tests: `gc.foundation.janitor-interval` is `PT24H` there, and it is the
 * initial delay too, so no sweep runs at startup and the only sweeps are the ones a test calls.
 */
@Component
@ConditionalOnProperty(prefix = "gc.foundation", name = ["enabled"], havingValue = "true")
class FoundationJanitor(
    private val repository: FoundationRepository,
    private val storage: FoundationDocumentStorage,
    private val clock: Clock,
    private val logging: FoundationLogging,
) {
    @Scheduled(
        fixedDelayString = "\${gc.foundation.janitor-interval:5m}",
        initialDelayString = "\${gc.foundation.janitor-interval:5m}",
    )
    fun sweep(): JanitorReport {
        val now = Instant.now(clock)
        val sessions = inCategory(CATEGORY_SESSIONS, 0) { repository.deleteExpiredSessions(now) }
        val capabilities = inCategory(CATEGORY_CAPABILITIES, 0) { repository.deleteExpiredUploadCapabilities(now) }
        val idempotencyKeys = inCategory(CATEGORY_IDEMPOTENCY, 0) { repository.deleteExpiredIdempotency(now) }
        val staleJobs = inCategory(CATEGORY_STALE_JOBS, 0) {
            repository.failStaleQueuedJobs(now.minus(STALE_JOB_AGE), now).size
        }
        val files = inCategory(CATEGORY_FILES, FileSweep.NONE) { sweepFiles(now) }
        val report = JanitorReport(
            sessions = sessions,
            capabilities = capabilities,
            idempotencyKeys = idempotencyKeys,
            orphanFiles = files.orphanFiles,
            partFiles = files.partFiles,
            staleJobs = staleJobs,
        )
        logging.janitorSweep(report)
        return report
    }

    /**
     * Runs one category, or gives up on it alone. A category that throws is logged (class name only,
     * never the exception's message: an `IOException`'s message is a path and a `DataAccessException`'s
     * can quote a bind parameter) and contributes [fallback] to the report, so the remaining categories
     * of this sweep still run and the next sweep retries the failed one from scratch.
     */
    private fun <T> inCategory(category: String, fallback: T, work: () -> T): T =
        try {
            work()
        } catch (exception: Exception) {
            logging.janitorCategoryFailed(category, exception.javaClass.simpleName)
            fallback
        }

    /**
     * The file half of the sweep, ordered so that it can never delete a live file.
     *
     * **Disk first, database second.** A file created after the disk listing is invisible to this
     * sweep, and any key committed after the listing is already in the known set — the read happens
     * later, so it can only be a superset of what was on disk. The reverse order (known keys, then
     * disk) is the unsafe one and used to be what this class did: known keys read at T1, the worker
     * copies an approved PDF into `approved_source` at T2, the listing at T3 sees a file no key covers,
     * and the row that points at it commits at T4 — a live document left pointing at a file the
     * janitor deleted.
     *
     * **Nothing young is deleted, whatever it is called.** Ordering alone still leaves the window in
     * which the file lands *before* the listing and the row commits after it, so every candidate —
     * `.pdf`, `.png` and `.part` alike — must also have been untouched for [IN_FLIGHT_GRACE] before it
     * is deleted. An hour is far longer than any write-then-commit window in this system (the request
     * body cap is 10 MiB and no transaction outlives its request), and a file that really is an orphan
     * is simply collected by the next sweep instead of this one.
     */
    private fun sweepFiles(now: Instant): FileSweep {
        val settledBefore = now.minus(IN_FLIGHT_GRACE)
        val onDisk = storage.listObjectKeys()
        val known = repository.listKnownObjectKeys()
        val orphans = onDisk
            .filter { it.lastModifiedAt.isBefore(settledBefore) }
            .map { it.zone to it.objectKey }
            .filter { it !in known }
        val failed = storage.deleteAll(orphans)
        return FileSweep(
            orphanFiles = orphans.size - failed.size,
            partFiles = storage.sweepStalePartFiles(settledBefore),
        )
    }

    private data class FileSweep(val orphanFiles: Int, val partFiles: Int) {
        companion object {
            val NONE = FileSweep(0, 0)
        }
    }

    private companion object {
        const val CATEGORY_SESSIONS = "sessions"
        const val CATEGORY_CAPABILITIES = "capabilities"
        const val CATEGORY_IDEMPOTENCY = "idempotency"
        const val CATEGORY_STALE_JOBS = "stale_jobs"
        const val CATEGORY_FILES = "files"

        /** A job queued this long ago will never be leased; its document must stop waiting. */
        val STALE_JOB_AGE: Duration = Duration.ofHours(24)

        /** How long a file must sit untouched before a sweep may treat it as dead. Covers both an
         * upload still streaming into its `.part` file and a storage write whose database row has not
         * committed yet. */
        val IN_FLIGHT_GRACE: Duration = Duration.ofHours(1)
    }
}
