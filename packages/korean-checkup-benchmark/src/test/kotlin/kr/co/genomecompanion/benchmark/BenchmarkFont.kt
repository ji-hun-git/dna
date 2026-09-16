package kr.co.genomecompanion.benchmark

import java.nio.file.Path


/** Pretendard (OFL) as installed by pnpm; override with GC_PRETENDARD_TTF. Tests are skipped when it is absent. */
object BenchmarkFont {
    fun path(): Path = Path.of(
        System.getenv("GC_PRETENDARD_TTF")
            ?: "../../apps/web/node_modules/pretendard/dist/public/static/alternative/Pretendard-Regular.ttf",
    )
}
