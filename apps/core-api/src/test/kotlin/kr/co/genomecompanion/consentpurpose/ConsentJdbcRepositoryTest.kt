package kr.co.genomecompanion.consentpurpose

import com.fasterxml.jackson.databind.ObjectMapper
import java.time.Instant
import java.util.UUID
import javax.sql.DataSource as JdbcDataSource
import kr.co.genomecompanion.consentpurpose.adapter.out.jdbc.ConsentJdbcRepository
import kr.co.genomecompanion.consentpurpose.api.ConsentOperation
import kr.co.genomecompanion.consentpurpose.api.ConsentPurpose
import kr.co.genomecompanion.consentpurpose.api.DataCategory
import kr.co.genomecompanion.consentpurpose.api.DataSource
import kr.co.genomecompanion.consentpurpose.domain.ConsentGrant
import kr.co.genomecompanion.identityaccount.api.DataRegion
import kr.co.genomecompanion.platform.outbox.OutboxEvent
import kr.co.genomecompanion.platform.outbox.OutboxJdbcRepository
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.core.io.ClassPathResource
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.jdbc.datasource.DriverManagerDataSource
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator
import org.testcontainers.containers.PostgreSQLContainer
import org.testcontainers.junit.jupiter.Container
import org.testcontainers.junit.jupiter.Testcontainers

@Testcontainers(disabledWithoutDocker = true)
class ConsentJdbcRepositoryTest {
    private lateinit var repository: ConsentJdbcRepository
    private lateinit var outbox: OutboxJdbcRepository

    @BeforeEach
    fun setUp() {
        val dataSource: JdbcDataSource = DriverManagerDataSource(postgres.jdbcUrl, postgres.username, postgres.password)
        val jdbc = JdbcTemplate(dataSource)
        jdbc.execute("drop table if exists platform_outbox")
        jdbc.execute("drop table if exists consent_grant")
        ResourceDatabasePopulator(ClassPathResource("db/migration/V2__fnd_consent_and_outbox.sql")).execute(dataSource)
        repository = ConsentJdbcRepository(jdbc, ObjectMapper())
        outbox = OutboxJdbcRepository(jdbc)
    }

    @Test
    fun `reads are subject scoped and outbox event is idempotent`() {
        val grant = grant("subject-17")
        repository.insert(grant)
        assertThat(repository.findByIdForSubject(grant.consentId, "subject-17")).isEqualTo(grant)
        assertThat(repository.findByIdForSubject(grant.consentId, "subject-18")).isNull()
        assertThat(repository.listBySubject("subject-18")).isEmpty()

        val event = OutboxEvent(UUID.randomUUID(), "consent.revoked.v1", grant.consentId, "{}", grant.grantedAt)
        assertThat(outbox.insert(event)).isTrue()
        assertThat(outbox.insert(event)).isFalse()
    }

    private fun grant(subject: String) = ConsentGrant(
        UUID.randomUUID(), subject, "hmac256:" + "a".repeat(64), ConsentPurpose.BUILD_PERSONAL_LAB_TIMELINE,
        setOf(DataSource.USER_UPLOAD), setOf(DataCategory.LAB_REPORT),
        setOf(ConsentOperation.COLLECT, ConsentOperation.EXPLAIN), setOf("genome-companion-korea"),
        DataRegion.KR, "kr-core-2026-08", "privacy-notice-ko-v1", Instant.parse("2026-08-09T00:00:00Z"),
        null, null, "sha256:" + "b".repeat(64),
    )

    companion object {
        @Container
        @JvmStatic
        val postgres = PostgreSQLContainer("postgres:17.6-alpine")
    }
}
