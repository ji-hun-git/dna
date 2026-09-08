package kr.co.genomecompanion.foundation

import org.apache.catalina.util.ServerInfo
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class TomcatRuntimeVersionTest {
    @Test
    fun runtimeUsesThePublishedTomcatSecurityFix() {
        // 10.1.58 contained the fixes but its release vote failed. Use published 10.1.59.
        assertThat(ServerInfo.getServerInfo()).isEqualTo("Apache Tomcat/10.1.59")
    }
}
