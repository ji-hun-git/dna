package kr.co.genomecompanion.documentboundary

import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/**
 * The worker proves its id with an HMAC keyed by sha256(credential): core holds only that digest and
 * can verify without the raw secret.
 *
 * Why the digest and not the credential itself is the key: the credential is the only secret the two
 * sides share, but core deliberately stores just its SHA-256 (so a database or configuration leak
 * never yields a usable credential). Keying the MAC with the digest keeps that property — verification
 * needs exactly what core already holds — while still binding the worker id to possession of the
 * credential, since only a holder of the credential can derive the digest in the first place. A
 * credential alone would otherwise let any holder claim *any* worker id, and with it that id's
 * per-worker budget and audit attribution.
 *
 * This object lives in the shared boundary package so the worker and core compute the same value from
 * one implementation; a second copy on either side would be a silent protocol fork.
 */
object WorkerIdentity {
    fun credentialDigest(credential: String): String = hex(
        MessageDigest.getInstance("SHA-256").digest(credential.toByteArray(StandardCharsets.UTF_8)),
    )

    fun mac(credential: String, workerId: String): String = macFromCredentialDigest(credentialDigest(credential), workerId)

    fun macFromCredentialDigest(credentialDigestHex: String, workerId: String): String {
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(credentialDigestHex.toByteArray(StandardCharsets.US_ASCII), "HmacSHA256"))
        return hex(mac.doFinal(workerId.toByteArray(StandardCharsets.UTF_8)))
    }

    private fun hex(bytes: ByteArray): String = bytes.joinToString("") { byte -> "%02x".format(byte.toInt() and 0xff) }
}
