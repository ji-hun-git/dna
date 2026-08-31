# Key and credential rotation

**Production status:** NOT IMPLEMENTED

## Key purposes

| Purpose | Current representation | Production requirement |
|---|---|---|
| OIDC provider/client credentials | disabled environment placeholders | secret manager, owner, expiry, test/live separation, emergency revoke |
| Workload JWT signing | Ed25519 issuer and signed JWKS ceremony artifacts | KMS/HSM-backed key, overlap window, `kid` publication, rollback |
| Subject pseudonymization | HMAC key environment input | separate KMS key, versioned digest strategy, controlled re-key migration |
| Session/CSRF | random opaque values; hashes in DB | rotation/invalidation operation and session-store retention |
| Database/object encryption | platform design only | KMS envelope encryption and independent role/key policies |
| DataON/AIDA/public-data keys | disabled | separate research secret boundary; never shared with PHI plane |

## Rotation acceptance criteria

- New key is generated outside logs/repository/chat and scoped to one purpose.
- Dual-key verification is time-bounded where continuity requires it.
- New writes use the new key; old key use is observable.
- Emergency revocation invalidates dependent sessions/tokens/jobs.
- Rollback does not restore a compromised key.
- Synthetic rotation drill proves service continuity and audit evidence.

The Python JWKS ceremony/release tests validate document shape and signatures locally. They do not prove production custody, KMS policy, operator separation, or completed rotation.
