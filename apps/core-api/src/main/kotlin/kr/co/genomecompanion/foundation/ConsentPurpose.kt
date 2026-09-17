package kr.co.genomecompanion.foundation

/**
 * The purposes a person can consent to, one row each in gc_consent_grant.
 *
 * Only DOCUMENT_EXTRACTION is ever read by the lifecycle (see FoundationRepository.findConsentStatus).
 * RESEARCH_USE, RESEARCH_CONTACT and PROJECT:* are stored so the person can see and withdraw them;
 * no server behaviour depends on them. There is no research pipeline and no contact channel.
 */
object ConsentPurpose {
    const val DOCUMENT_EXTRACTION = "DOCUMENT_EXTRACTION"
    const val RESEARCH_USE = "RESEARCH_USE"
    const val RESEARCH_CONTACT = "RESEARCH_CONTACT"
    const val PROJECT_PREFIX = "PROJECT:"

    /** The fixed purposes in the order the list endpoint reports them. PROJECT purposes follow, sorted. */
    val FIXED_ORDER: List<String> = listOf(DOCUMENT_EXTRACTION, RESEARCH_USE, RESEARCH_CONTACT)

    private val pattern = Regex("^(DOCUMENT_EXTRACTION|RESEARCH_USE|RESEARCH_CONTACT|PROJECT:[a-z0-9-]{1,40})$")

    fun isValid(purposeCode: String): Boolean = pattern.matches(purposeCode)

    fun policyVersion(purposeCode: String): String = when {
        purposeCode == DOCUMENT_EXTRACTION -> "foundation-v1"
        purposeCode == RESEARCH_USE -> "research-consent-policy.v1"
        purposeCode == RESEARCH_CONTACT -> "research-contact-policy.v1"
        isValid(purposeCode) && purposeCode.startsWith(PROJECT_PREFIX) -> "project-consent-policy.v1"
        else -> throw FoundationBadRequestException("consent_purpose_invalid")
    }
}
