package kr.co.genomecompanion.consentpurpose.adapter.out.jdbc

import com.fasterxml.jackson.databind.ObjectMapper
import java.sql.ResultSet
import java.util.UUID
import kr.co.genomecompanion.consentpurpose.api.ConsentOperation
import kr.co.genomecompanion.consentpurpose.api.ConsentPurpose
import kr.co.genomecompanion.consentpurpose.api.ConsentRepository
import kr.co.genomecompanion.consentpurpose.api.DataCategory
import kr.co.genomecompanion.consentpurpose.api.DataSource
import kr.co.genomecompanion.consentpurpose.domain.ConsentGrant
import kr.co.genomecompanion.identityaccount.api.DataRegion
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Repository

@Repository
@ConditionalOnBean(JdbcTemplate::class)
class ConsentJdbcRepository(
    private val jdbc: JdbcTemplate,
    private val mapper: ObjectMapper,
) : ConsentRepository {
    override fun insert(grant: ConsentGrant): ConsentGrant {
        jdbc.update(
            """insert into consent_grant
                (consent_id,subject_id,subject_digest,purpose,sources,data_categories,operations,recipients,region,processor_set_version,notice_version,granted_at,expires_at,revoked_at,signature_receipt)
                values (?,?,?,?,cast(? as jsonb),cast(? as jsonb),cast(? as jsonb),cast(? as jsonb),?,?,?,?,?,?,?)""".trimIndent(),
            *parameters(grant),
        )
        return grant
    }

    override fun save(grant: ConsentGrant): ConsentGrant {
        val updated = jdbc.update(
            "update consent_grant set revoked_at=?, signature_receipt=? where consent_id=? and subject_id=?",
            grant.revokedAt?.let(java.sql.Timestamp::from), grant.signatureReceipt, grant.consentId, grant.subjectId,
        )
        check(updated == 1) { "consent row changed unexpectedly" }
        return grant
    }

    override fun findByIdForSubject(consentId: UUID, subjectId: String): ConsentGrant? =
        jdbc.query(
            "select * from consent_grant where consent_id=? and subject_id=?",
            { row, _ -> map(row) }, consentId, subjectId,
        ).singleOrNull()

    override fun listBySubject(subjectId: String): List<ConsentGrant> =
        jdbc.query(
            "select * from consent_grant where subject_id=? order by granted_at desc",
            { row, _ -> map(row) }, subjectId,
        )

    private fun parameters(grant: ConsentGrant): Array<Any?> = arrayOf(
        grant.consentId, grant.subjectId, grant.subjectDigest, grant.purpose.name,
        json(grant.sources.map { it.name }.sorted()), json(grant.dataCategories.map { it.name }.sorted()),
        json(grant.operations.map { it.name }.sorted()), json(grant.recipients.sorted()), grant.region.name,
        grant.processorSetVersion, grant.noticeVersion, java.sql.Timestamp.from(grant.grantedAt),
        grant.expiresAt?.let(java.sql.Timestamp::from), grant.revokedAt?.let(java.sql.Timestamp::from), grant.signatureReceipt,
    )

    private fun json(value: Any): String = mapper.writeValueAsString(value)

    private fun map(row: ResultSet) = ConsentGrant(
        row.getObject("consent_id", UUID::class.java), row.getString("subject_id"), row.getString("subject_digest"),
        ConsentPurpose.valueOf(row.getString("purpose")), sources(row.getString("sources")),
        categories(row.getString("data_categories")),
        operations(row.getString("operations")),
        mapper.readTree(row.getString("recipients")).map { it.asText() }.toSet(), DataRegion.valueOf(row.getString("region")),
        row.getString("processor_set_version"), row.getString("notice_version"), row.getTimestamp("granted_at").toInstant(),
        row.getTimestamp("expires_at")?.toInstant(), row.getTimestamp("revoked_at")?.toInstant(), row.getString("signature_receipt"),
    )

    private fun sources(json: String): Set<DataSource> {
        val result = linkedSetOf<DataSource>()
        val values = mapper.readTree(json).elements()
        while (values.hasNext()) result.add(DataSource.valueOf(values.next().asText()))
        return result
    }

    private fun categories(json: String): Set<DataCategory> {
        val result = linkedSetOf<DataCategory>()
        val values = mapper.readTree(json).elements()
        while (values.hasNext()) result.add(DataCategory.valueOf(values.next().asText()))
        return result
    }

    private fun operations(json: String): Set<ConsentOperation> {
        val result = linkedSetOf<ConsentOperation>()
        val values = mapper.readTree(json).elements()
        while (values.hasNext()) result.add(ConsentOperation.valueOf(values.next().asText()))
        return result
    }
}
