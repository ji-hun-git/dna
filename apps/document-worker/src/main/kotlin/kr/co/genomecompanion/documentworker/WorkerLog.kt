package kr.co.genomecompanion.documentworker

/**
 * Stdout only. Event code, job id, failure code — nothing from a document.
 *
 * The worker is the one process that holds a person's uploaded bytes in memory, so its log is the
 * easiest place in the system to leak one: a file name, a rendered page, an extracted value, or a
 * PDFBox exception message that quotes the object it choked on. This object is the whole vocabulary the
 * worker is allowed to say, and the two `require`s below make an accidental third argument a crash in
 * the worker's own tests rather than a line in a shipped log.
 */
object WorkerLog {
    private val EVENT = Regex("^[a-z_]{3,40}$")
    private val CODE = Regex("^[a-z0-9_-]{3,80}$")

    fun emit(event: String, jobId: String?, code: String? = null) {
        require(event.matches(EVENT))
        require(code == null || code.matches(CODE))
        println("event=$event job_id=${jobId ?: "none"} code=${code ?: "none"}")
    }
}
