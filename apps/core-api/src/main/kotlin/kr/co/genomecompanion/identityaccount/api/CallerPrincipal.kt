package kr.co.genomecompanion.identityaccount.api

enum class DataRegion { KR }

data class CallerPrincipal(
    val subjectId: String,
    val scopes: Set<String>,
    val region: DataRegion = DataRegion.KR,
)
