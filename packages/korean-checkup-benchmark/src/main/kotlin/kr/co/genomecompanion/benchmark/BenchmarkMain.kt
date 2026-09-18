package kr.co.genomecompanion.benchmark

import kr.co.genomecompanion.documentboundary.MedicalConceptCatalogue
import java.nio.file.Path
import kotlin.system.exitProcess

/**
 * CLI entry point.
 * `generate --out <dir> --font <path-to-ttf>` writes the 31-document synthetic corpus (PDFs +
 * corpus.json) under `<dir>`. `run-native-text --corpus <dir> --out <runs.json>` runs the
 * document worker's PDFBox text-layer provider over that corpus and writes `medical-document-run.v1`
 * records. `render-pages --corpus <dir> --out <dir>` writes `<documentId>-p<N>.png` at 150 dpi.
 * `export-concepts --out <concepts.json>` writes the shared alias dictionary as JSON for the
 * TypeScript experiment script. Intended for local verification and CI smoke checks; outputs are
 * build artifacts and are never committed.
 */
fun main(args: Array<String>) {
    val options = args.drop(1).chunked(2).filter { it.size == 2 }.associate { it[0] to it[1] }
    when (args.firstOrNull()) {
        "generate" -> {
            val out = Path.of(options.getValue("--out"))
            val font = Path.of(options.getValue("--font"))
            val corpus = CorpusWriter.write(CheckupCorpusGenerator(font).generateAll(), out)
            println("generated ${corpus.documents.size} synthetic documents into $out (corpusId ${corpus.corpusId})")
        }
        "run-native-text" -> {
            val corpusDir = Path.of(options.getValue("--corpus"))
            val out = Path.of(options.getValue("--out"))
            val runs = NativeTextRunner.run(corpusDir)
            BenchmarkJson.mapper.writerWithDefaultPrettyPrinter().writeValue(out.toFile(), runs)
            println("wrote ${runs.size} native-text runs to $out")
        }
        "render-pages" -> {
            val corpusDir = Path.of(options.getValue("--corpus"))
            val out = Path.of(options.getValue("--out"))
            val pages = PageRenderer.render(corpusDir, out)
            println("rendered ${pages.size} pages at ${PageRenderer.DPI} dpi into $out")
        }
        "export-concepts" -> {
            val out = Path.of(options.getValue("--out"))
            val concepts = MedicalConceptCatalogue.entries.map {
                mapOf("conceptCode" to it.conceptCode, "displayKo" to it.displayKo, "aliases" to it.aliases)
            }
            BenchmarkJson.mapper.writerWithDefaultPrettyPrinter().writeValue(out.toFile(), concepts)
            println("wrote ${concepts.size} concepts to $out")
        }
        "generate-hand-labelled" -> {
            val out = Path.of(options.getValue("--out"))
            val font = Path.of(options.getValue("--font"))
            val corpus = HandLabelledFixtures.writeAll(out, font)
            println("generated ${corpus.documents.size} hand-labelled synthetic documents into $out (corpusId ${corpus.corpusId})")
        }
        "run-hand-labelled" -> {
            val corpusDir = Path.of(options.getValue("--corpus"))
            val out = Path.of(options.getValue("--out"))
            val runs = HandLabelledRunner.run(corpusDir)
            BenchmarkJson.mapper.writerWithDefaultPrettyPrinter().writeValue(out.toFile(), runs)
            println("wrote ${runs.size} hand-labelled native-text runs to $out")
        }
        else -> {
            System.err.println(
                "usage: generate --out <dir> --font <Pretendard-Regular.ttf> | run-native-text --corpus <dir> --out <runs.json>" +
                    " | render-pages --corpus <dir> --out <dir> | export-concepts --out <concepts.json>" +
                    " | generate-hand-labelled --out <dir> --font <Pretendard-Regular.ttf> | run-hand-labelled --corpus <dir> --out <runs.json>",
            )
            exitProcess(2)
        }
    }
}
