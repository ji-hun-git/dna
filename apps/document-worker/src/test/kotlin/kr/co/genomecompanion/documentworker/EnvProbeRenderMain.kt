package kr.co.genomecompanion.documentworker


/**
 * Test-only child entry point: reports the environment it was actually given, one key per line, so the
 * parent can prove that nothing of the worker's own environment — the credential above all — survives
 * into a process that parses document bytes. Only key names are printed; no value is ever emitted.
 */
fun main() {
    // The trailing padding line only keeps the report above the launcher's 67-byte plausible-output
    // floor: a cleared environment is short enough to be rejected as unusable stdout otherwise.
    val keys = System.getenv().keys.sorted().joinToString("\n", postfix = "\n" + "#".repeat(80) + "\n")
    System.out.write(keys.toByteArray(Charsets.UTF_8))
    System.out.flush()
}
