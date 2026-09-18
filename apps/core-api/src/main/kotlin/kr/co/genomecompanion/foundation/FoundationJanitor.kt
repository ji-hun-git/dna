package kr.co.genomecompanion.foundation

import kr.co.genomecompanion.platform.telemetry.TelemetryEvent
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import java.time.Clock
import java.time.Duration
import java.time.Instant

/** What one sweep removed. All five counts are zero on a system with nothing to clean. */
data class JanitorReport(
    val sessions: Int,
    val capabilities: Int,
    val idempotencyKeys: Int,
    val orphanFiles: Int,
    val staleJobs: Int,
)

/**
 * Periodic cleanup of everything in the foundation that expires or can be orphaned. Idempotent by
 * construction: every step is a predicate over rows or files that are already dead, so a second sweep
 * immediately after the first finds nothing.
 *
 * Two properties this class deliberately keeps:
 *
 * 1. **No lock inversion.** Each category is its own short transaction of plain `DELETE`/`UPDATE …
 *    WHERE` statements with no explicit row locks, and the job sweep touches job rows before document
 *    rows — the same order every worker and revocation path takes (see
 *    `FoundationRepository.lockDocument`). A sweep running against a live request therefore blocks at
 *    worst; it can never deadlock one, and it never sits between a target-row lock and an idempotency
 *    lock.
 * 2. **Nothing in flight is deleted.** A file is an orphan only when no row points at it, and the
 *    pending-upload key reservation in `FoundationRepository.listKnownObjectKeys` plus the one-hour
 *    grace on `.part` files in [FoundationDocumentStorage.sweepStalePartFiles] cover the two windows
 *    in which a live upload's bytes are on disk before (or while) the database learns about them.
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
        val sessions = repository.deleteExpiredSessions(now)
        val capabilities = repository.deleteExpiredUploadCapabilities(now)
        val idempotencyKeys = repository.deleteExpiredIdempotency(now)
        val staleJobs = repository.failStaleQueuedJobs(now.minus(STALE_JOB_AGE), now).size
        // Read the known keys *after* the row sweeps above so a key a sweep just cleared is visible as
        // an orphan in this same pass, and read them before listing the disk: a row created between the
        // two reads makes its file look known, never the other way round.
        val known = repository.listKnownObjectKeys()
        val orphans = storage.listObjectKeys().filter { it !in known }
        val failed = storage.deleteAll(orphans)
        val partFiles = storage.sweepStalePartFiles(now.minus(PART_FILE_AGE))
        logging.event(TelemetryEvent.JANITOR_SWEEP, null, null)
        return JanitorReport(
            sessions = sessions,
            capabilities = capabilities,
            idempotencyKeys = idempotencyKeys,
            orphanFiles = orphans.size - failed.size + partFiles,
            staleJobs = staleJobs,
        )
    }

    private companion object {
        /** A job queued this long ago will never be leased; its document must stop waiting. */
        val STALE_JOB_AGE: Duration = Duration.ofHours(24)

        /** No single upload streams for an hour (the request body cap is 10 MiB), so a part file this
         * old belongs to a process that is gone. */
        val PART_FILE_AGE: Duration = Duration.ofHours(1)
    }
}
