package kr.co.genomecompanion.documentworker


/** Test-only child entry point: never answers, so the parent must hit its wall-clock timeout. */
fun main() {
    Thread.sleep(600_000)
}
