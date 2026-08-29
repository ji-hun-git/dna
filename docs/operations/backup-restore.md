# Backup and restore

**Status:** NOT IMPLEMENTED  
**Release effect:** blocks real-data private beta

The local PostgreSQL lifecycle is durable across an application reload, but durability is not backup or disaster recovery.

## Required production scope

- PostgreSQL schema/data and point-in-time recovery.
- Quarantine and approved source objects, versioning, and integrity manifests.
- Consent, audit, outbox/job state, deletion tombstones, and key metadata.
- Configuration and immutable release artifacts needed to reproduce the service.

## Required synthetic drill

1. Create a fresh isolated environment from pinned artifacts.
2. Insert the synthetic identity→consent→document→record lifecycle.
3. Produce encrypted database/object backups and integrity manifests.
4. Destroy only the drill environment after exact target verification.
5. Restore into a second isolated environment.
6. Verify record/provenance/audit consistency and session invalidation policy.
7. Replay deletion tombstones and prove deleted content does not reappear.
8. Record achieved RPO/RTO, hashes, operator, failures, and corrective actions.

No RPO/RTO is approved and no drill evidence exists. Documentation alone cannot move this gate to PASS.
