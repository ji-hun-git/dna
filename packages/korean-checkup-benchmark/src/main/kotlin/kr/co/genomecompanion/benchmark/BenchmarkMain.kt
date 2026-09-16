package kr.co.genomecompanion.benchmark

import java.nio.file.Path
import kotlin.system.exitProcess

/**
 * CLI entry point.
 * `generate --out <dir> --font <path-to-ttf>` writes the 24-document synthetic corpus (PDFs +
 * corpus.json) under `<dir>`. `run-native-text --corpus <dir> --out <runs.json>` runs the
 * document worker's PDFBox text-layer provider over that corpus and writes `medical-document-run.v1`
 * records. Intended for local verification and CI smoke checks; outputs are build artifacts and
 * are never committed.
 */
fun main(args: Array<String>) {
    val options = args.drop(1).chunked(2).filter { it.size == 2 }.associate { it[0] to it[1] }
    when (args.firstOrNull()) {
        "generate" -> {
            val out = Path.of(options.getValue("--out"))
            val font = Path.of(options.getValue("--font"))
            val corpus = CorpusWriter.write(CheckupCorpusGenerator(font).generateAll(), out)
            println("generated ${corpus.documents.size} synthetic documents into $out")
        }
        "run-native-text" -> {
            val corpusDir = Path.of(options.getValue("--corpus"))
            val out = Path.of(options.getValue("--out"))
            val runs = NativeTextRunner.run(corpusDir)
            BenchmarkJson.mapper.writerWithDefaultPrettyPrinter().writeValue(out.toFile(), runs)
            println("wrote ${runs.size} native-text runs to $out")
        }
        else -> {
            System.err.println(
                "usage: generate --out <dir> --font <Pretendard-Regular.ttf> | run-native-text --corpus <dir> --out <runs.json>",
            )
            exitProcess(2)
        }
    }
}
