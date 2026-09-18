package kr.co.genomecompanion.platform

import org.springframework.boot.ApplicationArguments
import org.springframework.boot.ApplicationRunner
import org.springframework.boot.SpringApplication
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.context.ConfigurableApplicationContext
import org.springframework.stereotype.Component
import kotlin.system.exitProcess

/** `--gc.migrate-only=true`: Flyway has already run when this executes; stop the context and exit 0. Used by the CI replay job. */
@Component
@ConditionalOnProperty(name = ["gc.migrate-only"], havingValue = "true")
class MigrateOnlyRunner(private val context: ConfigurableApplicationContext) : ApplicationRunner {
    override fun run(args: ApplicationArguments) {
        val code = SpringApplication.exit(context, { 0 })
        exitProcess(code)
    }
}
