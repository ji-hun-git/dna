package kr.co.genomecompanion.documentworker

import kotlin.system.exitProcess


/** Test-only child entry point: dies with a non-zero code that is not the out-of-memory code. */
fun main() {
    exitProcess(7)
}
