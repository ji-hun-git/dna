package kr.co.genomecompanion.benchmark

import java.nio.file.Path

/**
 * CLI entry point: `generate --out <dir> --font <path-to-ttf>` writes the 24-document synthetic
 * corpus (PDFs + corpus.json) under `<dir>`. Intended for local verification and CI smoke checks;
 * outputs are build artifacts and are never committed.
 */
fun main(args: Array<String>) {
    require(args.isNotEmpty() && args[0] == "generate") {
        "usage: generate --out <dir> --font <path-to-ttf>"
    }
    var out: Path? = null
    var font: Path? = null
    var i = 1
    while (i < args.size) {
        when (args[i]) {
            "--out" -> {
                out = Path.of(args[i + 1])
                i += 2
            }
            "--font" -> {
                font = Path.of(args[i + 1])
                i += 2
            }
            else -> error("unknown argument: ${args[i]}")
        }
    }
    checkNotNull(out) { "--out is required" }
    checkNotNull(font) { "--font is required" }

    val documents = CheckupCorpusGenerator(font).generateAll()
    val corpus = CorpusWriter.write(documents, out)
    println("Wrote ${documents.size} documents (${corpus.corpusId}) to $out")
}
