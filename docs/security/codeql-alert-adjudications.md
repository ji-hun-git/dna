# CodeQL alert adjudications

This register records reviewed CodeQL findings that look security-sensitive but do not represent the queried weakness. It does not suppress other rules or paths.

## CSRF configuration boundaries

CodeQL reports `java/spring-disabled-csrf-protection` at three filter chains.

- `/api/foundation/**` uses an `HttpOnly`, `Secure`, `SameSite=Strict` session cookie, then independently requires the exact configured `Origin` and a high-entropy `X-GC-CSRF` value whose SHA-256 is bound to the server-side session for every POST, PUT, PATCH, and DELETE. Denials are audited. Spring's default CSRF mechanism is disabled because this explicit fail-closed mechanism owns the boundary.
- `/internal/document-boundary/**` has no browser session or cookie authentication. Every request requires a bounded worker identity header plus a separate per-job lease capability; the chain is stateless and CORS is disabled.
- `/v1/**` is a stateless OAuth2 resource server that authenticates only an `Authorization: Bearer` JWT. It does not authenticate with ambient browser cookies.

The alerts are false positives for these specific chains. Adding cookie authentication to either stateless chain, weakening the foundation origin/header check, or moving a browser endpoint under these matchers invalidates this adjudication and requires CSRF redesign.

## PKCE S256

CodeQL reports `js/insufficient-password-hash` for the OAuth transaction test. The value is not a human password: it is a fresh 32-byte random, five-minute, single-use PKCE code verifier. OAuth PKCE requires the S256 challenge to be an unkeyed SHA-256 digest. The transaction also stores only SHA-256 digests of the high-entropy state, nonce, and verifier, compares them in constant time, and rejects expiry and replay.

This finding is a false positive. Reusing this helper for user passwords or low-entropy authentication secrets is prohibited and would invalidate the adjudication.
