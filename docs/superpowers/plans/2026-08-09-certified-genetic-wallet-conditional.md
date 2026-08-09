# Certified Genetic Wallet — Conditional Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to execute this plan task by task. Do not begin mobile implementation until the Task 1 G0 verifier passes against the production envelope.

**Goal:** Add an optional, device-only wallet that imports, verifies, stores, explains, recalls, exports, recovers, and deletes narrowly approved result codes from an approved Korean laboratory without uploading raw or derived genetic data.

**Conditional status:** This workstream is post-MVP and blocked by Entry Gate G0. Governance tooling may be built before approval; Tasks 2–9 may start only when CI verifies the immutable production G0 envelope and its protected digest.

**Architecture:** A certified laboratory gives the user a compact Ed25519 JWS. The app resolves the globally unique, purpose-scoped `kid` from a signed offline safety bundle, verifies the exact compact-JWS signing bytes, then strictly parses and authorizes the verified payload against an exact G0 tuple. The original signed JWS and verified projections live in a genetics-only SQLCipher vault. Explanations are deterministic joins to signed Korean knowledge entries. Safety data arrives only inside the signed app release or through a user-selected `.gcsafety` file. The mobile binary has no Internet permission, no network client, and no genetic server API.

**Tech Stack:** Flutter **3.44.7**, Dart SDK **`>=3.12.0 <4.0.0`**, Android application ID/iOS bundle identifier **`kr.co.genomecompanion.mobile`**, Riverpod and Drift versions already locked by the product-experience workstream, `sqlite3` **3.5.1** built with `source: sqlcipher`, `flutter_secure_storage` **11.0.0**, Dart `cryptography` **2.9.0**, Python **3.12.13**, uv **0.12.3**, Python `cryptography` **50.0.0**, `jsonschema` **4.26.0**, `pytest` **9.1.1**, JSON Schema 2020-12, compact JWS with Ed25519/`EdDSA`, DSSE with Ed25519, Flutter test, Android instrumentation, and iOS XCTest.

## Non-negotiable boundaries

- G0 authorizes only exact tuples. Wildcards, prefixes, lab-wide permission, “similar result” matching, and runtime expansion are forbidden.
- Only compact, laboratory-certified result codes are accepted. VCF, BCF, BAM, CRAM, FASTQ, FASTA, genotypes, variants, imputation, polygenic scores, disease-risk prediction, pharmacogenomics, diagnosis, prescribing, medication advice, family inference, and probabilistic model output are prohibited.
- Genetic result bytes, derived profiles, subject-binding values, import events, trait/result codes, explanations, and searches never enter HTTP, DNS, analytics, crash reporting, logs, URLs, push notifications, clipboard, OS search indexes, cloud backup, or support uploads.
- There is no genetic endpoint. Safety bundles are app-release assets or explicit user-selected signed side-loads only. The genetics dependency graph exposes no HTTP client. Android declares no `INTERNET` permission; iOS release evidence includes packet-capture and dependency/symbol review because iOS has no equivalent deny-network entitlement.
- The app never parses the result payload to choose a key. It parses only the bounded compact-JWS protected header, resolves a globally unique purpose-scoped `kid`, verifies the signature, and only then parses and authorizes the payload.
- A stale safety bundle suppresses interpretation only. It never blocks provenance display, export of the original signed JWS, recovery export, or deletion. Effective signed recalls remain enforced even after the bundle later expires.
- Recalled or superseded results retain encrypted signed provenance until the user deletes the wallet. A result recall can hide the result value and explanation, but cannot silently erase the signed source or prevent export.
- The genetics vault and lifecycle use a distinct secure-storage namespace and key. No genetics operation may delete, rotate, reset, or overwrite the ordinary record-vault key.
- No implementation claim promises memory zeroization, complete screenshot prevention on iOS, deletion of an external file created by the OS share sheet, or recovery without a user-created recovery archive. Those limitations are disclosed in Korean before the relevant action.

## Exact trust and data flows

```text
Production G0 envelope (7 role signatures + artifact hashes)
  -> CI verifies protected envelope digest and exact authorized tuples
  -> app build embeds a signed safety bundle and sequence floor

User-selected certified result JWS
  -> bounded ASCII stream (262,144-byte hard cap)
  -> strict protected header (alg, typ, kid only)
  -> global kid lookup for purpose=lab-result
  -> signature verification over the original encoded segments
  -> strict generated payload parser
  -> lab/key/time/subject checks
  -> exact G0 tuple match
  -> atomic SQLCipher transaction retaining original compact JWS

Verified local result + active signed knowledge entry
  -> deterministic exact tuple join
  -> Korean explanation with provenance, uncertainty, and citations
```

## Stable on-device formats

### Certified result JWS

- Maximum file size: **262,144 bytes**, including trailing newline; one trailing `LF` is permitted and stripped, all other whitespace is rejected.
- Compact JWS protected header has exactly three members: `alg="EdDSA"`, a `kid` matching `^gclr_[A-Za-z0-9_-]{16,64}$` (for tests, `gclr_example_release_key_0001`), and `typ="GC-CERTIFIED-RESULT+JWS"`. `crit`, `jku`, `jwk`, `x5u`, `x5c`, `zip`, unprotected headers, padding, and unknown members are rejected.
- `kid` matches `^gclr_[A-Za-z0-9_-]{16,64}$` and is globally unique across every active, retired, revoked, and historical key in a safety bundle.
- Payload schema `CertifiedGeneticResultV1` contains exactly:
  `schemaVersion`, `bundleId` (canonical lowercase UUIDv4), `labId`, `certification`, `assayVersion`, `subjectBinding`, `provisioningChallengeId`, `issuedAt` (offset-aware RFC 3339), nullable `supersedesBundleId`, and `results` (1–64 unique entries).
- Each result contains exactly `traitCode`, `resultCode`, and `labReportRef`. No numeric measurement, variant, allele, confidence, free text, or unapproved field is accepted.
- The exact authorization tuple is:
  `{labId, certification, authorizationValidFrom, authorizationValidUntil, assayVersion, resultSchemaVersion, traitCode, resultCode, copyId, knowledgeEntryId}`.
  `resultSchemaVersion` is compared byte-for-byte to `CertifiedGeneticResultV1.schemaVersion` from the verified payload; there is no alias, coercion, or default. Every result in one payload must match one and only one G0 tuple in full, and the signed result `issuedAt` must fall inside that tuple's closed authorization-validity window.

### Subject binding `GC-SB-1`

- For each local profile, generate a 32-byte `bindingSecret` with the platform CSPRNG and a canonical lowercase UUIDv4 `localProfileId`. Store the secret under the prefix `gc_genetic_subject_binding_secret_v1:` followed byte-for-byte by `localProfileId` in the `gc_genetic_vault` secure-storage namespace.
- Compute `bindingBytes = HMAC-SHA256(bindingSecret, UTF8("gc.subject-binding.v1\u0000" + localProfileId))`; encode as unpadded base64url and prefix `sb1_`. The decoded value must be exactly 32 bytes.
- Provisioning is explicit and out of band. The app creates a QR/text challenge comprising the literal prefix `GC-SB1:` followed by unpadded base64url of canonical JSON containing exactly `protocol="GC-SB-1"`, `challengeId` UUIDv4, `subjectBinding`, `issuedAt`, and `expiresAt` no more than 24 hours later. It stores the pending challenge encrypted. The user presents it through the laboratory's approved channel; the laboratory copies `subjectBinding` and `provisioningChallengeId` into its signed result.
- Original imports (`supersedesBundleId=null`) require a matching, unexpired, unconsumed challenge. The transaction consumes the challenge. A correction (`supersedesBundleId!=null`) must carry the original bundle's same `provisioningChallengeId`, established subject binding, lab, and certification; the DB validates those exact values against the superseded row and does not look for a new pending challenge. A different or missing challenge ID fails closed.
- Compare decoded binding bytes with constant-time byte comparison. Never compare the encoded strings with `==`, normalize them, log them, or expose them in semantics.
- A second device requires a separate laboratory provisioning or an explicit recovery archive. Reinstall without a recovery archive has no recovery path. Recovery restores the secret only inside a newly generated device vault key after passphrase and device reauthentication. Account/profile switching closes the current vault and opens a profile-scoped vault; imports for another profile fail binding before any result is shown.

### Genetics keys and lifecycle state

- SQLCipher key name: prefix `gc_genetic_wallet_key_v1:` followed byte-for-byte by the canonical local profile UUID.
- Binding secret name: prefix `gc_genetic_subject_binding_secret_v1:` followed byte-for-byte by the canonical local profile UUID.
- Safety anti-rollback key name: `gc_genetic_safety_anchor_key_v1`.
- Namespace/service: `gc_genetic_vault`; iOS accessibility is `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`, synchronizable is false; Android uses hardware-backed Keystore when available and excludes all values from backup.
- `GeneticVaultCoordinator` is the only key/database owner. A per-profile async mutex serializes open, import, recovery, migration, export snapshot, account switch, and destruction. States are `closed -> opening -> open -> destroying -> destroyed` or `failedClosed`. New work is rejected after `destroying`; destruction waits for the current transaction, closes DB/WAL/SHM handles, removes files, deletes both profile secrets, invalidates in-memory handles, and never auto-recreates a key.
- Key corruption or migration failure enters `failedClosed`; it never calls `deleteAll`, resets the record vault, generates a replacement genetics key, or converts ciphertext to plaintext.

### Offline safety bundle

The app consumes one DSSE envelope with payload type `application/vnd.genome-companion.genetics-safety.v1+json`. It is present at `apps/mobile/assets/genetics/safety-bundle.dsse.json`; a user may select the same envelope with extension `.gcsafety`. No updater schedules, polls, or performs a network request.

The strict payload `GeneticSafetyBundleV1` contains exactly:

- `schemaVersion="1.0"`, canonical UUIDv4 `bundleId`, positive integer `sequence`, `issuedAt`, `validFrom`, `validUntil`, `rootSetId`, `g0EnvelopeDigest`, `authorizationDigest`, and `contentAuthorizationDigest`;
- `labKeys[]`: the complete append-only key history. Each entry has globally unique `kid`, `purpose="lab-result"`, Ed25519 public key, `labId`, `certification`, `notBefore`, `notAfter`, status `active|retired|revoked`, nullable `retiredAt`, nullable `revokedAt`, and `issuanceNotAfter`;
- `knowledgeEntries[]`: `knowledgeEntryId`, `copyId`, exact tuple fields, Korean title/explanation/uncertainty/population-applicability, and 1–8 citations with HTTPS URL, title, publisher, retrieval date, and evidence version. Its computed canonical content digest must be present in generated G0 authorization; matching IDs with changed bytes are rejected;
- `supportCopies[]`: `supportCopyId`, exact Korean text, and an approved non-network support route such as laboratory telephone/display text. Its canonical digest must be present in generated G0 authorization; arbitrary URL/action schemes and changed text under the same ID are rejected;
- `resultRecalls[]`: UUIDv4 `noticeId`, target exactly one of a domain-separated `bundleIdDigest`, `kid`, or full authorization tuple; `reasonCode` exactly one of `lab-correction|key-compromise|authorization-withdrawn|assay-quality|administrative-error`; `effectiveAt`; action `suppress-result|mark-superseded|require-lab-contact`; nullable `replacementBundleIdDigest`; and nullable G0-approved `supportCopyId`. `mark-superseded` requires only `replacementBundleIdDigest`; `require-lab-contact` requires only `supportCopyId`; other combinations are invalid;
- `knowledgeRecalls[]`: UUIDv4 `noticeId`, target exactly one of `knowledgeEntryId` or `copyId`; `reasonCode` exactly one of `evidence-update|translation-correction|authorization-withdrawn|scientific-recall`; `effectiveAt`; and the sole action `suppress-interpretation`. Replacement copy cannot enter a safety side-load: it requires a new seven-role G0 envelope, generated content digest, app build, and then a new signed safety bundle;
- optional `nextRootSet`: new `rootSetId`, 2–5 Ed25519 roots, threshold at least 2, and `activateAtSequence >= sequence + 1`.

Safety envelopes require the current root set's threshold of distinct valid DSSE Ed25519 signatures. The payload is canonical restricted JSON: UTF-8, NFC strings, lexicographically sorted object keys, integers only, no floats, duplicate keys, or insignificant whitespace. DSSE pre-authentication encoding is exactly `DSSEv1 SP len(payloadType) SP payloadType SP len(payload) SP payload` with byte lengths. The three G0/authorization digests must equal the build-generated constants before any key, copy, or recall is installed.

Overlapping effective recalls use a closed, deterministic policy. For results, `suppress-result` outranks `require-lab-contact`, which outranks `mark-superseded`; every knowledge recall has the same `suppress-interpretation` action. All notices remain in provenance, but only the most restrictive result action renders. Two applicable `mark-superseded` notices with different replacement digests or two applicable `require-lab-contact` notices with different support copy IDs invalidate the candidate bundle before installation. The UI uses one fixed G0-approved generic recall label; it never guesses a reason from competing codes.

Key rules are exact:

- `active`: is the only status that may authorize a newly user-selected certified-result file. Its verified result `issuedAt` must be in `[notBefore, min(notAfter, issuanceNotAfter)]`.
- `retired`: never authorizes a new file import, even if the JWS claims a pre-retirement `issuedAt`, because an app cannot distinguish a genuinely historical signature from a backdated one made by a retained private key. A row already anchored locally with `verifiedAt`, safety sequence/digest, and key status while active may remain displayable subject to current recalls; a recovery JWS may be cryptographically verified as provenance only. Neither path creates a newly displayable result from a newly selected file. The laboratory must reissue a legitimate late-arriving result under an active key.
- `revoked`: cannot verify any new import. Existing local bundles signed by the key receive the bundle's signed recall action or, if none exists, fail closed to provenance-only `key-revoked` state.
- A later sequence may add a key or move `active -> retired|revoked` and `retired -> revoked`; it may not omit a historical key, mutate its public key/lab/certification/time fields, reverse status, reuse `kid`, or relax an issuance window. Duplicate `kid`, a status/time contradiction, an unknown purpose, or one key attached to different lab/certification values invalidates the entire safety bundle.
- If the last validly signed bundle is now past `validUntil`, a key still marked `active` in that bundle may authenticate a result issued no later than that signed `validUntil` and inside all key/G0 windows; the result is marked `safety-stale`, while interpretation is unavailable. A retired/revoked key still cannot authorize a new file. The stale bundle cannot authorize a result or correction issued after `validUntil`.

The secure anti-rollback anchor is canonical `{sequence,bundleDigest,rootSetId,maxObservedUtc}` plus HMAC-SHA256 under `gc_genetic_safety_anchor_key_v1`. The app-release asset defines `minimumSafetySequence`. A side-load is accepted only if its sequence is at least the app floor and anchor; an equal sequence must have the same digest. Root transition is two phase: a threshold-signed current bundle announces `nextRootSet`, persistence records it, and only a later bundle at or after `activateAtSequence` may be verified by the new set. Fresh installs receive the current roots and floor from the signed app release.

At first install, verify the embedded bundle before seeding `maxObservedUtc = max(wallUtc, embeddedBundle.issuedAt)`; if wall UTC is earlier than the signed `validFrom - 5 minutes`, enter rollback state. At every later process start, capture wall UTC and monotonic time and update `maxObservedUtc` only upward after verifying the anchor. While the process lives, compare wall progress with monotonic progress; if wall UTC moves backward by more than five minutes, or a later boot reports UTC earlier than `maxObservedUtc - 5 minutes`, enter `clock-rollback` provenance-only state. In that state, result import, side-load activation, and all interpretation fail closed; provenance export, recovery export, and deletion remain available. Already-effective recalls stay applied, and any notice whose `effectiveAt <= maxObservedUtc` is treated as effective, so clock rollback cannot postpone it. Restoring interpretation requires a signed app release with a higher safety floor or a signed side-load whose issuance/validity can be evaluated at a wall clock at least `maxObservedUtc`; the anchor never decrements.

Crash-safe update order is: bound/read candidate -> strict parse envelope -> verify current threshold -> validate schema/times/keys/recalls against the protected clock -> write candidate and digest to an app-private pending file -> `fsync` -> transactionally apply knowledge and effective recalls -> write and verify the protected sequence/clock anchor -> atomically rename candidate as active -> remove pending. Startup reconciles the maximum of app floor, protected anchor, DB sequence, active, and pending; any missing or conflicting artifact enters provenance-only `safety-state-inconsistent` and never rolls back.

## File map

```text
governance/genetics/
  trusted-approvers.json
  g0-control-manifest.payload.json
  gates/g0/${GENETICS_G0_GATE_ID}.dsse.json
governance/genetics/evidence/g0-01-lab-legal.pdf
governance/genetics/evidence/g0-02-authorized-tuples-and-copy-policy.json
governance/genetics/evidence/g0-03-prohibited-scope.md
governance/genetics/evidence/g0-04-key-ceremony.json
governance/genetics/evidence/g0-05-science-recall-governance.pdf
governance/genetics/evidence/g0-06-mobile-threat-model.md
governance/genetics/evidence/g0-07-business-accessibility.pdf
.github/CODEOWNERS
.github/dependabot.yml
.github/workflows/ci.yml
.github/workflows/release.yml
docs/open-source/approved-oss-register.md
packages/contracts/jsonschema/
  certified-genetic-result.schema.json
  genetic-safety-bundle.schema.json
packages/contracts/genetics/
  g0-authorized-tuples.json
  g0-authorized-content.json
  g0-release-trust.json
scripts/governance/
  genetics_g0_policy.py
  canonical_json.py
  dsse.py
  build_g0_signing_request.py
  assemble_g0_envelope.py
  verify_genetics_g0.py
  render_genetic_authorization.py
  render_genetic_content_authorization.py
  render_genetic_trust_bootstrap.py
  export_genetics_tooling_licenses.py
  test_genetics_g0.py
tooling/genetics/
  pyproject.toml
  uv.lock
  license-policy.json
scripts/contracts/
  generate_genetic_dart.py
  check_genetic_generation.py
  test_genetic_contracts.py
scripts/genetics/
  build_safety_signing_request.py
  assemble_safety_envelope.py
  verify_safety_bundle.py
  test_safety_bundle.py
apps/mobile/assets/genetics/
  safety-bundle.dsse.json
apps/mobile/pubspec.yaml
apps/mobile/pubspec.lock
apps/mobile/lib/app.dart
apps/mobile/lib/vault/database.dart
apps/mobile/lib/features/genetics/
  domain/certified_result.g.dart
  domain/genetic_safety_bundle.g.dart
  crypto/genetic_release_roots.g.dart
  crypto/strict_compact_jws.dart
  crypto/dsse_verifier.dart
  crypto/genetic_trust_store.dart
  binding/subject_binding.dart
  data/genetic_vault_coordinator.dart
  data/genetic_wallet_database.dart
  data/genetic_importer.dart
  safety/safety_bundle_updater.dart
  safety/recall_policy.dart
  rules/local_genetic_explainer.dart
  lifecycle/genetic_archive.dart
  lifecycle/genetic_reauthentication.dart
  lifecycle/genetic_wallet_lifecycle.dart
  presentation/import_screen.dart
  presentation/wallet_screen.dart
  presentation/trait_detail_screen.dart
apps/mobile/android/app/src/main/kotlin/kr/co/genomecompanion/mobile/GeneticPrivacyPlugin.kt
apps/mobile/android/app/src/androidTest/kotlin/kr/co/genomecompanion/mobile/GeneticPrivacyPluginTest.kt
apps/mobile/android/app/src/main/AndroidManifest.xml
apps/mobile/android/app/src/main/res/xml/backup_rules.xml
apps/mobile/android/app/src/main/res/xml/data_extraction_rules.xml
apps/mobile/android/app/build.gradle.kts
apps/mobile/android/gradle/verification-metadata.xml
apps/mobile/ios/Runner/GeneticPrivacyPlugin.swift
apps/mobile/ios/Runner/Info.plist
apps/mobile/ios/Runner/Runner.entitlements
apps/mobile/ios/Runner/PrivacyInfo.xcprivacy
apps/mobile/ios/RunnerTests/GeneticPrivacyPluginTests.swift
apps/mobile/test/features/genetics/
apps/mobile/integration_test/genetic_zero_egress_test.dart
security/tests/genetic_endpoint_deny.spec.ts
security/tests/genetic_release_permissions.ps1
security/tests/genetic_ci_contract_test.py
security/threat-models/genetic-wallet.md
security/sbom/genetics-governance.cdx.json
security/licenses/genetics-governance.json
ops/runbooks/genetic-result-recall.md
```

The following machine-readable block is the canonical seven-path set. The file map, G0 manifest `artifacts[].path`, builder, verifier, tests, CODEOWNERS rules, and Git staging commands must use these strings byte-for-byte and in this order.

GENETICS_G0_ARTIFACT_PATHS_BEGIN
```text
governance/genetics/evidence/g0-01-lab-legal.pdf
governance/genetics/evidence/g0-02-authorized-tuples-and-copy-policy.json
governance/genetics/evidence/g0-03-prohibited-scope.md
governance/genetics/evidence/g0-04-key-ceremony.json
governance/genetics/evidence/g0-05-science-recall-governance.pdf
governance/genetics/evidence/g0-06-mobile-threat-model.md
governance/genetics/evidence/g0-07-business-accessibility.pdf
```
GENETICS_G0_ARTIFACT_PATHS_END

## Task 1: Make Entry Gate G0 cryptographic and immutable

**Scope:** Governance tooling is the only work permitted before production G0 approval.

**Files:**

- Consume unchanged: `supply-chain/tool-artifacts.lock.json`, `scripts/ci/install_uv.py`, `scripts/ci/run_locked_uv.py`, `scripts/tests/test_run_locked_uv.py`
- Create: `tooling/genetics/pyproject.toml`, `tooling/genetics/license-policy.json`
- Generate: `tooling/genetics/uv.lock`
- Create: `scripts/governance/genetics_g0_policy.py`, `scripts/governance/canonical_json.py`, `scripts/governance/dsse.py`, `scripts/governance/build_g0_signing_request.py`, `scripts/governance/assemble_g0_envelope.py`, `scripts/governance/g0_candidate_handoff.py`, `scripts/governance/verify_genetics_g0.py`, `scripts/governance/render_genetic_authorization.py`, `scripts/governance/render_genetic_content_authorization.py`, `scripts/governance/render_genetic_trust_bootstrap.py`, `scripts/governance/export_genetics_tooling_licenses.py`
- Test: `scripts/governance/test_genetics_g0.py`
- Create/review: `governance/genetics/evidence/g0-01-lab-legal.pdf`
- Create/review: `governance/genetics/evidence/g0-02-authorized-tuples-and-copy-policy.json`
- Create/review: `governance/genetics/evidence/g0-03-prohibited-scope.md`
- Create/review: `governance/genetics/evidence/g0-04-key-ceremony.json`
- Create/review: `governance/genetics/evidence/g0-05-science-recall-governance.pdf`
- Create/review: `governance/genetics/evidence/g0-06-mobile-threat-model.md`
- Create/review: `governance/genetics/evidence/g0-07-business-accessibility.pdf`
- Create: `governance/genetics/trusted-approvers.json`, `governance/genetics/g0-ceremony-inputs.json`, `governance/genetics/g0-control-manifest.payload.json`, `governance/genetics/gates/g0/${GENETICS_G0_GATE_ID}.dsse.json`
- Generate: `packages/contracts/genetics/g0-authorized-tuples.json`, `packages/contracts/genetics/g0-authorized-content.json`, `packages/contracts/genetics/g0-release-trust.json`
- Generate: `security/sbom/genetics-governance.cdx.json`, `security/licenses/genetics-governance.json`; `tooling/genetics/license-policy.json` permits only `0BSD`, `Apache-2.0`, `BSD-2-Clause`, `BSD-3-Clause`, `ISC`, `MIT`, `MPL-2.0`, `PSF-2.0`, and `Python-2.0`, with any package-specific override requiring package/version/metadata SHA-256 and three-owner approval
- Modify: `.github/CODEOWNERS`, `.github/dependabot.yml`

**Interfaces:**

- Consumes: the foundation-owned uv 0.12.3 artifact lock, verified installer, and `run_locked_uv.py` execution interface unchanged; the exact seven-path policy tuple, seven evidence files, trusted approver public keys, detached role signatures, protected `GENETICS_G0_GATE_ID`, `GENETICS_G0_TRUST_ROOT_SHA256`, `GENETICS_G0_ENVELOPE_SHA256`, `GENETICS_G0_CANDIDATE_COMMIT`, and clean evidence/tooling `sourceCommit`.
- Produces: append-only DSSE G0 envelope; immutable candidate-commit handoff; verified exact tuple/content/root bootstrap artifacts; deterministic governance SBOM/license inventory; `verify_gate(envelope_path: Path, expected_trust_digest: str, expected_envelope_digest: str) -> VerifiedGeneticsGate` or typed `GateError`; nonzero exit on any path, role, source/tool digest, candidate commit, timestamp, or signature disagreement.

**Production trust:** `trusted-approvers.json` maps seven globally unique Ed25519 `keyid` values to the exact roles `founder`, `legal`, `regulatory`, `security`, `science`, `laboratory`, and `accessibility`. Its SHA-256 is stored in protected `GENETICS_G0_TRUST_ROOT_SHA256`; `GENETICS_G0_ENVELOPE_SHA256` pins the envelope and `GENETICS_G0_CANDIDATE_COMMIT` pins the immutable protected candidate commit containing it. Private keys remain in role-owner HSM/offline signing custody and never enter the repository, CI, fixtures, or command output.

**Seven controls:** `G0-01` lab/legal/controller duties; `G0-02` exact tuple and Korean copy authorization; `G0-03` prohibited scope; `G0-04` lab and release-key ceremonies/SLAs; `G0-05` scientific evidence and recall governance; `G0-06` mobile threat model/support boundary; `G0-07` lead-wedge economics plus measurable accessibility acceptance. G0-07 requires WCAG 2.2 AA, body contrast >=4.5:1, large/non-text contrast >=3:1, minimum 44x44 logical-pixel targets, TalkBack and VoiceOver order/labels, no color-only state, reduced motion, Korean screen-reader review, and layout without clipping at 200% text.

The canonical manifest has exactly: `schemaVersion`, `gateId`, `status="approved"`, `approvedAt`, `expiresAt`, `sourceCommit`, `ceremonyInputsDigest`, `approvals[7]`, `controls[7]`, `artifacts[7]`, and sorted `authorizedTuples[]`. Every approval contains the exact `role`, trusted `keyid`, and canonical UTC `signedAt`; the matching DSSE signature must validate under that same key. Every control contains `controlId`, `ownerRoles`, `acceptanceCriteria`, and exactly one primary `artifactRef`. `artifacts[].path` must equal the canonical `GENETICS_G0_ARTIFACT_PATHS` block byte-for-byte and in order. G0-02's strict JSON contains the exact canonical tuples plus complete approved knowledge and support-copy objects. Each tuple has `tupleDigest = sha256(canonical exact ten-field tuple)`. Each knowledge authorization has `{knowledgeEntryId,copyId,tupleDigest,contentDigest}` where `contentDigest` hashes canonical title, explanation, uncertainty, population-applicability, and the complete ordered citation objects. Each support authorization has `{supportCopyId,contentDigest}` where the digest covers the exact Korean text and approved support route. IDs alone never authorize changed content. G0-04 is strict JSON containing the initial `rootSetId`, threshold, 2–5 globally unique Ed25519 release-root public keys, and `minimumSafetySequence`; it is the sole source for the generated app bootstrap. Governance and safety timestamps are canonical `YYYY-MM-DDTHH:MM:SSZ`; lab result timestamps must be RFC 3339 with an explicit offset. The envelope payload must byte-equal the deterministic builder output.

`g0-ceremony-inputs.json` is canonical restricted JSON exactly `{schemaVersion:"genetics-g0-ceremony-inputs.v1",sourceCommit,files,inputsDigest}`. `files` is a sorted unique list of `{path,blobSha256}` covering all seven evidence paths, `trusted-approvers.json`, `genetics_g0_policy.py`, canonical JSON/DSSE/builder/assembler/handoff/verifier/renderers/license exporter/tests, `tooling/genetics/{pyproject.toml,uv.lock,license-policy.json}`, the FND tool lock/installer/runner and runner test, CODEOWNERS, Dependabot, governance SBOM, and license inventory. Hashes are computed from exact `git show sourceCommit:path` bytes, never the caller worktree; `inputsDigest` hashes the object omitting only itself, and the manifest's `ceremonyInputsDigest` must byte-equal it. Missing/extra/dirty/untracked input, symlink/submodule, wrong blob, alternate tool, or source/tree mismatch invalidates the request and envelope.

- [ ] **Step 1: Create and freeze the dedicated Python governance toolchain**

```toml
# tooling/genetics/pyproject.toml
[project]
name = "genome-companion-genetics-governance"
version = "0.1.0"
requires-python = "==3.12.13"
dependencies = [
  "cryptography==50.0.0",
  "jsonschema==4.26.0",
]

[dependency-groups]
dev = ["pytest==9.1.1"]

[tool.uv]
package = false
preview-features = ["sbom-export"]

[tool.pytest.ini_options]
pythonpath = ["../.."]
markers = ["production_gate: requires the externally signed production G0 envelope and protected expected digests"]
```

Run from repository root:

```bash
python -c 'import sys; assert sys.version_info[:3] == (3, 12, 13)'
export UV_PYTHON_DOWNLOADS=never
python scripts/ci/run_locked_uv.py -- --version
python scripts/ci/run_locked_uv.py -- lock --project tooling/genetics --python 3.12.13
python scripts/ci/run_locked_uv.py -- sync --project tooling/genetics --frozen --all-groups
python scripts/ci/run_locked_uv.py -- lock --project tooling/genetics --check
```

`run_locked_uv.py` is the sole host execution interface in every later task/ceremony/CI block. It resolves the repository root, strict-validates the FND tool lock, invokes only `install_uv.py` into the fixed platform cache, rehashes the archive and installed binary, requires uv 0.12.3 plus host Python 3.12.13, clears caller uv/Python overrides, forces `UV_PYTHON_DOWNLOADS=never`, never mutates PATH, and executes only arguments after `--`. Expected: Python reports exactly `3.12.13`; `uv.lock` exists; the lock check succeeds; direct and transitive versions contain no floating constraint.

- [ ] **Step 2: Write RED tests for canonicalization, DSSE roles, paths, hashes, and tuples**

Tests create test-only Ed25519 keys and assert rejection of: six-of-seven roles; duplicate role/key; approval/signature key mismatch; unknown role; invalid signature; changed payload byte; fewer/more than seven primary artifacts; changed artifact; absolute/parent path; duplicate/non-sorted tuple; wildcard value; missing copy/knowledge ID; exact tuple/digest disagreement; changed Korean copy or citation under the same ID; changed support route/text; changed initial root byte/threshold/floor; naive/noncanonical timestamp; expired gate; non-`approved` status; changed artifacts or trusted tooling/lock/policy bytes since `sourceCommit`; dirty/untracked ceremony input; non-detached checkout; candidate parent/diff/handoff mismatch; protected trust-root digest mismatch; envelope digest mismatch; and a noncanonical payload.

Add `test_all_g0_path_declarations_are_identical`: parse the file-map evidence lines, Task 1 Files entries, and the block between `GENETICS_G0_ARTIFACT_PATHS_BEGIN` and `GENETICS_G0_ARTIFACT_PATHS_END`; import `FIXED_G0_ARTIFACT_PATHS` from `genetics_g0_policy.py`; load the manifest artifact paths; parse the seven CODEOWNERS entries; and inspect builder/verifier/test inputs, the explicit Git staging list, and both clean-source `git diff` path lists. Assert all are the same ordered seven-string tuple; changed spelling, extension, order, omission, or extra path fails.

```python
def test_gate_requires_all_seven_distinct_roles(tmp_path, test_signers):
    envelope = signed_gate(tmp_path, signers=test_signers[:-1])
    with pytest.raises(GateError, match="missing_role:accessibility"):
        verify_gate(envelope, expected_trust_digest=trust_digest(), expected_envelope_digest=sha256_file(envelope))

def test_artifact_change_invalidates_gate(tmp_path, complete_gate):
    complete_gate.artifact_path.write_text("changed", encoding="utf-8")
    with pytest.raises(GateError, match="artifact_digest_mismatch"):
        verify_gate(complete_gate.envelope, expected_trust_digest=complete_gate.trust_digest, expected_envelope_digest=complete_gate.envelope_digest)
```

- [ ] **Step 3: Run the RED governance tests**

Run: `python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python -m pytest scripts/governance/test_genetics_g0.py -q`

Expected: FAIL because the builder/verifier modules do not exist.

- [ ] **Step 4: Implement deterministic restricted JSON and DSSE primitives**

```python
# scripts/governance/genetics_g0_policy.py
FIXED_G0_ARTIFACT_PATHS = (
    "governance/genetics/evidence/g0-01-lab-legal.pdf",
    "governance/genetics/evidence/g0-02-authorized-tuples-and-copy-policy.json",
    "governance/genetics/evidence/g0-03-prohibited-scope.md",
    "governance/genetics/evidence/g0-04-key-ceremony.json",
    "governance/genetics/evidence/g0-05-science-recall-governance.pdf",
    "governance/genetics/evidence/g0-06-mobile-threat-model.md",
    "governance/genetics/evidence/g0-07-business-accessibility.pdf",
)
```

`canonical_json.py` recursively permits only null, booleans, bounded integers, arrays, and objects; rejects floats and duplicate keys at load; NFC-normalizes strings; sorts object keys; emits UTF-8 with no optional whitespace. `dsse.py` implements byte-length PAE and Ed25519 verification. Builder, verifier, renderer, and tests all import `FIXED_G0_ARTIFACT_PATHS`; no second source constant is allowed. `build_g0_signing_request.py` accepts `--source-commit`, requires a detached clean checkout whose `HEAD` equals that commit, reads every ceremony input with `git show sourceCommit:path`, regenerates/byte-compares `g0-ceremony-inputs.json`, hashes exactly the seven artifacts for `artifacts[]`, binds `ceremonyInputsDigest`, and emits the canonical payload plus PAE SHA-256. It never signs or accepts a caller working-tree override. `GENETICS_G0_GATE_ID` is a protected value matching `^g0-[0-9]{8}-[0-9]{4}$`. `assemble_g0_envelope.py` accepts the exact seven detached `{keyid,signature}` files, verifies them, sorts signatures by role/key, writes the append-only envelope inside that detached checkout, and refuses overwrite. `g0_candidate_handoff.py` creates/removes only a validated temporary worktree beneath `build/genetics-g0-worktrees`, enforces exact source/candidate parentage and a three-path candidate diff (`g0-ceremony-inputs.json`, payload, envelope), commits those bytes to protected `g0-candidate/${GENETICS_G0_GATE_ID}`, and emits the public immutable candidate-handoff record; it never pushes, signs, or reads a private key.

`g0_candidate_handoff.py` has only `verify-source`, `prepare`, `assemble-candidate`, `field`, and `verify-candidate`. `prepare` creates a detached temporary worktree at the exact source commit, generates the ceremony-input, payload, and request there, and removes it on every exit. `assemble-candidate` independently reloads the request and seven signatures, creates a new detached worktree, writes exactly the three generated paths, commits with sole parent `sourceCommit`, and emits strict public handoff `{schemaVersion:"genetics-g0-candidate-handoff.v1",gateId,sourceCommit,candidateCommit,trustRootSha256,envelopeSha256,paths,handoffSha256}`; it never pushes. `field` prints only one allowlisted scalar from a strict canonical handoff. `verify-candidate` uses `git show candidate:path`, proves parent/diff/path/blob/request/input/digest/signature agreement and refuses the caller worktree. Tests lose/remove each worktree, mutate each source/tool/signature/candidate/handoff byte, and prove cleanup plus deterministic candidate tree/commit metadata.

- [ ] **Step 5: Implement the strict production verifier and generated artifacts**

`verify_genetics_g0.py` requires both protected expected digests in CI, verifies the seven distinct trusted roles, aware timestamps, status/expiry/source commit, exactly seven control IDs, all artifact hashes, unique exact tuples/content digests, strict G0-04 root policy, and canonical payload bytes. `render_genetic_authorization.py` verifies first, then emits `g0-authorized-tuples.json` with `gateId`, envelope digest, sorted exact tuples, and `tupleDigest`. `render_genetic_content_authorization.py` emits `g0-authorized-content.json` with the exact knowledge/support content digests from G0-02. `render_genetic_trust_bootstrap.py` verifies the same pinned envelope and emits `g0-release-trust.json` from G0-04. Generated files are never accepted if hand-edited or generated from an unpinned envelope.

- [ ] **Step 6: Run the GREEN fixture governance tests**

Run the complete test-only-key suite before freezing the evidence commit:

```bash
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python -m pytest scripts/governance/test_genetics_g0.py -m "not production_gate" -q
```

Expected: all deterministic JSON, DSSE, path-set, role, digest, tuple/content, root-bootstrap, and tamper tests using test-only keys PASS. The production-gate tests remain intentionally excluded until Step 11 has the externally signed envelope and protected digests.

- [ ] **Step 7: Protect the record and wire the locked supply chain**

Add one CODEOWNERS line for each of the seven canonical full paths, in the same order, requiring security, regulatory, and accessibility owners. Add a weekly `pip` Dependabot entry with `directory: "/tooling/genetics"`; updates may change only `pyproject.toml`/`uv.lock` in a reviewed PR and must regenerate the SBOM/license inventory and pass the complete governance suite. Configure the `genetics-g0` CI environment so only repository administrators can update the protected digests, with two-person approval. The evidence/tooling commit precedes signing; the append-only envelope is committed separately, then administrators set its protected digest. If production verification fails, stop before modifying `apps/mobile/lib/features/genetics`.

```text
governance/genetics/evidence/g0-01-lab-legal.pdf @genome-companion/security @genome-companion/regulatory @genome-companion/accessibility
governance/genetics/evidence/g0-02-authorized-tuples-and-copy-policy.json @genome-companion/security @genome-companion/regulatory @genome-companion/accessibility
governance/genetics/evidence/g0-03-prohibited-scope.md @genome-companion/security @genome-companion/regulatory @genome-companion/accessibility
governance/genetics/evidence/g0-04-key-ceremony.json @genome-companion/security @genome-companion/regulatory @genome-companion/accessibility
governance/genetics/evidence/g0-05-science-recall-governance.pdf @genome-companion/security @genome-companion/regulatory @genome-companion/accessibility
governance/genetics/evidence/g0-06-mobile-threat-model.md @genome-companion/security @genome-companion/regulatory @genome-companion/accessibility
governance/genetics/evidence/g0-07-business-accessibility.pdf @genome-companion/security @genome-companion/regulatory @genome-companion/accessibility
```

- [ ] **Step 8: Run the GREEN locked supply-chain checks**

Run the locked supply-chain checks:

```bash
python scripts/ci/run_locked_uv.py -- lock --project tooling/genetics --check
python scripts/ci/run_locked_uv.py -- sync --project tooling/genetics --frozen --all-groups
GENETICS_SBOM_FIRST="$(mktemp)"
GENETICS_LICENSES_FIRST="$(mktemp)"
python scripts/ci/run_locked_uv.py -- export --project tooling/genetics --frozen --all-groups --format cyclonedx1.5 --output-file "$GENETICS_SBOM_FIRST"
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/governance/export_genetics_tooling_licenses.py --policy tooling/genetics/license-policy.json --output "$GENETICS_LICENSES_FIRST"
python scripts/ci/run_locked_uv.py -- export --project tooling/genetics --frozen --all-groups --format cyclonedx1.5 --output-file security/sbom/genetics-governance.cdx.json
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/governance/export_genetics_tooling_licenses.py --policy tooling/genetics/license-policy.json --output security/licenses/genetics-governance.json
cmp "$GENETICS_SBOM_FIRST" security/sbom/genetics-governance.cdx.json
cmp "$GENETICS_LICENSES_FIRST" security/licenses/genetics-governance.json
git diff --exit-code -- tooling/genetics/uv.lock
```

`export_genetics_tooling_licenses.py` sorts by normalized package name/version, records source metadata SHA-256 and SPDX expression, and omits wall-clock/generated-at fields. Expected: lock is unchanged; SBOM includes every locked package/version/hash; license inventory has no missing, unknown, or policy-denied license; regeneration is byte-identical.

- [ ] **Step 9: Commit the exact evidence and tooling source state**

Commit:

```bash
git add governance/genetics/evidence/g0-01-lab-legal.pdf governance/genetics/evidence/g0-02-authorized-tuples-and-copy-policy.json governance/genetics/evidence/g0-03-prohibited-scope.md governance/genetics/evidence/g0-04-key-ceremony.json governance/genetics/evidence/g0-05-science-recall-governance.pdf governance/genetics/evidence/g0-06-mobile-threat-model.md governance/genetics/evidence/g0-07-business-accessibility.pdf governance/genetics/trusted-approvers.json scripts/governance/genetics_g0_policy.py scripts/governance/canonical_json.py scripts/governance/dsse.py scripts/governance/build_g0_signing_request.py scripts/governance/assemble_g0_envelope.py scripts/governance/g0_candidate_handoff.py scripts/governance/verify_genetics_g0.py scripts/governance/render_genetic_authorization.py scripts/governance/render_genetic_content_authorization.py scripts/governance/render_genetic_trust_bootstrap.py scripts/governance/export_genetics_tooling_licenses.py scripts/governance/test_genetics_g0.py tooling/genetics/pyproject.toml tooling/genetics/uv.lock tooling/genetics/license-policy.json security/sbom/genetics-governance.cdx.json security/licenses/genetics-governance.json supply-chain/tool-artifacts.lock.json scripts/ci/install_uv.py scripts/ci/run_locked_uv.py scripts/tests/test_run_locked_uv.py .github/CODEOWNERS .github/dependabot.yml
git commit -m "docs(genetics): stage reviewed G0 evidence"
: "${GENETICS_G0_GATE_ID:?set protected GENETICS_G0_GATE_ID}"
[[ "$GENETICS_G0_GATE_ID" =~ ^g0-[0-9]{8}-[0-9]{4}$ ]]
GENETICS_G0_SOURCE_COMMIT="$(git rev-parse HEAD)"
test -z "$(git status --porcelain)"
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/governance/g0_candidate_handoff.py verify-source --source-commit "$GENETICS_G0_SOURCE_COMMIT"
GENETICS_G0_CEREMONY_DIR=".git/genetics-g0-ceremony/${GENETICS_G0_GATE_ID}"
mkdir -p "$GENETICS_G0_CEREMONY_DIR"
printf '%s\n' "$GENETICS_G0_SOURCE_COMMIT" > "$GENETICS_G0_CEREMONY_DIR/source-commit.txt"
printf '%s\n' "$GENETICS_G0_SOURCE_COMMIT"
```

Expected: the worktree is clean and the printed 40-hex commit is the immutable `sourceCommit` used in Step 10. Do not edit an evidence byte after this commit; a change requires a new commit and a new seven-role signing ceremony.

- [ ] **Step 10: Build and assemble the seven-role production envelope**

Run from the clean evidence/tooling commit:

```bash
: "${GENETICS_G0_GATE_ID:?set protected GENETICS_G0_GATE_ID}"
[[ "$GENETICS_G0_GATE_ID" =~ ^g0-[0-9]{8}-[0-9]{4}$ ]]
GENETICS_G0_CEREMONY_DIR=".git/genetics-g0-ceremony/${GENETICS_G0_GATE_ID}"
test -f "$GENETICS_G0_CEREMONY_DIR/source-commit.txt"
read -r GENETICS_G0_SOURCE_COMMIT < "$GENETICS_G0_CEREMONY_DIR/source-commit.txt"
[[ "$GENETICS_G0_SOURCE_COMMIT" =~ ^[0-9a-f]{40}$ ]]
git cat-file -e "${GENETICS_G0_SOURCE_COMMIT}^{commit}"
test -z "$(git status --porcelain=v1 --untracked-files=all)"
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/governance/g0_candidate_handoff.py prepare --source-commit "$GENETICS_G0_SOURCE_COMMIT" --gate-id "$GENETICS_G0_GATE_ID" --ceremony-dir "$GENETICS_G0_CEREMONY_DIR" --worktree-root build/genetics-g0-worktrees
test -f "$GENETICS_G0_CEREMONY_DIR/g0-ceremony-inputs.json"
test -f "$GENETICS_G0_CEREMONY_DIR/g0-control-manifest.payload.json"
test -f "$GENETICS_G0_CEREMONY_DIR/signing-request.json"
```

Transmit only `signing-request.json` through the approved ceremony. The founder, legal, regulatory, security, science, laboratory, and accessibility owners independently verify its displayed PAE SHA-256 and return exactly `founder.signature.json`, `legal.signature.json`, `regulatory.signature.json`, `security.signature.json`, `science.signature.json`, `laboratory.signature.json`, and `accessibility.signature.json` into `GENETICS_G0_CEREMONY_DIR`. No repository or CI process holds a private key. After all seven files arrive, run:

```bash
GENETICS_G0_CEREMONY_DIR=".git/genetics-g0-ceremony/${GENETICS_G0_GATE_ID}"
test -f "$GENETICS_G0_CEREMONY_DIR/founder.signature.json"
test -f "$GENETICS_G0_CEREMONY_DIR/legal.signature.json"
test -f "$GENETICS_G0_CEREMONY_DIR/regulatory.signature.json"
test -f "$GENETICS_G0_CEREMONY_DIR/security.signature.json"
test -f "$GENETICS_G0_CEREMONY_DIR/science.signature.json"
test -f "$GENETICS_G0_CEREMONY_DIR/laboratory.signature.json"
test -f "$GENETICS_G0_CEREMONY_DIR/accessibility.signature.json"
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/governance/g0_candidate_handoff.py assemble-candidate --source-commit "$GENETICS_G0_SOURCE_COMMIT" --gate-id "$GENETICS_G0_GATE_ID" --ceremony-dir "$GENETICS_G0_CEREMONY_DIR" --signature "$GENETICS_G0_CEREMONY_DIR/founder.signature.json" --signature "$GENETICS_G0_CEREMONY_DIR/legal.signature.json" --signature "$GENETICS_G0_CEREMONY_DIR/regulatory.signature.json" --signature "$GENETICS_G0_CEREMONY_DIR/security.signature.json" --signature "$GENETICS_G0_CEREMONY_DIR/science.signature.json" --signature "$GENETICS_G0_CEREMONY_DIR/laboratory.signature.json" --signature "$GENETICS_G0_CEREMONY_DIR/accessibility.signature.json" --worktree-root build/genetics-g0-worktrees --handoff-output "$GENETICS_G0_CEREMONY_DIR/candidate-handoff.json"
GENETICS_G0_CANDIDATE_COMMIT="$(python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/governance/g0_candidate_handoff.py field --handoff "$GENETICS_G0_CEREMONY_DIR/candidate-handoff.json" --name candidateCommit)"
GENETICS_G0_COMPUTED_TRUST_ROOT_SHA256="$(python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/governance/g0_candidate_handoff.py field --handoff "$GENETICS_G0_CEREMONY_DIR/candidate-handoff.json" --name trustRootSha256)"
GENETICS_G0_COMPUTED_ENVELOPE_SHA256="$(python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/governance/g0_candidate_handoff.py field --handoff "$GENETICS_G0_CEREMONY_DIR/candidate-handoff.json" --name envelopeSha256)"
[[ "$GENETICS_G0_CANDIDATE_COMMIT" =~ ^[0-9a-f]{40}$ ]]
[[ "$GENETICS_G0_COMPUTED_TRUST_ROOT_SHA256" =~ ^[0-9a-f]{64}$ ]]
[[ "$GENETICS_G0_COMPUTED_ENVELOPE_SHA256" =~ ^[0-9a-f]{64}$ ]]
git diff-tree --no-commit-id --name-only -r "$GENETICS_G0_CANDIDATE_COMMIT" | diff -u <(printf '%s\n' governance/genetics/g0-ceremony-inputs.json governance/genetics/g0-control-manifest.payload.json "governance/genetics/gates/g0/${GENETICS_G0_GATE_ID}.dsse.json") -
git push origin "$GENETICS_G0_CANDIDATE_COMMIT:refs/heads/g0-candidate/${GENETICS_G0_GATE_ID}"
printf 'GENETICS_G0_CANDIDATE_COMMIT=%s\nGENETICS_G0_TRUST_ROOT_SHA256=%s\nGENETICS_G0_ENVELOPE_SHA256=%s\n' "$GENETICS_G0_CANDIDATE_COMMIT" "$GENETICS_G0_COMPUTED_TRUST_ROOT_SHA256" "$GENETICS_G0_COMPUTED_ENVELOPE_SHA256"
```

The candidate commit has the exact source commit as its sole parent and exactly the three generated paths above; the protected `g0-candidate/` rule permits only this fast-forward, seven-signature handoff and forbids force-push/delete. Two repository administrators independently fetch that commit, compare the handoff and public digests, then set `GENETICS_G0_CANDIDATE_COMMIT`, `GENETICS_G0_TRUST_ROOT_SHA256`, and `GENETICS_G0_ENVELOPE_SHA256` in `genetics-g0`. This immutable branch coordinate—not an uncommitted workspace—is the fresh verifier's handoff. Any disagreement, changed parent/diff, or missing role stops the plan.

- [ ] **Step 11: Run the production GREEN verifier and renderers**

Run in a fresh protected-environment job after the expected digests are set. Its pinned `actions/checkout` uses `fetch-depth:0`, `fetch-tags:true`, and `persist-credentials:false`; the only fetched candidate ref is the protected gate ref and the job detaches at the protected candidate commit:

```bash
: "${GENETICS_G0_GATE_ID:?set protected GENETICS_G0_GATE_ID}"
: "${GENETICS_G0_TRUST_ROOT_SHA256:?set protected GENETICS_G0_TRUST_ROOT_SHA256}"
: "${GENETICS_G0_ENVELOPE_SHA256:?set protected GENETICS_G0_ENVELOPE_SHA256}"
: "${GENETICS_G0_CANDIDATE_COMMIT:?set protected GENETICS_G0_CANDIDATE_COMMIT}"
[[ "$GENETICS_G0_GATE_ID" =~ ^g0-[0-9]{8}-[0-9]{4}$ ]]
[[ "$GENETICS_G0_CANDIDATE_COMMIT" =~ ^[0-9a-f]{40}$ ]]
git fetch --no-tags origin "refs/heads/g0-candidate/${GENETICS_G0_GATE_ID}:refs/remotes/origin/g0-candidate/${GENETICS_G0_GATE_ID}"
test "$(git rev-parse "refs/remotes/origin/g0-candidate/${GENETICS_G0_GATE_ID}")" = "$GENETICS_G0_CANDIDATE_COMMIT"
git checkout --detach "$GENETICS_G0_CANDIDATE_COMMIT"
test -z "$(git status --porcelain=v1 --untracked-files=all)"
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/governance/g0_candidate_handoff.py verify-candidate --candidate-commit "$GENETICS_G0_CANDIDATE_COMMIT" --gate-id "$GENETICS_G0_GATE_ID" --trust-root-sha256 "$GENETICS_G0_TRUST_ROOT_SHA256" --envelope-sha256 "$GENETICS_G0_ENVELOPE_SHA256"
G0_ENVELOPE="governance/genetics/gates/g0/${GENETICS_G0_GATE_ID}.dsse.json"
test -f "$G0_ENVELOPE"
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python -m pytest scripts/governance/test_genetics_g0.py -q
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/governance/verify_genetics_g0.py "$G0_ENVELOPE" --trust-root-sha256 "$GENETICS_G0_TRUST_ROOT_SHA256" --envelope-sha256 "$GENETICS_G0_ENVELOPE_SHA256"
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/governance/render_genetic_authorization.py
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/governance/render_genetic_content_authorization.py
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/governance/render_genetic_trust_bootstrap.py
```

Expected: the full suite PASSes; production verification reports seven roles, seven controls, tuple count, envelope digest, and expiry without printing personal names or signatures; each renderer exits zero and emits only data derived from the pinned envelope.

- [ ] **Step 12: Commit only the verified renderers on top of the immutable candidate**

```bash
git switch -c "g0-verified/${GENETICS_G0_GATE_ID}" "$GENETICS_G0_CANDIDATE_COMMIT"
git add packages/contracts/genetics/g0-authorized-tuples.json packages/contracts/genetics/g0-authorized-content.json packages/contracts/genetics/g0-release-trust.json
git diff --cached --name-only | diff -u <(printf '%s\n' packages/contracts/genetics/g0-authorized-content.json packages/contracts/genetics/g0-authorized-tuples.json packages/contracts/genetics/g0-release-trust.json) -
git commit -m "docs(genetics): lock cryptographic entry gate"
```

Open the protected merge from this two-commit chain: candidate commit (ceremony inputs, payload, envelope) then renderer commit. The merge job exact-fetches `GENETICS_G0_CANDIDATE_COMMIT`, reruns Step 11, proves the candidate remains an ancestor and the three rendered files are byte-identical, and only then permits merge. No commit rebases, squashes, or rewrites the signed candidate.

## Task 2: Pin the mobile scaffold and generate strict contracts

**Depends on:** passing production G0 and the product-experience Flutter scaffold.

**Files:**

- Modify: `apps/mobile/pubspec.yaml`
- Generate: `apps/mobile/pubspec.lock`
- Create: `packages/contracts/jsonschema/certified-genetic-result.schema.json`, `packages/contracts/jsonschema/genetic-safety-bundle.schema.json`
- Create: `scripts/contracts/generate_genetic_dart.py`, `scripts/contracts/check_genetic_generation.py`
- Test: `scripts/contracts/test_genetic_contracts.py`
- Generate: `apps/mobile/lib/features/genetics/domain/certified_result.g.dart`, `apps/mobile/lib/features/genetics/domain/genetic_safety_bundle.g.dart`, `apps/mobile/lib/features/genetics/crypto/genetic_release_roots.g.dart`
- Create: `apps/mobile/test/features/genetics/generated_contract_test.dart`
- Create: `apps/mobile/test/features/genetics/fixtures/valid-result.jws`, `apps/mobile/test/features/genetics/fixtures/invalid-duplicate-key.jws`, `apps/mobile/test/features/genetics/fixtures/invalid-raw-format.json`, `apps/mobile/test/features/genetics/fixtures/valid-safety-bundle.dsse.json`

**Interfaces:**

- Consumes: verified `g0-authorized-tuples.json`, `g0-authorized-content.json`, `g0-release-trust.json`, two JSON Schemas, bounded byte streams, Flutter 3.44.7/Dart >=3.12, and the locked mobile dependency graph.
- Produces: strict generated `CertifiedGeneticResultV1.parseStrictSchemaBytes(Uint8List bytes)`, `G0TupleAuthorizer.authorizeAll({required CertifiedGeneticResultV1 parsed})`, `GeneticSafetyBundleV1.parseStrictBytes(Uint8List bytes)`, build-pinned root constants, a deterministic committed output tree, and typed non-sensitive parse/authorization failures.

- [ ] **Step 1: Assert the inherited scaffold and lock before editing**

Run:

```bash
test "$(flutter --version --machine | python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python -c 'import json,sys; print(json.load(sys.stdin)["frameworkVersion"])')" = "3.44.7"
dart --version 2>&1 | grep -Eq '^Dart SDK version: 3\.(1[2-9]|[2-9][0-9])\.'
test -f apps/mobile/pubspec.lock
test -f apps/mobile/android/app/src/main/AndroidManifest.xml
test -f apps/mobile/android/app/src/main/kotlin/kr/co/genomecompanion/mobile/MainActivity.kt
test -f apps/mobile/ios/Runner.xcodeproj/project.pbxproj
grep -Fq 'sdk: ">=3.12.0 <4.0.0"' apps/mobile/pubspec.yaml
grep -Fq 'namespace = "kr.co.genomecompanion.mobile"' apps/mobile/android/app/build.gradle.kts
grep -Fq 'applicationId = "kr.co.genomecompanion.mobile"' apps/mobile/android/app/build.gradle.kts
grep -Fq 'PRODUCT_BUNDLE_IDENTIFIER = kr.co.genomecompanion.mobile;' apps/mobile/ios/Runner.xcodeproj/project.pbxproj
```

Expected: Flutter `3.44.7`, Dart `>=3.12.0`, a complete Android/iOS scaffold, Android `applicationId`/namespace `kr.co.genomecompanion.mobile`, Kotlin host path `android/app/src/main/kotlin/kr/co/genomecompanion/mobile/MainActivity.kt`, and iOS bundle identifier `kr.co.genomecompanion.mobile`. If not, stop and finish the product-experience scaffold; do not create a second Flutter host or a genetics-specific application ID.

- [ ] **Step 2: Write RED cross-language contract tests**

Fixtures cover valid payload; duplicate JSON key; invalid UTF-8; depth >16; >64 results; canonical UUIDv1/uppercase UUID; naive timestamp; padded base64url; duplicate tuple; payload `schemaVersion` disagreeing with tuple `resultSchemaVersion`; unknown result code; extra field; raw-format field; an attempted caller/wall-clock substitution for the payload `issuedAt`; changed Korean/citation/support content under an approved ID; changed bootstrap root byte/threshold/floor; and 262,145-byte input. Python validates with Draft 2020-12 plus custom UUIDv4/aware-date checks. Normal Dart tests call generated `CertifiedGeneticResultV1.parseStrictSchemaBytes` followed by generated `G0TupleAuthorizer.authorizeAll`; recovery-only tests call only the first phase and prove it cannot produce a displayable/authorized result. Safety tests call `GeneticSafetyBundleV1.parseStrictBytes`.

- [ ] **Step 3: Run the RED cross-language contract tests**

Run:

```bash
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python -m pytest scripts/contracts/test_genetic_contracts.py -q
cd apps/mobile && flutter test test/features/genetics/generated_contract_test.dart
```

Expected: FAIL because schemas and generated parsers are absent.

- [ ] **Step 4: Define schemas and a deterministic Dart generator**

Both schemas use `additionalProperties:false`, exact required fields, closed enums, bounded strings/arrays, canonical UUIDv4, and offset-aware date-time custom formats. `generate_genetic_dart.py` resolves the repository root from its own file path (not the caller's working directory), accepts `--output-root`, and takes the two schema files plus verified `g0-authorized-tuples.json`, `g0-authorized-content.json`, and `g0-release-trust.json`; output embeds their SHA-256 values, exact tuples/content digests, initial release roots/threshold, and safety sequence floor in generated Dart. `check_genetic_generation.py` creates two independent temporary output roots, invokes the generator for each, rejects missing/extra paths, byte-compares the complete trees, and then byte-compares the second tree with the three committed generated Dart files named in this task's Files list. Generated code uses `BoundedAsciiStreamReader` to count chunks before allocation (result cap 262,144 bytes; safety cap 8 MiB; depth 16; object members 512; string 1 MiB), a strict UTF-8/JSON tokenizer that rejects duplicate keys and non-JSON numbers, then generated field/format validation. `CertifiedGeneticResultV1.parseStrictSchemaBytes` returns a non-displayable parsed value; generated `G0TupleAuthorizer.authorizeAll(parsed: parsed)` reads only `parsed.issuedAt` from the already signature-verified payload, accepts no timestamp/clock argument, and enforces every exact tuple/result code and authorization window before a normal import can persist or display. Recovery may retain a strictly parsed but currently unauthorized JWS only as provenance. Safety parsing always enforces content digests. The generated code does not call `jsonDecode` on attacker-controlled bytes.

The result parser is generated but does not run before signature verification. The verifier passes verified payload bytes to it. The generator output must be byte-deterministic on Windows and Linux.

- [ ] **Step 5: Pin the reviewed mobile dependencies**

Set `environment.sdk: ">=3.12.0 <4.0.0"`; add exact `cryptography: 2.9.0`; reuse existing exact Drift, Riverpod, `sqlite3: 3.5.1`, and `flutter_secure_storage: 11.0.0` locks. Add no HTTP, URL launcher, WebView, analytics, remote-config, or crash-report dependency.

- [ ] **Step 6: Run the GREEN generation and contract checks**

Run:

```bash
cd apps/mobile
flutter pub get
flutter pub get --enforce-lockfile
flutter pub deps --style=compact
cd ../..
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/contracts/generate_genetic_dart.py
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/contracts/check_genetic_generation.py
git diff --exit-code -- apps/mobile/lib/features/genetics/domain/certified_result.g.dart apps/mobile/lib/features/genetics/domain/genetic_safety_bundle.g.dart apps/mobile/lib/features/genetics/crypto/genetic_release_roots.g.dart
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python -m pytest scripts/contracts/test_genetic_contracts.py -q
cd apps/mobile && flutter test test/features/genetics/generated_contract_test.dart
```

Expected: the first `flutter pub get` intentionally updates the lock after the reviewed dependency edit; the second command proves it is enforceable; two independently generated trees and committed outputs are byte-identical; every invalid fixture fails with a stable non-sensitive reason.

- [ ] **Step 7: Commit the strict generated contracts**

Commit:

```bash
git add apps/mobile/pubspec.yaml apps/mobile/pubspec.lock packages/contracts/jsonschema/certified-genetic-result.schema.json packages/contracts/jsonschema/genetic-safety-bundle.schema.json scripts/contracts/generate_genetic_dart.py scripts/contracts/check_genetic_generation.py scripts/contracts/test_genetic_contracts.py apps/mobile/lib/features/genetics/domain/certified_result.g.dart apps/mobile/lib/features/genetics/domain/genetic_safety_bundle.g.dart apps/mobile/lib/features/genetics/crypto/genetic_release_roots.g.dart apps/mobile/test/features/genetics/generated_contract_test.dart apps/mobile/test/features/genetics/fixtures/valid-result.jws apps/mobile/test/features/genetics/fixtures/invalid-duplicate-key.jws apps/mobile/test/features/genetics/fixtures/invalid-raw-format.json apps/mobile/test/features/genetics/fixtures/valid-safety-bundle.dsse.json
git commit -m "feat(genetics): generate strict offline contracts"
```

## Task 3: Verify compact results and signed safety bundles

**Files:**

- Create: `apps/mobile/lib/features/genetics/crypto/strict_compact_jws.dart`, `apps/mobile/lib/features/genetics/crypto/dsse_verifier.dart`, `apps/mobile/lib/features/genetics/crypto/genetic_trust_store.dart`
- Create: `apps/mobile/lib/features/genetics/safety/safety_bundle_updater.dart`, `apps/mobile/lib/features/genetics/safety/recall_policy.dart`
- Create: `packages/contracts/jsonschema/genetic-safety-signing-request.schema.json`, `packages/contracts/jsonschema/genetic-safety-candidate-handoff.schema.json`
- Create: `scripts/genetics/build_safety_signing_request.py`, `scripts/genetics/assemble_safety_envelope.py`, `scripts/genetics/safety_candidate_handoff.py`, `scripts/genetics/verify_safety_bundle.py`
- Test: `scripts/genetics/test_safety_bundle.py`
- Create/review before signing: `governance/genetics/safety/genetic-safety-bundle.input.json`
- Create at production ceremony: `governance/genetics/safety/genetic-safety-bundle.payload.json`, `governance/genetics/safety/genetic-safety-signing-request.json`
- Create: `apps/mobile/assets/genetics/safety-bundle.dsse.json`
- Test: `apps/mobile/test/features/genetics/compact_jws_test.dart`, `apps/mobile/test/features/genetics/dsse_verifier_test.dart`, `apps/mobile/test/features/genetics/genetic_trust_store_test.dart`, `apps/mobile/test/features/genetics/safety_bundle_updater_test.dart`, `apps/mobile/test/features/genetics/recall_policy_test.dart`

**Interfaces:**

- Consumes: bounded compact JWS bytes, caller-supplied expected `typ`, generated bootstrap roots/floor, signed DSSE safety envelope, current/protected clock state, exact G0 tuple/content digests, detached offline release-root signatures, protected `GENETICS_SAFETY_ENVELOPE_SHA256`, and protected `GENETICS_SAFETY_CANDIDATE_COMMIT`.
- Produces: verified payload bytes only after global purpose-key lookup and signature; typed key/trust state; atomically installed signed safety state; monotonic root/sequence/clock anchor; persisted deterministic result/knowledge recall actions; and an immutable production safety candidate commit whose exact three-path diff is independently verified before merge.

```dart
Future<Uint8List> verifyCompactJws({
  required Uint8List compactAscii,
  required String expectedTyp,
  required SimplePublicKey key,
});

VerificationKey resolvePurposeScopedKid({
  required String kid,
  required KeyPurpose expectedPurpose,
  required DateTime now,
});
```

- [ ] **Step 1: Write RED tests for key-selection and type confusion**

Tests assert: global duplicate `kid` invalidates registry; lab ID is never read before signature; key selection uses `kid + purpose` only; wrong expected `typ`; valid signature under a knowledge/root key; `alg=none`; unknown header; padded/noncanonical segment; changed byte; wrong key; expired safety envelope; one-of-two DSSE threshold; duplicate root signer; changed generated bootstrap root byte; active issue windows; backdated new files under retired keys; revoked keys; locally anchored retired provenance; equal-sequence different digest; lower sequence; invalid next-root activation; wall-clock rollback across/same boot; recall precedence/parameter conflicts; and crash recovery conflict all fail closed.

```dart
test('payload cannot steer key selection', () async {
  final registry = fixtureRegistry(globalKid: 'gclr_test_unique_0001');
  final key = registry.resolvePurposeScopedKid(
    kid: 'gclr_test_unique_0001', expectedPurpose: KeyPurpose.labResult, now: now);
  await verifier.verifyCompactJws(
    compactAscii: payloadClaimingAnotherLab, expectedTyp: 'GC-CERTIFIED-RESULT+JWS', key: key.publicKey);
  expect(registry.payloadFieldsReadBeforeVerification, 0);
});
```

- [ ] **Step 2: Run the RED trust and type-confusion tests**

Run:

```bash
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python -m pytest scripts/genetics/test_safety_bundle.py -q
cd apps/mobile && flutter test test/features/genetics/compact_jws_test.dart test/features/genetics/dsse_verifier_test.dart test/features/genetics/genetic_trust_store_test.dart test/features/genetics/safety_bundle_updater_test.dart test/features/genetics/recall_policy_test.dart
```

Expected: compilation FAIL for missing implementations.

- [ ] **Step 3: Implement strict container verification in the required order**

The compact verifier bounded-reads ASCII, locates exactly two dots, validates unpadded base64url, strict-decodes only the protected header, requires exactly `alg`, `kid`, `typ`, and compares `typ` to the caller's `expectedTyp`. For normal import, the already verified safety registry resolves globally unique `kid` with `purpose=lab-result` and requires status `active`; retired/revoked/unknown/wrong-purpose keys stop before payload parse. It verifies Ed25519 over the exact original `protectedSegment + "." + payloadSegment` ASCII. Only returned verified payload bytes may enter the generated result parser. After parse, a separate authorization call validates key lab/certification, active issue window, subject binding, payload-schema-to-tuple version equality, and the complete G0 tuple. A distinct recovery-provenance resolver can return immutable historical key bytes but can never yield normal-import authorization.

- [ ] **Step 4: Implement DSSE threshold verification and key lifecycle**

`DsseVerifier` requires an expected payload type, strict envelope members, canonical payload bytes, distinct root key IDs, and current threshold. On first launch, that threshold/root set and `minimumSafetySequence` come only from generated `genetic_release_roots.g.dart`; the safety payload cannot choose the keys that authenticate itself. `GeneticTrustStore` validates the complete safety schema, global historical `kid` uniqueness, status/time invariants, two-phase root rotation, and the exact active/retired/revoked rules in this plan. Test clocks are injected; production never trusts bundle timestamps as the current clock.

`genetic-safety-signing-request.v1` is strict canonical JSON exactly `{schemaVersion,payloadType,sequence,rootSetId,requiredSignerKeyIds,payloadSha256,paeSha256,g0GateId,g0EnvelopeSha256,g0CandidateCommit,sourceCommit,ceremonyInputsDigest,requestedAt,expiresAt,requestSha256}` with `additionalProperties:false`. `payloadType` is exactly `application/vnd.genome-companion.genetics-safety.v1+json`; `requiredSignerKeyIds` is the sorted unique active-root list selected by policy and has exactly the generated threshold count; times are UTC `Z`, expiry is at most 24 hours, and the self-digest omits only itself. `sourceCommit` is a clean committed tree containing the builder/assembler/verifier/handoff code, schemas, generated G0 contracts, mobile trust code, uv lock, and FND tool lock/runner; every input blob is bound by `ceremonyInputsDigest`. Sequence must be greater than both generated floor and the protected last accepted sequence.

`build_safety_signing_request.py` runs from an isolated detached worktree at `sourceCommit`, reads inputs with `git show`, refuses content not present by canonical digest in `g0-authorized-content.json`, tuples outside `g0-authorized-tuples.json`, a mismatched G0/root bootstrap/candidate, invalid or conflicting recalls, and a non-increasing sequence, then emits the canonical payload, DSSE PAE, and request. It never signs. Each required root owner independently checks `paeSha256` and returns exactly `signature.<keyid>.json`; the ceremony directory must contain exactly those filenames and no extra signature. `assemble_safety_envelope.py` reloads exact source blobs/request, verifies every distinct active-root detached signature and threshold before producing the asset. `safety_candidate_handoff.py` has closed `prepare|assemble-candidate|field|verify-candidate` subcommands mirroring the G0 handoff: it creates a candidate commit whose sole parent is `sourceCommit` and whose exact ordered diff is the payload, request, and asset paths, emits a canonical public handoff, and never pushes. `verify_safety_bundle.py` exact-fetches candidate bytes and independently validates request/source/G0/root/sequence/payload/PAE/signatures/envelope/expected digest. Test-only keys are isolated to fixtures; production private roots never enter repository, CI, disk owned by the build, environment, logs, or command arguments.

- [ ] **Step 5: Implement the offline atomic safety updater**

`SafetyBundleUpdater.installBundledAsset()` and `installUserSelectedFile(Stream<List<int>>)` are its only inputs. There is no URL method, timer, background task, HTTP client, or “check for updates.” Implement the pending/anchor/rename protocol, protected-clock behavior, deterministic recall precedence/conflict rejection, and startup reconciliation exactly. Persist signed result and knowledge recalls by notice ID and sequence. Applying `suppress-result` hides value/explanation but retains encrypted provenance/export; applying `suppress-interpretation` removes derived cached copy and retains result provenance. A stale bundle returns `InterpretationUnavailable.safetyBundleExpired` without changing export/delete availability.

- [ ] **Step 6: Run the GREEN trust, safety, and updater checks**

Run:

```bash
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python -m pytest scripts/genetics/test_safety_bundle.py -q
cd apps/mobile && flutter test test/features/genetics/compact_jws_test.dart test/features/genetics/dsse_verifier_test.dart test/features/genetics/genetic_trust_store_test.dart test/features/genetics/safety_bundle_updater_test.dart test/features/genetics/recall_policy_test.dart
```

Expected: positive test-only vectors and crash states pass; all tamper, lifecycle, rollback, recall conflict, type-confusion, signing-request, threshold-filename, source-tree, and candidate-handoff cases fail closed. This step does not fabricate a production asset.

- [ ] **Step 7: Commit offline trust and safety tooling before production signing**

Commit:

```bash
git add packages/contracts/jsonschema/genetic-safety-signing-request.schema.json packages/contracts/jsonschema/genetic-safety-candidate-handoff.schema.json governance/genetics/safety/genetic-safety-bundle.input.json scripts/genetics/build_safety_signing_request.py scripts/genetics/assemble_safety_envelope.py scripts/genetics/safety_candidate_handoff.py scripts/genetics/verify_safety_bundle.py scripts/genetics/test_safety_bundle.py apps/mobile/lib/features/genetics/crypto/strict_compact_jws.dart apps/mobile/lib/features/genetics/crypto/dsse_verifier.dart apps/mobile/lib/features/genetics/crypto/genetic_trust_store.dart apps/mobile/lib/features/genetics/safety/safety_bundle_updater.dart apps/mobile/lib/features/genetics/safety/recall_policy.dart apps/mobile/test/features/genetics/compact_jws_test.dart apps/mobile/test/features/genetics/dsse_verifier_test.dart apps/mobile/test/features/genetics/genetic_trust_store_test.dart apps/mobile/test/features/genetics/safety_bundle_updater_test.dart apps/mobile/test/features/genetics/recall_policy_test.dart
git commit -m "feat(genetics): verify offline trust and safety bundles"
```

- [ ] **Step 8: Build the immutable production safety request and pause for threshold signatures**

Start from the clean Step 7 commit and exact protected G0 values:

```bash
: "${GENETICS_G0_GATE_ID:?set protected G0 gate}"
: "${GENETICS_G0_ENVELOPE_SHA256:?set protected G0 envelope digest}"
: "${GENETICS_G0_CANDIDATE_COMMIT:?set protected G0 candidate commit}"
: "${GENETICS_SAFETY_SEQUENCE:?set reviewed positive sequence}"
[[ "$GENETICS_SAFETY_SEQUENCE" =~ ^[1-9][0-9]{0,9}$ ]]
test -z "$(git status --porcelain=v1 --untracked-files=all)"
GENETICS_SAFETY_SOURCE_COMMIT="$(git rev-parse HEAD)"
GENETICS_SAFETY_CEREMONY_DIR=".git/genetics-safety-ceremony/${GENETICS_SAFETY_SEQUENCE}"
mkdir -p "$GENETICS_SAFETY_CEREMONY_DIR/signatures"
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/genetics/safety_candidate_handoff.py prepare --source-commit "$GENETICS_SAFETY_SOURCE_COMMIT" --sequence "$GENETICS_SAFETY_SEQUENCE" --input governance/genetics/safety/genetic-safety-bundle.input.json --g0-gate-id "$GENETICS_G0_GATE_ID" --g0-envelope-sha256 "$GENETICS_G0_ENVELOPE_SHA256" --g0-candidate-commit "$GENETICS_G0_CANDIDATE_COMMIT" --ceremony-dir "$GENETICS_SAFETY_CEREMONY_DIR" --worktree-root build/genetics-safety-worktrees
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/genetics/safety_candidate_handoff.py verify-request --ceremony-dir "$GENETICS_SAFETY_CEREMONY_DIR" --source-commit "$GENETICS_SAFETY_SOURCE_COMMIT"
```

**STOP.** Transmit only `genetic-safety-signing-request.json` and its PAE bytes. Exactly the sorted `requiredSignerKeyIds` owners independently verify the request and return one file named `signature.<keyid>.json` to the signatures directory. No production root private key or signing command exists in the repository/CI. Continue only after this exact-set check and assembly:

```bash
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/genetics/safety_candidate_handoff.py check-signature-set --request "$GENETICS_SAFETY_CEREMONY_DIR/genetic-safety-signing-request.json" --signature-dir "$GENETICS_SAFETY_CEREMONY_DIR/signatures"
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/genetics/safety_candidate_handoff.py assemble-candidate --source-commit "$GENETICS_SAFETY_SOURCE_COMMIT" --request "$GENETICS_SAFETY_CEREMONY_DIR/genetic-safety-signing-request.json" --signature-dir "$GENETICS_SAFETY_CEREMONY_DIR/signatures" --worktree-root build/genetics-safety-worktrees --handoff-output "$GENETICS_SAFETY_CEREMONY_DIR/candidate-handoff.json"
GENETICS_SAFETY_CANDIDATE_COMMIT="$(python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/genetics/safety_candidate_handoff.py field --handoff "$GENETICS_SAFETY_CEREMONY_DIR/candidate-handoff.json" --name candidateCommit)"
GENETICS_SAFETY_ENVELOPE_SHA256="$(python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/genetics/safety_candidate_handoff.py field --handoff "$GENETICS_SAFETY_CEREMONY_DIR/candidate-handoff.json" --name envelopeSha256)"
[[ "$GENETICS_SAFETY_CANDIDATE_COMMIT" =~ ^[0-9a-f]{40}$ ]]
[[ "$GENETICS_SAFETY_ENVELOPE_SHA256" =~ ^[0-9a-f]{64}$ ]]
git push origin "$GENETICS_SAFETY_CANDIDATE_COMMIT:refs/heads/safety-candidate/${GENETICS_SAFETY_SEQUENCE}"
printf 'GENETICS_SAFETY_CANDIDATE_COMMIT=%s\nGENETICS_SAFETY_ENVELOPE_SHA256=%s\n' "$GENETICS_SAFETY_CANDIDATE_COMMIT" "$GENETICS_SAFETY_ENVELOPE_SHA256"
```

Two protected-environment administrators independently fetch the candidate, prove its sole parent/source and exact three-path diff, compare the request/envelope digests, and set `GENETICS_SAFETY_CANDIDATE_COMMIT` plus `GENETICS_SAFETY_ENVELOPE_SHA256`. Force-push/delete/squash of the candidate ref is forbidden.

- [ ] **Step 9: Run the production safety GREEN gate from the immutable candidate**

In a fresh pinned checkout (`fetch-depth:0`, `fetch-tags:true`, `persist-credentials:false`):

```bash
: "${GENETICS_SAFETY_SEQUENCE:?set protected positive safety sequence}"
: "${GENETICS_SAFETY_CANDIDATE_COMMIT:?set protected safety candidate commit}"
: "${GENETICS_SAFETY_ENVELOPE_SHA256:?set protected safety envelope digest}"
[[ "$GENETICS_SAFETY_SEQUENCE" =~ ^[1-9][0-9]{0,9}$ ]]
git fetch --no-tags origin "refs/heads/safety-candidate/${GENETICS_SAFETY_SEQUENCE}:refs/remotes/origin/safety-candidate/${GENETICS_SAFETY_SEQUENCE}"
test "$(git rev-parse "refs/remotes/origin/safety-candidate/${GENETICS_SAFETY_SEQUENCE}")" = "$GENETICS_SAFETY_CANDIDATE_COMMIT"
git checkout --detach "$GENETICS_SAFETY_CANDIDATE_COMMIT"
test -z "$(git status --porcelain=v1 --untracked-files=all)"
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/genetics/safety_candidate_handoff.py verify-candidate --candidate-commit "$GENETICS_SAFETY_CANDIDATE_COMMIT" --sequence "$GENETICS_SAFETY_SEQUENCE" --envelope-sha256 "$GENETICS_SAFETY_ENVELOPE_SHA256"
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/genetics/verify_safety_bundle.py apps/mobile/assets/genetics/safety-bundle.dsse.json --expected-sequence "$GENETICS_SAFETY_SEQUENCE" --expected-envelope-sha256 "$GENETICS_SAFETY_ENVELOPE_SHA256" --expected-candidate-commit "$GENETICS_SAFETY_CANDIDATE_COMMIT"
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python -m pytest scripts/genetics/test_safety_bundle.py -q
cd apps/mobile && flutter test test/features/genetics/dsse_verifier_test.dart test/features/genetics/genetic_trust_store_test.dart test/features/genetics/safety_bundle_updater_test.dart test/features/genetics/recall_policy_test.dart
```

Expected: the candidate has exactly the input-derived payload, strict request, and threshold-signed asset; all source/G0/root/sequence/digest/signature/candidate checks pass. Mutating any request field, filename, signature role/key, payload, parent, path, protected digest, or sequence fails.

- [ ] **Step 10: Merge the exact production candidate without rewriting it**

Open the protected merge at `GENETICS_SAFETY_CANDIDATE_COMMIT`. The merge gate reruns Step 9, requires the Step 7 source commit as sole candidate parent, and allows only a merge commit that preserves the candidate object; squash/rebase is disabled. This candidate commit is the explicit commit step for the payload, request, and `apps/mobile/assets/genetics/safety-bundle.dsse.json`.

## Task 4: Provision subject binding and import into a separate encrypted vault

**Files:**

- Create: `apps/mobile/lib/features/genetics/binding/subject_binding.dart`
- Create: `apps/mobile/lib/features/genetics/data/genetic_vault_coordinator.dart`, `apps/mobile/lib/features/genetics/data/genetic_wallet_database.dart`, `apps/mobile/lib/features/genetics/data/genetic_importer.dart`
- Modify: `apps/mobile/lib/vault/database.dart` only to expose the already tested keyed SQLCipher executor factory to the separate genetics database
- Test: `apps/mobile/test/features/genetics/subject_binding_test.dart`, `apps/mobile/test/features/genetics/genetic_vault_coordinator_test.dart`, `apps/mobile/test/features/genetics/genetic_wallet_database_test.dart`, `apps/mobile/test/features/genetics/genetic_importer_test.dart`

**Interfaces:**

- Consumes: CSPRNG, local profile UUID, secure-storage namespace, pending `GC-SB-1` challenge, verified JWS payload/key status, generated strict parser/tuple authorizer, SQLCipher factory, and protected safety clock.
- Produces: `SubjectBindingChallenge`; serialized `GeneticVaultCoordinator`; encrypted profile-scoped database; atomic `Future<ImportReceipt> GeneticImporter.importStream({required Stream<List<int>> compactJws, required String localProfileId, required DateTime wallUtc})`; retained original compact JWS plus verified projections; zero partial rows on failure.

**Database:** one profile-scoped SQLCipher file contains `genetic_bundles`, `genetic_results`, `genetic_pending_challenges`, `genetic_safety_state`, `genetic_result_recalls`, and `genetic_knowledge_recalls`. `genetic_bundles.original_compact_jws` is required BLOB ciphertext at rest inside SQLCipher. Projections never replace it as provenance.

- [ ] **Step 1: Write RED binding, vault-isolation, and race tests**

Cover CSPRNG failure; challenge expiry/replay; wrong profile; malformed binding length; constant-time comparator instrumentation; second-device mismatch; correction rules; secure-store corruption; wrong key; DB plaintext scan; interrupted migration; concurrent imports; import racing delete; account switch racing export; genetics deletion leaving record-vault key intact; and no auto-recreate after destroy.

```dart
test('wallet deletion never touches the record-vault namespace', () async {
  await coordinator.deleteWallet(profile, reauth);
  expect(await secureStore.read('gc_genetic_wallet_key_v1:$profile'), isNull);
  expect(await recordVaultStore.read('gc_record_vault_key_v1'), isNotNull);
});
```

- [ ] **Step 2: Run the RED binding, vault, and import tests**

Run: `cd apps/mobile && flutter test test/features/genetics/subject_binding_test.dart test/features/genetics/genetic_vault_coordinator_test.dart test/features/genetics/genetic_wallet_database_test.dart test/features/genetics/genetic_importer_test.dart`

Expected: compilation FAIL for missing binding/vault/importer classes.

- [ ] **Step 3: Implement exact challenge generation and recovery semantics**

Implement `GC-SB-1` exactly as specified above. The pending challenge is encrypted and one use. Screen copy and QR rendering receive a short-lived value object that cannot stringify into logs. For corrections, require `provisioningChallengeId` to equal the stored original ID while `supersedesBundleId` points to that same original/same-chain bundle; never consume or recreate a pending challenge. A recovery import restores the archived `localProfileId` and binding secret only after archive authentication and explicit user confirmation; it creates a new random SQLCipher key. A normal reinstall or a copied certified-result JWS alone cannot restore binding.

- [ ] **Step 4: Implement coordinated SQLCipher lifecycle**

Reuse the product-experience native-assets SQLCipher factory. On every open, set key before all reads, require non-empty `PRAGMA cipher_version`, run an encrypted sentinel query, reject wrong-key access, and apply transactional migrations. Configure WAL and checkpoint/close before destruction. The genetics DB, WAL, SHM, and temp exports are backup-excluded. Tests scan the closed files for fixture JWS, binding, trait, result, and explanation markers and find none in plaintext.

- [ ] **Step 5: Implement the ordered atomic import**

The only valid order is:

1. bounded stream and compact framing;
2. strict protected-header decode;
3. global purpose-scoped `kid` resolution;
4. signature verification;
5. strict generated payload parse;
6. key-to-lab/certification and active-key issue-window authorization;
7. constant-time subject binding and challenge/correction check;
8. exact ten-field G0 tuple match and authorization-validity check for every result;
9. protected-clock rollback/five-minute future-skew and canonical supersession checks;
10. one SQL transaction storing original compact JWS, projections, provenance, and consumed challenge.

No UI receives result values before commit. Bound mutable buffers are overwritten best-effort after commit/failure without claiming VM-copy zeroization.

- [ ] **Step 6: Run the GREEN binding, vault, and import checks**

Run: `cd apps/mobile && flutter test test/features/genetics/subject_binding_test.dart test/features/genetics/genetic_vault_coordinator_test.dart test/features/genetics/genetic_wallet_database_test.dart test/features/genetics/genetic_importer_test.dart`

Expected: valid original/correction imports pass; every malformed, untrusted, unauthorized, cross-profile, replayed, future, duplicate, and injected-transaction failure writes zero partial rows; original compact JWS round-trips from the encrypted repository.

- [ ] **Step 7: Commit subject binding and the separate vault**

Commit:

```bash
git add apps/mobile/lib/features/genetics/binding/subject_binding.dart apps/mobile/lib/features/genetics/data/genetic_vault_coordinator.dart apps/mobile/lib/features/genetics/data/genetic_wallet_database.dart apps/mobile/lib/features/genetics/data/genetic_importer.dart apps/mobile/lib/vault/database.dart apps/mobile/test/features/genetics/subject_binding_test.dart apps/mobile/test/features/genetics/genetic_vault_coordinator_test.dart apps/mobile/test/features/genetics/genetic_wallet_database_test.dart apps/mobile/test/features/genetics/genetic_importer_test.dart
git commit -m "feat(genetics): bind and retain certified results locally"
```

## Task 5: Apply recalls and explain with deterministic signed knowledge

**Files:**

- Create: `apps/mobile/lib/features/genetics/rules/local_genetic_explainer.dart`
- Modify: `apps/mobile/lib/features/genetics/safety/recall_policy.dart`
- Test: `apps/mobile/test/features/genetics/local_genetic_explainer_test.dart`
- Modify/Test: `apps/mobile/test/features/genetics/recall_policy_test.dart`
- Create: `ops/runbooks/genetic-result-recall.md`

**Interfaces:**

- Consumes: verified local result row, exact G0 tuple/content authorization, active signed safety state, effective result/knowledge recalls, protected current time, and no free-text prompt.
- Produces: `LocalGeneticExplanation` with exact provenance/citations or typed `ExplanationUnavailable`; deterministic effective recall state; G0-approved support copy; no probabilistic or generated medical claim.

**Outcome:** `LocalGeneticExplanation` includes exact result provenance, `copyId`, `knowledgeEntryId`, safety sequence/digest, Korean uncertainty/applicability, and citations. It is never generated by an LLM or free-text prompt.

- [ ] **Step 1: Write RED tuple, staleness, and recall tests**

Tests cover exact unique tuple; unknown/duplicate mapping; certification or assay mismatch; authorization-validity boundary; same copy/knowledge/support ID with one changed Korean byte/citation/route; rejection of attempted `replace-copy`; stale/early knowledge; result recall by bundle digest/key/tuple; knowledge suppression by entry/copy; deterministic overlapping result-recall precedence; conflicting replacement-bundle/support parameters; future-effective notice; revoked key; superseded result; stale safety bundle; and prohibited Korean diagnosis/prescription/guarantee phrases.

- [ ] **Step 2: Run the RED explanation and recall tests**

Run: `cd apps/mobile && flutter test test/features/genetics/local_genetic_explainer_test.dart test/features/genetics/recall_policy_test.dart`

Expected: compilation FAIL for missing explainer.

- [ ] **Step 3: Implement exact deterministic joins and closed policy**

The explainer takes a verified repository row plus the active verified safety state. It requires exactly one knowledge entry matching all ten authorization fields, recomputes its canonical complete-content digest, requires exact membership in generated G0 content authorization, and checks the G0 envelope/tuple/content digests embedded at build. Support copy receives the same digest check before rendering. Copy lints come from the G0-hashed policy artifact, not hard-coded permissive defaults. Unknown or conflicting input yields a typed unavailable reason; no fallback prose is synthesized.

- [ ] **Step 4: Implement recall actions without erasing provenance**

`bundleIdDigest` is `sha256(UTF8("gc.genetic.result-recall.v1\u0000" + canonicalBundleId))`. Once an effective notice is accepted at sequence N, later stale/expired bundle state cannot undo it. `suppress-result` hides result value and explanation but leaves a recalled provenance card and export. `mark-superseded` links the signed replacement. `require-lab-contact` displays only G0-approved support copy. Knowledge suppression removes cached interpretation only. Unknown actions/reasons invalidate the bundle.

- [ ] **Step 5: Run the GREEN recall and explanation tests**

Run: `cd apps/mobile && flutter test test/features/genetics/local_genetic_explainer_test.dart test/features/genetics/recall_policy_test.dart`

Expected: all exact-match, stale, supersession, recall, and Korean copy-policy tests PASS.

- [ ] **Step 6: Commit signed recalls and local explanations**

Commit:

```bash
git add apps/mobile/lib/features/genetics/rules/local_genetic_explainer.dart apps/mobile/lib/features/genetics/safety/recall_policy.dart apps/mobile/test/features/genetics/local_genetic_explainer_test.dart apps/mobile/test/features/genetics/recall_policy_test.dart ops/runbooks/genetic-result-recall.md
git commit -m "feat(genetics): enforce signed recalls and local explanations"
```

## Task 6: Build a provenance-first, accessible private wallet

**Files:**

- Create: `apps/mobile/lib/features/genetics/presentation/import_screen.dart`, `apps/mobile/lib/features/genetics/presentation/wallet_screen.dart`, `apps/mobile/lib/features/genetics/presentation/trait_detail_screen.dart`
- Modify: `apps/mobile/lib/app.dart` to register genetics routes and shared `SensitiveSurfaceCoordinator` states
- Modify: `apps/mobile/android/app/build.gradle.kts` to add the explicitly unsigned `geneticsCandidateRelease` variant
- Create: `apps/mobile/android/app/src/main/kotlin/kr/co/genomecompanion/mobile/GeneticPrivacyPlugin.kt`
- Create: `apps/mobile/ios/Runner/GeneticPrivacyPlugin.swift`
- Modify: `apps/mobile/android/app/src/main/AndroidManifest.xml`, `apps/mobile/android/app/src/main/res/xml/backup_rules.xml`, `apps/mobile/android/app/src/main/res/xml/data_extraction_rules.xml`
- Modify: `apps/mobile/ios/Runner/Info.plist`, `apps/mobile/ios/Runner/Runner.entitlements`, `apps/mobile/ios/Runner/PrivacyInfo.xcprivacy`
- Test: `apps/mobile/test/features/genetics/wallet_screen_test.dart`, `apps/mobile/test/features/genetics/trait_detail_screen_test.dart`, `apps/mobile/test/features/genetics/genetic_accessibility_test.dart`
- Test: `apps/mobile/android/app/src/androidTest/kotlin/kr/co/genomecompanion/mobile/GeneticPrivacyPluginTest.kt`
- Test: `apps/mobile/ios/RunnerTests/GeneticPrivacyPluginTests.swift`

**Interfaces:**

- Consumes: verified import state, local repository rows, deterministic explanation/recall outcomes, generated Midnight Evidence Ledger tokens, shared app route stack, native capture/backup/privacy channels.
- Produces: local routes `/genetics/import`, `/genetics/wallet`, `/genetics/trait/:localId`; provenance-first Korean UI; measurable WCAG/semantics evidence; continuous sensitive-surface protection across private-route transitions.

- [ ] **Step 1: Write RED disclosure and accessibility tests**

Before signature and authorization complete, tests assert that the UI shows only sanitized file name, size, and `검증 중`; it never renders claimed lab, trait, result, subject binding, or payload snippets. Failure surfaces only a stable Korean reason and approved lab support route. Detail tests require `검증된 검사기관 결과`, lab/certification/assay/issue date, signed-source status, uncertainty, population applicability, citations, safety version, and the boundary `이 정보는 진단이나 약물 선택을 위한 것이 아닙니다.`

Widget, semantics, and golden matrices measure: 200% text without clipping; TalkBack/VoiceOver order and localized labels; 44x44 targets; contrast thresholds; visible focus; reduced motion; no color-only state; portrait/landscape; active, superseded, recalled, stale-knowledge, and provenance-only states. Route tests cover public -> genetics -> private record -> public and assert that shared sensitive-surface protection never clears between the two private routes.

- [ ] **Step 2: Run the RED disclosure and accessibility tests**

Run: `cd apps/mobile && flutter test test/features/genetics/wallet_screen_test.dart test/features/genetics/trait_detail_screen_test.dart test/features/genetics/genetic_accessibility_test.dart`

Expected: compilation FAIL for missing screens/plugins.

- [ ] **Step 3: Implement screens with the Midnight Evidence Ledger tokens**

Routes are local only: `/genetics/import`, `/genetics/wallet`, and `/genetics/trait/:localId`. Route arguments contain opaque local IDs, never trait/result values. Status always has text plus icon semantics. The screen disables OS indexing, selection, and clipboard for genetic content. Side-load is an explicit file-picker action labelled `서명된 안전 번들 가져오기`; there is no refresh button or network state.

- [ ] **Step 4: Implement honest platform privacy controls**

Extend the app-wide `SensitiveSurfaceCoordinator` owned by `apps/mobile/lib/app.dart`; do not let a genetics widget toggle the platform flag directly. The coordinator computes protection from the complete active route stack (`public|record-private|genetics-private`) and sends the desired state to native code only when it changes. Android applies `FLAG_SECURE` whenever any protected surface remains and clears it only after transition to an entirely public stack; a genetics -> private-record transition must remain continuously secure. iOS observes `UIScreen.isCaptured`, obscures sensitive content while captured, and overlays the app-switcher snapshot under the same shared route state. Both platforms disclose that another camera and some OS-level behavior cannot be prevented. Set Android `allowBackup="false"`, `fullBackupContent="false"`, restrictive data-extraction rules, and iOS `NSURLIsExcludedFromBackupKey` plus complete file protection. Keychain values are this-device-only and non-synchronizing.

In `build.gradle.kts`, add flavor dimension `distribution` and product flavor `geneticsCandidate` without an application-ID suffix; `applicationId` and namespace remain exactly `kr.co.genomecompanion.mobile`. After all Flutter template configuration, set `buildTypes.getByName("release").signingConfig = null` and fail configuration if `geneticsCandidateRelease` resolves any debug/store signing config or keystore. Only `flutter build appbundle --release --flavor geneticsCandidate` produces the conditional candidate; the ordinary release variant is not release evidence. `genetic_release_permissions.ps1` later inspects the Gradle model and archive, rejects `META-INF/*.SF|*.RSA|*.DSA|*.EC`, and requires `jarsigner -verify -strict` to identify the AAB as unsigned. Store signing/certificates remain deferred to a separate founder-approved plan.

- [ ] **Step 5: Run the GREEN platform and accessibility gates**

Run:

```bash
cd apps/mobile
flutter test test/features/genetics/wallet_screen_test.dart test/features/genetics/trait_detail_screen_test.dart test/features/genetics/genetic_accessibility_test.dart
flutter build appbundle --release --flavor geneticsCandidate
flutter build ios --release --no-codesign
```

On the pinned CI devices from Task 9, also run:

```bash
cd apps/mobile/android && ./gradlew :app:connectedDebugAndroidTest
cd ../ios
GC_GENETICS_SIMULATOR_UDID="$(xcrun simctl create GCGeneticsTask6 com.apple.CoreSimulator.SimDeviceType.iPhone-16 com.apple.CoreSimulator.SimRuntime.iOS-18-5)"
xcrun simctl boot "$GC_GENETICS_SIMULATOR_UDID"
xcrun simctl bootstatus "$GC_GENETICS_SIMULATOR_UDID" -b
xcodebuild test -workspace Runner.xcworkspace -scheme Runner -destination "platform=iOS Simulator,id=$GC_GENETICS_SIMULATOR_UDID" CODE_SIGNING_ALLOWED=NO
```

Expected: Flutter tests pass and both release candidates build. Android instrumentation and iOS XCTest assert continuous shared secure-screen/app-switcher behavior, backup exclusions, device-only key accessibility, native reauthentication failure/success mapping, and profile switching.

- [ ] **Step 6: Commit the accessible private wallet**

Commit:

```bash
git add apps/mobile/lib/features/genetics/presentation/import_screen.dart apps/mobile/lib/features/genetics/presentation/wallet_screen.dart apps/mobile/lib/features/genetics/presentation/trait_detail_screen.dart apps/mobile/lib/app.dart apps/mobile/android/app/build.gradle.kts apps/mobile/android/app/src/main/kotlin/kr/co/genomecompanion/mobile/GeneticPrivacyPlugin.kt apps/mobile/android/app/src/main/AndroidManifest.xml apps/mobile/android/app/src/main/res/xml/backup_rules.xml apps/mobile/android/app/src/main/res/xml/data_extraction_rules.xml apps/mobile/ios/Runner/GeneticPrivacyPlugin.swift apps/mobile/ios/Runner/Info.plist apps/mobile/ios/Runner/Runner.entitlements apps/mobile/ios/Runner/PrivacyInfo.xcprivacy apps/mobile/test/features/genetics/wallet_screen_test.dart apps/mobile/test/features/genetics/trait_detail_screen_test.dart apps/mobile/test/features/genetics/genetic_accessibility_test.dart apps/mobile/android/app/src/androidTest/kotlin/kr/co/genomecompanion/mobile/GeneticPrivacyPluginTest.kt apps/mobile/ios/RunnerTests/GeneticPrivacyPluginTests.swift
git commit -m "feat(genetics): add accessible provenance-first wallet"
```

## Task 7: Export, recover, and cryptographically delete without cloud

**Files:**

- Create: `apps/mobile/lib/features/genetics/lifecycle/genetic_archive.dart`, `apps/mobile/lib/features/genetics/lifecycle/genetic_reauthentication.dart`, `apps/mobile/lib/features/genetics/lifecycle/genetic_wallet_lifecycle.dart`
- Modify: `apps/mobile/android/app/build.gradle.kts`, `apps/mobile/android/gradle/verification-metadata.xml`
- Modify: `apps/mobile/android/app/src/main/kotlin/kr/co/genomecompanion/mobile/GeneticPrivacyPlugin.kt`, `apps/mobile/ios/Runner/GeneticPrivacyPlugin.swift`
- Test: `apps/mobile/test/features/genetics/genetic_archive_test.dart`, `apps/mobile/test/features/genetics/genetic_reauthentication_test.dart`, `apps/mobile/test/features/genetics/genetic_wallet_lifecycle_test.dart`
- Modify: `apps/mobile/android/app/src/androidTest/kotlin/kr/co/genomecompanion/mobile/GeneticPrivacyPluginTest.kt`, `apps/mobile/ios/RunnerTests/GeneticPrivacyPluginTests.swift`

**Interfaces:**

- Consumes: encrypted genetics repository snapshot, original JWS/safety evidence, strict passphrase bytes, GEN-owned platform reauthentication proof, current app trust floor/anchor, app-private temp storage, OS share sheet, and serialized vault coordinator.
- Produces: bounded authenticated `GCGENEX1` provenance/recovery archive; atomic recovery result; scoped one-use reauthentication; janitor evidence; `GeneticDeletionReceipt` without trait data; explicit external-copy limitation.

### Exact archive `GCGENEX1`

- Maximum encrypted file: 32 MiB; maximum header: 16 KiB; maximum entries: 130; maximum total plaintext: 24 MiB; maximum path length: 128; only normalized allowlisted paths; no links or traversal.
- Bytes start with 8-byte ASCII magic `GCGENEX1`, then unsigned 32-bit big-endian header length, then canonical UTF-8 JSON header.
- Header fields are exactly: `format="GCGENEX1"`, `archiveId` UUIDv4, `createdAt`, `mode="provenance|recovery"`, `kdf`, `cipher`, `chunkSize=65536`, `noncePrefix`, and `manifestDigest`. `kdf` is exactly `{name:"argon2id",version:19,salt,memoryKiB,iterations,parallelism}`; `cipher` is exactly `{name:"aes-256-gcm",tagBytes:16}`. Salt and nonce prefix are unpadded base64url. `manifestDigest` is unpadded base64url of the 32-byte SHA-256 of the exact `manifest.json` entry bytes; padding, uppercase hex, another algorithm, or a decoded length other than 32 is rejected.
- KDF is Argon2id via `cryptography` 2.9.0: 16-byte random salt, 32-byte key, memory 65,536 KiB, iterations 3, parallelism 1 by default. Import accepts only memory 65,536–262,144 KiB, iterations 3–6, parallelism 1–2, and rejects parameter overflow before allocation. Oldest supported devices must finish p95 <=2 seconds; otherwise the supported-device gate blocks launch. A later versioned format may raise, but never silently lower, work factors.
- Cipher is AES-256-GCM. Nonce is random 8-byte prefix plus unsigned 32-bit frame sequence. Each frame is `sequence:u32 | plaintextLength:u32 | final:u8 | ciphertext | tag:16`. AAD is `magic || SHA256(exact canonical header bytes) || sequence || plaintextLength || final`. Sequence begins zero, cannot repeat or wrap, and ends with exactly one authenticated empty final frame.
- Decrypted plaintext uses no ZIP/tar/compression parser. It begins with 7-byte ASCII `GCENTR1`, then `entryCount:u16`, followed by entries sorted by normalized path: `pathLength:u16 | pathUtf8 | contentLength:u32 | contentSha256:32 | content`. The first entry is `manifest.json`; allowed later entries are original compact JWS files, signed safety envelopes, and verification receipts. `mode=recovery` additionally permits exactly one binding-secret entry and local-profile entry; `mode=provenance` permits neither. `manifest.json` hashes every **non-manifest** entry and records the G0/safety digests; the header's `manifestDigest` authenticates the exact manifest bytes, avoiding a self-hash. Derived trait projections are never archived.

- [ ] **Step 1: Write RED framing, KDF, reauth, and janitor tests**

Test deterministic manifest/entry framing without manifest self-hash; exact unpadded base64url SHA-256 `manifestDigest` and invalid encoding/length/algorithm; random salt/nonces; round trip; one-byte tamper; reordered/replayed/truncated/fake-final frame; wrong AAD/passphrase; nonce reuse guard; header/ciphertext/entry/path limits; duplicate/out-of-order/unknown/projection entry; KDF below/above caps rejected before allocation; passphrase 11/12/128/129-byte and distinct Unicode-normalization cases; confirmation mismatch; provenance excludes binding; recovery restores binding; recovery with older/revoked safety; stale safety still exports; effective recall exports source; one-use reauth scope/expiry/background invalidation; interrupted write; share callback; app restart/resume; 15-minute cleanup; deletion racing export; and external-copy disclosure acceptance.

- [ ] **Step 2: Run the RED archive, reauthentication, and lifecycle tests**

Run: `cd apps/mobile && flutter test test/features/genetics/genetic_archive_test.dart test/features/genetics/genetic_reauthentication_test.dart test/features/genetics/genetic_wallet_lifecycle_test.dart`

Expected: compilation FAIL for missing archive/lifecycle code.

- [ ] **Step 3: Implement scoped reauthentication and app-private staging**

GEN owns `GeneticReauthenticationPort`; it does not depend on an undefined product DTO. Pin Android native dependency `androidx.biometric:biometric:1.1.0` in Gradle and its lock/verification metadata; iOS uses the built-in LocalAuthentication framework. `request(scope)` creates a 16-byte CSPRNG nonce in memory and invokes Android `BiometricPrompt` with device credential allowed or iOS `LAContext.evaluatePolicy(.deviceOwnerAuthentication)`. Native code returns success/failure only—never biometric data. On success, the Dart adapter creates opaque `GeneticReauthenticationProof(scope,nonce,wallAuthenticatedAt,monotonicAuthenticatedAt,localProfileId)`. The lifecycle coordinator accepts it only once, for the exact profile/scope, within five monotonic minutes, and only while the app has not backgrounded, restarted, switched profiles, or detected clock rollback; nonce consumption is serialized with the protected operation. Scopes are exactly `genetics:export`, `genetics:recovery-export`, `genetics:recovery-import`, and `genetics:delete`.

Export requires two identical passphrase entries whose strict UTF-8 encodings are 12–128 bytes. Do not trim, case-fold, NFC/NFKC-normalize, or silently replace malformed input; visually identical but byte-distinct Unicode passphrases remain distinct. Compare confirmation bytes in constant time. Use obscured secure fields with suggestions/autocorrect, semantic value exposure, clipboard copy, logging, analytics, and state restoration disabled; overwrite controller byte buffers best-effort after key derivation without claiming VM zeroization. Import enforces the same byte bounds before Argon2 allocation. Stage ciphertext with a random name in the app-private no-backup temp directory and exclusive create. Never place plaintext on disk. Before sharing, show Korean disclosure that the OS/user can create an external copy that this app cannot later erase.

- [ ] **Step 4: Implement framed streaming crypto and recovery**

Encrypt/decrypt one 64 KiB frame at a time; authenticate the header and final marker; validate all caps before KDF/extraction. Before reading archived safety evidence, install/verify the current app asset and load the current app floor plus protected sequence/root/clock anchor. An archived safety envelope is provenance evidence only and can never lower or replace current trust. Verify every retained JWS under the current registry's historical key material, then parse its strict schema separately: an active key plus a current exact G0 tuple may restore normal state; a retired/revoked key or a formerly signed tuple no longer in current G0 may restore only typed provenance with result/interpretation suppressed; an unknown key, invalid signature, or invalid strict payload aborts recovery. Verify any claimed prior local anchor from the authenticated archive receipt but never promote retired-key recovery to displayable status solely from that receipt. Write recovery to a new temporary SQLCipher vault and atomically swap only after all entries and user confirmation pass. A recovery archive can restore its profile and binding secret on one new device, but does not synchronize changes or revoke the old device.

- [ ] **Step 5: Implement janitor and cryptographic destruction**

Delete the app-private temporary file after successful/cancelled share callback, at 15 minutes using monotonic time, on next app resume, and at startup. Full deletion transitions the coordinator to `destroying`, closes/checkpoints, deletes DB/WAL/SHM/cache/temp files, deletes profile wallet key and binding secret, verifies absence, and returns only counts/time/key-destroyed state. It cannot delete external shared copies and says so. Provenance export and deletion work even when the safety bundle is stale/inconsistent.

- [ ] **Step 6: Run the GREEN archive, recovery, and destruction tests**

Run: `cd apps/mobile && flutter test test/features/genetics/genetic_archive_test.dart test/features/genetics/genetic_reauthentication_test.dart test/features/genetics/genetic_wallet_lifecycle_test.dart`

Expected: every crypto/race/cleanup case passes; recovery has no partial state; deleting genetics leaves the record vault untouched.

- [ ] **Step 7: Commit bounded local archive and deletion**

Commit:

```bash
git add apps/mobile/lib/features/genetics/lifecycle/genetic_archive.dart apps/mobile/lib/features/genetics/lifecycle/genetic_reauthentication.dart apps/mobile/lib/features/genetics/lifecycle/genetic_wallet_lifecycle.dart apps/mobile/android/app/build.gradle.kts apps/mobile/android/gradle/verification-metadata.xml apps/mobile/android/app/src/main/kotlin/kr/co/genomecompanion/mobile/GeneticPrivacyPlugin.kt apps/mobile/android/app/src/androidTest/kotlin/kr/co/genomecompanion/mobile/GeneticPrivacyPluginTest.kt apps/mobile/ios/Runner/GeneticPrivacyPlugin.swift apps/mobile/ios/RunnerTests/GeneticPrivacyPluginTests.swift apps/mobile/test/features/genetics/genetic_archive_test.dart apps/mobile/test/features/genetics/genetic_reauthentication_test.dart apps/mobile/test/features/genetics/genetic_wallet_lifecycle_test.dart
git commit -m "feat(genetics): add bounded local archive and deletion"
```

## Task 8: Prove the no-network, no-leak platform boundary

**Files:**

- Consume unchanged: `supply-chain/tool-artifacts.lock.json`, `scripts/ci/install_bundletool.py`, `scripts/ci/install_android_sdk.py`, `scripts/ci/run_locked_uv.py`
- Create: `packages/genetics-security-tests/package.json`, `packages/genetics-security-tests/vitest.config.ts`
- Modify: `pnpm-lock.yaml`
- Create: `apps/mobile/integration_test/genetic_zero_egress_test.dart`, `apps/mobile/test/features/genetics/genetic_log_leak_test.dart`
- Modify: `apps/mobile/android/app/build.gradle.kts`
- Create: `apps/mobile/android/app/src/androidTest/kotlin/kr/co/genomecompanion/mobile/GeneticReleaseJourneyTest.kt`
- Modify: `apps/mobile/ios/Runner.xcodeproj/project.pbxproj`
- Create: `apps/mobile/ios/RunnerUITests/GeneticReleaseJourneyTests.swift`, `apps/mobile/ios/Runner.xcodeproj/xcshareddata/xcschemes/GeneticReleaseJourney.xcscheme`, `apps/mobile/ios/GeneticReleaseJourney.xctestplan`
- Create: `security/mobile-egress-harness/android/settings.gradle.kts`, `security/mobile-egress-harness/android/build.gradle.kts`, `security/mobile-egress-harness/android/app/build.gradle.kts`, `security/mobile-egress-harness/android/app/src/main/AndroidManifest.xml`, `security/mobile-egress-harness/android/app/src/main/kotlin/kr/co/genomecompanion/egressharness/EgressVpnService.kt`, `security/mobile-egress-harness/android/app/src/main/kotlin/kr/co/genomecompanion/egressharness/CaptureController.kt`
- Create: `security/mobile-egress-harness/android/canary/build.gradle.kts`, `security/mobile-egress-harness/android/canary/src/main/AndroidManifest.xml`, `security/mobile-egress-harness/android/canary/src/main/kotlin/kr/co/genomecompanion/egresscanary/EgressCanaryActivity.kt`
- Create: `security/mobile-egress-harness/ios/PktapCapture.c`, `security/mobile-egress-harness/ios/PktapCapture.h`, `security/mobile-egress-harness/ios/main.swift`
- Create: `packages/contracts/jsonschema/genetic-release-runtime-binding.schema.json`, `packages/contracts/fixtures/genetic-release-runtime-binding.valid.json`, `packages/contracts/jsonschema/genetic-zero-egress-evidence.schema.json`, `packages/contracts/fixtures/genetic-zero-egress-evidence.valid.json`
- Create: `scripts/genetics/build_release_capture_harnesses.py`, `scripts/genetics/prepare_android_release_probe.py`, `scripts/genetics/prepare_ios_release_probe.py`, `scripts/genetics/run_zero_egress_capture.py`, `scripts/genetics/verify_zero_egress_evidence.py`, `scripts/genetics/test_zero_egress_harness.py`
- Create: `security/tests/genetic_endpoint_deny.spec.ts`, `security/tests/genetic_release_permissions.ps1`
- Create: `security/threat-models/genetic-wallet.md`
- Modify: `docs/open-source/approved-oss-register.md` only to record the exact genetics mobile/tooling dependency inventory and licenses

**Interfaces:**

- Consumes: foundation-locked bundletool **1.18.1** asset URL, size `32505571`, and SHA-256 `675786493983787ffa11550bdb7c0715679a44e1643f3ff980a529e9c822595c`; the pinned Android 35/Ubuntu and Xcode 16.4/macOS 15 toolchains; the unsigned `geneticsCandidateRelease` AAB; the separately built release-variant Android instrumentation APK; the repository VPN/canary APKs; the no-codesign device and simulator iOS apps; the standalone no-target-app XCTest runner; complete synthetic journey fixtures; merged manifests/entitlements/privacy manifests; route manifests; and the sensitive canary set.
- Produces: strict Android/iOS runtime-binding records; aggregate hashes for the candidate, test runner, capture harness, and canary binaries; attributed native PCAPNG and DNS evidence; `genetic-zero-egress-evidence.v1`; zero-sensitive-sink report; no-genetic-endpoint proof; backup/screenshot/permission/dependency audit; G0 control-to-test threat-model matrix; and nonzero failure on a missing/corrupt/inactive capture, packet, DNS query, sensitive sink, accepting route, candidate mismatch, target replacement, debug-only journey, canary bypass during readiness, or unapproved package.

- [ ] **Step 1: Write RED contract, capture, journey, and server tests**

`@gc/genetics-security-tests` is a private workspace package with exact dev dependency `vitest=4.1.10`; its config roots at the repository and includes only `security/tests/**/*.spec.ts`. The synthetic journey provisions, imports, views, side-loads safety, explains, exports, recovers, and deletes while Dart/native sink recorders are active. Sink scans include bundle ID, binding, challenge ID, lab report ref, trait/result code, explanation text, and unique canary bytes. `genetic_endpoint_deny.spec.ts` parses every OpenAPI operation and server route and fails any request body, query, header, event, log field, or route related to genetics/genotype/variant/VCF/BAM/FASTQ/polygenic data.

`genetic-release-runtime-binding.v1` is additional-properties-false and exactly `{schemaVersion,platform,sourceSha,candidateSha256,runtimeArtifactSha256,payloadManifestSha256,toolchainLockSha256,captureHarnessSourceSha256,captureHarnessBinarySha256,createdAt,bindingSha256}`. `captureHarnessBinarySha256` is the digest of a strict sorted binary manifest: Android binds the VPN APK, canary APK, release instrumentation APK, test-signed universal target APK, their package/certificate/payload digests, and bundletool digest; iOS binds the pktap collector, standalone `.xctestrun`, XCTest runner bundle, installed simulator `Runner.app`, device candidate, and canonical resource-payload digests. `genetic-zero-egress-evidence.v1` is exactly `{schemaVersion,platform,sourceSha,binding,device,captureReadiness,journey,pcapSha256,pcapByteLength,packetCount,dnsQueryCount,attribution,sensitiveSinkReportSha256,permissionsReportSha256,startedAt,completedAt,evidenceSha256}`. Nested objects are closed and bounded; device IDs and task/process identifiers appear only as SHA-256 digests; all timestamps are UTC `Z`; each self-digest hashes RFC 8785 bytes omitting only itself. Evidence requires a valid PCAPNG section/interface header even when `packetCount=0` and rejects an empty file.

- [ ] **Step 2: Run the RED suite**

```bash
pnpm install --frozen-lockfile
pnpm --filter @gc/genetics-security-tests test -- genetic_endpoint_deny.spec.ts
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python -m pytest scripts/genetics/test_zero_egress_harness.py -q
cd apps/mobile && flutter test integration_test/genetic_zero_egress_test.dart test/features/genetics/genetic_log_leak_test.dart
cd ../.. && pwsh -File security/tests/genetic_release_permissions.ps1 -RepositoryRoot . -StaticOnly
```

Expected: FAIL until the strict schemas, release bindings, native capture harnesses, and package-owned Vitest runner exist.

- [ ] **Step 3: Implement the release-artifact binding and capture harnesses**

`install_bundletool.py` exact-loads the FND lock and installs only the verified jar to `build/tools/bundletool/bundletool-all-1.18.1.jar`; it takes no URL/hash override. Android starts from the already verified unsigned AAB. Task 7's `build.gradle.kts` also sets `testBuildType="release"` for `geneticsCandidate` and creates only `assembleGeneticsCandidateReleaseAndroidTest`; it must not run `connected*`, install, or select a debug target. `prepare_android_release_probe.py` generates two fresh CI-only PKCS#12 keys in a private temp directory, invokes the locked jar twice with `build-apks --mode=universal`, canonicalizes every resulting APK ZIP entry while excluding only APK signing blocks and `META-INF/*.SF|*.RSA|*.DSA|*.EC`, and requires the two payload manifests to match byte-for-byte. It strips any build signature from the standalone instrumentation APK, signs that APK and the chosen universal APK with the same first ephemeral certificate, signs the VPN/canary harness APKs with the independent second ephemeral certificate, emits four read-only APKs plus their strict binary manifest, and deletes both keys and both raw APK sets on every exit. It proves the target/test certificate is neither a production/G0 key nor present in the unsigned AAB, and that the instrumentation manifest has target package `kr.co.genomecompanion.mobile`, runner `androidx.test.runner.AndroidJUnitRunner`, release build marker, no embedded target payload, and no permission beyond UIAutomator/test requirements. The CI-only signatures authorize testing only and neither signed APK nor key is uploaded as a candidate.

The Android harness is a separate minimal `VpnService` app, package `kr.co.genomecompanion.egressharness`; the repository canary is package `kr.co.genomecompanion.egresscanary` and emits exactly one UDP datagram plus one DNS lookup only after a nonce-bearing explicit intent. Readiness destroys any old TUN, configures `Builder.addAllowedApplication("kr.co.genomecompanion.egresscanary")`, starts a fresh baseline PCAPNG, invokes the canary, and fails if either packet is missing—so a canary that bypasses the TUN cannot prove capture. It then stops/unregisters that VPN, deletes and recreates the writer, starts a new VPN whose sole allowlisted package is `kr.co.genomecompanion.mobile`, and machine-checks the effective package/UID filter before measurement; baseline bytes never enter the candidate file. The separately installed release instrumentation APK uses UIAutomator against the already installed target and runs via `adb shell am instrument -w -r kr.co.genomecompanion.mobile.test/androidx.test.runner.AndroidJUnitRunner`. Before and after instrumentation, the runner hashes `pm path` bytes, package version, certificate, every target APK split, and the canonical payload manifest; any uninstall/reinstall/update, UID change, target APK replacement, instrumentation package collision, or debug/test target fails. `GeneticReleaseJourneyTest` writes only a step/duration digest.

On macOS 15, `build_release_capture_harnesses.py` compiles the repository C/Swift pktap collector with `/Applications/Xcode_16.4.app` and system libpcap, records the complete source-tree/toolchain/binary digests, and permits no downloaded capture binary. `prepare_ios_release_probe.py` builds a no-codesign **Release/iphonesimulator** `Runner.app`, separately hashes the no-codesign **Release/iphoneos** candidate, and requires the two canonical Flutter asset/resource manifests plus source/generated-contract digests to agree despite architecture-specific Mach-O bytes. It installs that exact simulator app. The pktap collector first observes a known helper-process UDP/DNS canary, resets to a new PCAPNG, then attributes only packets whose pktap metadata matches the launched Runner PID, process name, executable path, Mach-O UUID, bundle ID, and journey time window. `project.pbxproj` adds a standalone `RunnerUITests` UI-test target with no target application, `TEST_HOST`, or dependency on `Runner`; the shared `GeneticReleaseJourney` scheme builds only that test bundle, and the closed test plan selects only `GeneticReleaseJourneyTests`. `build-for-testing` therefore creates the XCTest runner and `.xctestrun` without rebuilding/installing Runner. The test uses only `XCUIApplication(bundleIdentifier:"kr.co.genomecompanion.mobile")`. `test-without-building` is given the exact generated `.xctestrun`; before/after it, the harness hashes the installed app-container path, complete app tree, Mach-O UUID/content, bundle receipt, and canonical resources and fails on replacement.

Both runners have a 30-second readiness deadline, a 15-minute journey deadline, signal-safe stop, bounded 16 MiB capture, fsync, and mandatory cleanup. `run_zero_egress_capture.py` has only `android-start|android-finish|ios-start|ios-finish|abort`; start validates/records installed bytes, proves the platform canary, recreates the measured capture, and writes a mode-0600 self-digested session. Finish accepts only that session, stops/fsyncs capture, rehashes the installed target, ingests the separately produced journey result, writes evidence atomically, and removes the session; `abort` stops capture and removes ephemeral apps/files without emitting evidence. The verifier independently parses PCAPNG with bounded repository code, rejects truncation/unknown link type/filter drift/PID reuse/time drift, requires baseline canary counts above zero, and requires measured `packetCount=0` and `dnsQueryCount=0`. Dart `HttpOverrides`, Android/iOS URL/socket hooks, logs, crash sink, clipboard, notifications, platform channels, screenshot/app-switcher, and backup extraction are defense-in-depth evidence, never substitutes for the attributed native capture.

- [ ] **Step 4: Enforce manifests, dependencies, and build-time absence of clients**

`genetic_release_permissions.ps1` has exact mandatory-path parameter sets: `-RepositoryRoot -StaticOnly`, `-AndroidAab -RequireUnsigned -ExpectedGradleVariant geneticsCandidateRelease`, or `-IosApp -RequireNoCodesign`; missing paths fail. Static mode inspects Android source/merged manifests, iOS entitlements/Info.plist/privacy manifest, Flutter/Gradle/CocoaPods locks and source imports. Android mode proves `signingConfig=null`, rejects Flutter debug-release fallback, certificates and signature entries, and requires `jarsigner -verify -strict` to report unsigned. iOS mode rejects signatures/profiles. Any dependency not in the OSS register or any network-capable client requires a new G0 envelope and blocks release.

- [ ] **Step 5: Run exact release-mode capture commands on the pinned devices**

Android, after Task 9 boots `emulator-5554`:

```bash
set -euo pipefail
python scripts/ci/install_bundletool.py --destination build/tools/bundletool
cd apps/mobile
flutter build appbundle --release --flavor geneticsCandidate
cd ../..
apps/mobile/android/gradlew --no-daemon -p apps/mobile/android :app:assembleGeneticsCandidateReleaseAndroidTest
apps/mobile/android/gradlew --no-daemon -p security/mobile-egress-harness/android :app:assembleRelease :canary:assembleRelease
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/genetics/prepare_android_release_probe.py --aab apps/mobile/build/app/outputs/bundle/geneticsCandidateRelease/app-geneticsCandidate-release.aab --instrumentation-apk apps/mobile/build/app/outputs/apk/androidTest/geneticsCandidate/release/app-geneticsCandidate-release-androidTest.apk --vpn-apk security/mobile-egress-harness/android/app/build/outputs/apk/release/app-release-unsigned.apk --canary-apk security/mobile-egress-harness/android/canary/build/outputs/apk/release/canary-release-unsigned.apk --bundletool build/tools/bundletool/bundletool-all-1.18.1.jar --out-dir build/genetics-evidence/android-probe
adb -s emulator-5554 install --no-streaming build/genetics-evidence/android-probe/target-universal.apk
adb -s emulator-5554 install --no-streaming build/genetics-evidence/android-probe/journey-test.apk
adb -s emulator-5554 install --no-streaming build/genetics-evidence/android-probe/vpn-harness.apk
adb -s emulator-5554 install --no-streaming build/genetics-evidence/android-probe/egress-canary.apk
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/genetics/run_zero_egress_capture.py android-start --device emulator-5554 --binding build/genetics-evidence/android-probe/binding.json --session build/genetics-evidence/android/session.json --out-dir build/genetics-evidence/android
trap 'python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/genetics/run_zero_egress_capture.py abort --session build/genetics-evidence/android/session.json' EXIT
adb -s emulator-5554 shell am instrument -w -r kr.co.genomecompanion.mobile.test/androidx.test.runner.AndroidJUnitRunner | tee build/genetics-evidence/android/journey.txt
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/genetics/run_zero_egress_capture.py android-finish --session build/genetics-evidence/android/session.json --journey-result build/genetics-evidence/android/journey.txt --out-dir build/genetics-evidence/android
trap - EXIT
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/genetics/verify_zero_egress_evidence.py --evidence build/genetics-evidence/android/evidence.json --pcap build/genetics-evidence/android/candidate.pcapng --binding build/genetics-evidence/android-probe/binding.json
```

iOS, after Task 9 boots `$GC_GENETICS_SIMULATOR_UDID`:

```bash
set -euo pipefail
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/genetics/build_release_capture_harnesses.py ios --xcode /Applications/Xcode_16.4.app --out build/tools/genetics-capture/ios
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/genetics/prepare_ios_release_probe.py --simulator "$GC_GENETICS_SIMULATOR_UDID" --device-app apps/mobile/build/ios/iphoneos/Runner.app --capture-tool build/tools/genetics-capture/ios/gc-pktap-capture --out-dir build/genetics-evidence/ios-probe
xcodebuild build-for-testing -workspace apps/mobile/ios/Runner.xcworkspace -scheme GeneticReleaseJourney -testPlan GeneticReleaseJourney -configuration Release -sdk iphonesimulator -destination "platform=iOS Simulator,id=$GC_GENETICS_SIMULATOR_UDID" -derivedDataPath build/genetics-uitest CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO
GC_GENETICS_XCTESTRUN="$(python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/genetics/prepare_ios_release_probe.py locate-xctestrun --derived-data build/genetics-uitest)"
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/genetics/prepare_ios_release_probe.py bind-test-runner --xctestrun "$GC_GENETICS_XCTESTRUN" --probe-dir build/genetics-evidence/ios-probe
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/genetics/run_zero_egress_capture.py ios-start --simulator "$GC_GENETICS_SIMULATOR_UDID" --binding build/genetics-evidence/ios-probe/binding.json --session build/genetics-evidence/ios/session.json --out-dir build/genetics-evidence/ios
trap 'python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/genetics/run_zero_egress_capture.py abort --session build/genetics-evidence/ios/session.json' EXIT
xcodebuild test-without-building -xctestrun "$GC_GENETICS_XCTESTRUN" -destination "platform=iOS Simulator,id=$GC_GENETICS_SIMULATOR_UDID" -resultBundlePath build/genetics-evidence/ios/GeneticReleaseJourney.xcresult
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/genetics/run_zero_egress_capture.py ios-finish --session build/genetics-evidence/ios/session.json --journey-result build/genetics-evidence/ios/GeneticReleaseJourney.xcresult --out-dir build/genetics-evidence/ios
trap - EXIT
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/genetics/verify_zero_egress_evidence.py --evidence build/genetics-evidence/ios/evidence.json --pcap build/genetics-evidence/ios/candidate.pcapng --binding build/genetics-evidence/ios-probe/binding.json
```

- [ ] **Step 6: Complete the threat model and run GREEN static/unit checks**

Map every G0 control to automated or named manual evidence, owner, date, artifact digest, and residual risk, including rooted/jailbroken compromise, memory forensics, malicious files, root compromise, recall/rollback, screenshot/second-camera limits, external copies, key loss, reinstall/multi-device/account switching, clock manipulation, accessibility, and emergency app-release/side-load distribution. Then run:

```bash
pnpm install --frozen-lockfile
pnpm --filter @gc/genetics-security-tests test -- genetic_endpoint_deny.spec.ts
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python -m pytest scripts/genetics/test_zero_egress_harness.py -q
cd apps/mobile && flutter test test/features/genetics/genetic_log_leak_test.dart
cd ../.. && pwsh -File security/tests/genetic_release_permissions.ps1 -RepositoryRoot . -StaticOnly
```

Expected: unit/static checks pass, and the platform commands produce strict nonempty capture containers with a proven live canary but zero candidate packets, DNS queries, sensitive sinks, endpoints, permissions, backup paths, or unapproved dependencies.

- [ ] **Step 7: Commit the offline privacy-boundary harness**

```bash
git add packages/genetics-security-tests/package.json packages/genetics-security-tests/vitest.config.ts pnpm-lock.yaml apps/mobile/integration_test/genetic_zero_egress_test.dart apps/mobile/test/features/genetics/genetic_log_leak_test.dart apps/mobile/android/app/build.gradle.kts apps/mobile/android/app/src/androidTest/kotlin/kr/co/genomecompanion/mobile/GeneticReleaseJourneyTest.kt apps/mobile/ios/Runner.xcodeproj/project.pbxproj apps/mobile/ios/Runner.xcodeproj/xcshareddata/xcschemes/GeneticReleaseJourney.xcscheme apps/mobile/ios/GeneticReleaseJourney.xctestplan apps/mobile/ios/RunnerUITests/GeneticReleaseJourneyTests.swift security/mobile-egress-harness packages/contracts/jsonschema/genetic-release-runtime-binding.schema.json packages/contracts/fixtures/genetic-release-runtime-binding.valid.json packages/contracts/jsonschema/genetic-zero-egress-evidence.schema.json packages/contracts/fixtures/genetic-zero-egress-evidence.valid.json scripts/genetics/build_release_capture_harnesses.py scripts/genetics/prepare_android_release_probe.py scripts/genetics/prepare_ios_release_probe.py scripts/genetics/run_zero_egress_capture.py scripts/genetics/verify_zero_egress_evidence.py scripts/genetics/test_zero_egress_harness.py security/tests/genetic_endpoint_deny.spec.ts security/tests/genetic_release_permissions.ps1 security/threat-models/genetic-wallet.md docs/open-source/approved-oss-register.md
git commit -m "test(genetics): prove release-mode offline boundary"
```

## Task 9: Add foundation-owned CI marker jobs and release evidence

**Files:**

- Consume unchanged: `supply-chain/tool-artifacts.lock.json`, `scripts/ci/install_uv.py`, `scripts/ci/run_locked_uv.py`, `scripts/tests/test_run_locked_uv.py`
- Consume unchanged: `scripts/ci/install_bundletool.py`, Task 8 capture/binding schemas, harnesses, and verifier
- Modify only marked steps in `.github/workflows/ci.yml`
- Modify only marked steps in `.github/workflows/release.yml`
- Create: `security/tests/genetic_ci_contract_test.py`
- Create: `packages/contracts/jsonschema/genetic-release-evidence-manifest.schema.json`, `packages/contracts/jsonschema/genetic-release-signing-request.schema.json`, `packages/contracts/jsonschema/genetic-release-authorization.schema.json`, `packages/contracts/jsonschema/genetic-release-candidate-handoff.schema.json`
- Create: `packages/contracts/fixtures/genetic-release-evidence-manifest.valid.json`, `packages/contracts/fixtures/genetic-release-authorization.valid.json`
- Create: `scripts/genetics/build_release_authorization_request.py`, `scripts/genetics/assemble_release_authorization.py`, `scripts/genetics/verify_release_authorization.py`, `scripts/genetics/release_candidate_handoff.py`, `scripts/genetics/test_release_authorization.py`
- Regenerate/verify: `security/sbom/genetics-governance.cdx.json`, `security/licenses/genetics-governance.json`

**Interfaces:**

- Consumes: foundation-owned exact jobs/markers/runners/actions; uv and bundletool locked installers; Python 3.12.13 and the frozen genetics tool project; protected G0 and safety values; Flutter/mobile locks; pinned Android/iOS devices; all Tasks 1–8 tests; candidate-run GitHub artifact ID/digest coordinates; seven detached role signatures; and protected `GENETICS_RELEASE_ID`, `GENETICS_RELEASE_CANDIDATE_COMMIT`, and `GENETICS_RELEASE_ENVELOPE_SHA256`.
- Produces: gated Ubuntu Android and macOS iOS release-mode evidence; source-bound, dependency-locked unsigned AAB and no-codesign iOS candidates without an unproven bit-reproducibility claim; native zero-egress evidence; SBOM/licenses/checksums/provenance; an exact seven-role DSSE release authorization on an immutable candidate commit; and authorized GitHub evidence archives only. It produces no mobile distribution signature, store upload, deployment, or publication.

**Ownership contract:** `.github/workflows/ci.yml` and `.github/workflows/release.yml` are owned by the platform-foundation plan. Genetics may edit only the exact pre-created step regions inside the named jobs below:

```yaml
# .github/workflows/ci.yml, job: gen_android_workstream (pinned Ubuntu)
# BEGIN GEN ANDROID WORKSTREAM STEPS
# END GEN ANDROID WORKSTREAM STEPS
# .github/workflows/ci.yml, job: gen_ios_workstream (pinned macOS)
# BEGIN GEN IOS WORKSTREAM STEPS
# END GEN IOS WORKSTREAM STEPS
# .github/workflows/release.yml, job: gen_android_release (pinned Ubuntu)
# BEGIN GEN ANDROID RELEASE STEPS
# END GEN ANDROID RELEASE STEPS
# .github/workflows/release.yml, job: gen_ios_release (pinned macOS)
# BEGIN GEN IOS RELEASE STEPS
# END GEN IOS RELEASE STEPS
```

If any job or marker pair is absent, renamed, or duplicated, stop and complete the foundation-plan marker amendment first. Never append a second workflow, rename foundation jobs, or edit outside the markers. Android/contract work runs in `gen_android_workstream` on pinned Ubuntu; iOS build/platform tests run in `gen_ios_workstream` on pinned macOS. Candidate packaging/evidence repeats in the corresponding release jobs without publishing to an app store.

- [ ] **Step 1: Write a RED marker/CI contract test**

`security/tests/genetic_ci_contract_test.py` asserts the four exact job names and marker pairs, `ubuntu-24.04`, FND `install_android_sdk.py` profile `api35-google-apis-x86_64`, Android API 35 `google_apis;x86_64`, build-tools 35.0.0, platform-tools 37.0.1, emulator 37.2.3, image revision 9, AVD `gc_genetics_api35`, no `sdkmanager`/license/latest path, FND bundletool 1.18.1, `macos-15`, Xcode 16.4, iPhone 16/iOS 18.5, pinned checkout/upload/download action SHAs, Flutter 3.44.7, Dart >=3.12, protected G0/safety/release digest inputs, `flutter pub get --enforce-lockfile`, double generator comparison, governance/schema tests, release-mode Android/iOS journey and native capture commands, permission/dependency scans, package-owned endpoint deny, candidate-artifact exact download, seven-role authorization verification, and uploaded hashed authorized evidence. It proves debug integration output cannot satisfy release evidence and no genetics step appears outside those four marker regions.

- [ ] **Step 2: Run the RED marker and CI contract test**

Run: `python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python -m pytest security/tests/genetic_ci_contract_test.py -q`

Expected: FAIL because genetics jobs are not populated.

- [ ] **Step 3: Populate the Android CI/release marker regions**

Reuse foundation-pinned checkout/cache actions. Pin `subosito/flutter-action` to commit `1a449444c387b1966244ae4d4f8c696479add0b2` with Flutter `3.44.7`; pin `actions/setup-python` to `ece7cb06caefa5fff74198d8649806c4678c61a1` with `python-version: '3.12.13'`; install uv only through the foundation-owned hashed artifact installer. Android SDK/API/image/AVD setup uses only FND's unchanged `install_android_sdk.py` and the exact `api35-google-apis-x86_64` lock profile; bundletool uses only FND's unchanged installer. No tag, floating Python reference, package-index uv install, `sdkmanager`, mutable `cmdline-tools/latest`, unverified Android package, or installer-script download is allowed. Both jobs execute this root-level preflight before any genetics test:

```bash
python -c 'import sys; assert sys.version_info[:3] == (3, 12, 13)'
export UV_PYTHON_DOWNLOADS=never
python scripts/ci/run_locked_uv.py -- --version
python scripts/ci/run_locked_uv.py -- lock --project tooling/genetics --check
python scripts/ci/run_locked_uv.py -- sync --project tooling/genetics --frozen --all-groups
python scripts/ci/run_locked_uv.py -- export --project tooling/genetics --frozen --all-groups --format cyclonedx1.5 --output-file security/sbom/genetics-governance.cdx.json
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/governance/export_genetics_tooling_licenses.py --policy tooling/genetics/license-policy.json --output security/licenses/genetics-governance.json
git diff --exit-code -- tooling/genetics/uv.lock security/sbom/genetics-governance.cdx.json security/licenses/genetics-governance.json
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python -m pytest scripts/governance/test_genetics_g0.py scripts/contracts/test_genetic_contracts.py scripts/genetics/test_safety_bundle.py scripts/genetics/test_zero_egress_harness.py scripts/genetics/test_release_authorization.py security/tests/genetic_ci_contract_test.py -q
: "${GENETICS_G0_GATE_ID:?set protected GENETICS_G0_GATE_ID}"
: "${GENETICS_G0_TRUST_ROOT_SHA256:?set protected GENETICS_G0_TRUST_ROOT_SHA256}"
: "${GENETICS_G0_ENVELOPE_SHA256:?set protected GENETICS_G0_ENVELOPE_SHA256}"
: "${GENETICS_G0_CANDIDATE_COMMIT:?set protected GENETICS_G0_CANDIDATE_COMMIT}"
: "${GENETICS_SAFETY_SEQUENCE:?set protected positive safety sequence}"
: "${GENETICS_SAFETY_CANDIDATE_COMMIT:?set protected safety candidate commit}"
: "${GENETICS_SAFETY_ENVELOPE_SHA256:?set protected safety envelope digest}"
[[ "$GENETICS_G0_GATE_ID" =~ ^g0-[0-9]{8}-[0-9]{4}$ ]]
[[ "$GENETICS_SAFETY_SEQUENCE" =~ ^[1-9][0-9]{0,9}$ ]]
G0_ENVELOPE="governance/genetics/gates/g0/${GENETICS_G0_GATE_ID}.dsse.json"
test -f "$G0_ENVELOPE"
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/governance/verify_genetics_g0.py "$G0_ENVELOPE" --trust-root-sha256 "$GENETICS_G0_TRUST_ROOT_SHA256" --envelope-sha256 "$GENETICS_G0_ENVELOPE_SHA256"
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/genetics/verify_safety_bundle.py apps/mobile/assets/genetics/safety-bundle.dsse.json --expected-sequence "$GENETICS_SAFETY_SEQUENCE" --expected-envelope-sha256 "$GENETICS_SAFETY_ENVELOPE_SHA256" --expected-candidate-commit "$GENETICS_SAFETY_CANDIDATE_COMMIT"
```

The G0 job reads the protected public expected digests and stops all downstream jobs on failure.

The CI Ubuntu job runs on `ubuntu-24.04`. It requires Android SDK platform 35, build-tools 35.0.0, and `system-images;android-35;google_apis;x86_64`; creates AVD `gc_genetics_api35`; boots it as `emulator-5554`; and fails if `adb shell getprop sys.boot_completed` is not `1`. It then runs:

```bash
set -euo pipefail
cd apps/mobile
flutter pub get --enforce-lockfile
python "$GITHUB_WORKSPACE/scripts/ci/run_locked_uv.py" -- run --project "$GITHUB_WORKSPACE/tooling/genetics" --frozen python "$GITHUB_WORKSPACE/scripts/contracts/generate_genetic_dart.py"
sha256sum lib/features/genetics/domain/*.g.dart lib/features/genetics/crypto/genetic_release_roots.g.dart > /tmp/genetics-generated.first
python "$GITHUB_WORKSPACE/scripts/ci/run_locked_uv.py" -- run --project "$GITHUB_WORKSPACE/tooling/genetics" --frozen python "$GITHUB_WORKSPACE/scripts/contracts/generate_genetic_dart.py"
sha256sum lib/features/genetics/domain/*.g.dart lib/features/genetics/crypto/genetic_release_roots.g.dart | diff -u /tmp/genetics-generated.first -
git diff --exit-code -- lib/features/genetics ../../packages/contracts/genetics
flutter test
flutter build appbundle --release --flavor geneticsCandidate
pwsh -File "$GITHUB_WORKSPACE/security/tests/genetic_release_permissions.ps1" -AndroidAab build/app/outputs/bundle/geneticsCandidateRelease/app-geneticsCandidate-release.aab -RequireUnsigned -ExpectedGradleVariant geneticsCandidateRelease
cd "$GITHUB_WORKSPACE"
python scripts/ci/install_bundletool.py --destination build/tools/bundletool
apps/mobile/android/gradlew --no-daemon -p apps/mobile/android :app:assembleGeneticsCandidateReleaseAndroidTest
apps/mobile/android/gradlew --no-daemon -p security/mobile-egress-harness/android :app:assembleRelease :canary:assembleRelease
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/genetics/prepare_android_release_probe.py --aab apps/mobile/build/app/outputs/bundle/geneticsCandidateRelease/app-geneticsCandidate-release.aab --instrumentation-apk apps/mobile/build/app/outputs/apk/androidTest/geneticsCandidate/release/app-geneticsCandidate-release-androidTest.apk --vpn-apk security/mobile-egress-harness/android/app/build/outputs/apk/release/app-release-unsigned.apk --canary-apk security/mobile-egress-harness/android/canary/build/outputs/apk/release/canary-release-unsigned.apk --bundletool build/tools/bundletool/bundletool-all-1.18.1.jar --out-dir build/genetics-evidence/android-probe
adb -s emulator-5554 install --no-streaming build/genetics-evidence/android-probe/target-universal.apk
adb -s emulator-5554 install --no-streaming build/genetics-evidence/android-probe/journey-test.apk
adb -s emulator-5554 install --no-streaming build/genetics-evidence/android-probe/vpn-harness.apk
adb -s emulator-5554 install --no-streaming build/genetics-evidence/android-probe/egress-canary.apk
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/genetics/run_zero_egress_capture.py android-start --device emulator-5554 --binding build/genetics-evidence/android-probe/binding.json --session build/genetics-evidence/android/session.json --out-dir build/genetics-evidence/android
trap 'python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/genetics/run_zero_egress_capture.py abort --session build/genetics-evidence/android/session.json' EXIT
adb -s emulator-5554 shell am instrument -w -r kr.co.genomecompanion.mobile.test/androidx.test.runner.AndroidJUnitRunner | tee build/genetics-evidence/android/journey.txt
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/genetics/run_zero_egress_capture.py android-finish --session build/genetics-evidence/android/session.json --journey-result build/genetics-evidence/android/journey.txt --out-dir build/genetics-evidence/android
trap - EXIT
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/genetics/verify_zero_egress_evidence.py --evidence build/genetics-evidence/android/evidence.json --pcap build/genetics-evidence/android/candidate.pcapng --binding build/genetics-evidence/android-probe/binding.json
```

The marker uses these exact setup commands; missing locked SDK/image/KVM capability or an incomplete bounded boot is a failure, never a skipped test. The installer validates all six exact archive revisions/sizes/SHA-1/SHA-256 rows, creates only `gc_genetics_api35`, and exports no mutable `latest` path:

```bash
sudo setfacl -m "u:$(id -un):rw" /dev/kvm
test -r /dev/kvm && test -w /dev/kvm
python scripts/ci/install_android_sdk.py --profile api35-google-apis-x86_64 --destination "$GITHUB_WORKSPACE/build/tools/android-sdk" --avd-destination "$GITHUB_WORKSPACE/build/tools/android-avd" --avd-name gc_genetics_api35
export ANDROID_SDK_ROOT="$GITHUB_WORKSPACE/build/tools/android-sdk"
export ANDROID_HOME="$ANDROID_SDK_ROOT"
export ANDROID_AVD_HOME="$GITHUB_WORKSPACE/build/tools/android-avd"
printf 'ANDROID_SDK_ROOT=%s\nANDROID_HOME=%s\nANDROID_AVD_HOME=%s\n' "$ANDROID_SDK_ROOT" "$ANDROID_HOME" "$ANDROID_AVD_HOME" >> "$GITHUB_ENV"
printf '%s\n' "$ANDROID_SDK_ROOT/platform-tools" >> "$GITHUB_PATH"
"$ANDROID_SDK_ROOT/emulator/emulator" -avd gc_genetics_api35 -no-window -no-audio -no-boot-anim -gpu swiftshader_indirect -no-snapshot &
"$ANDROID_SDK_ROOT/platform-tools/adb" wait-for-device
for i in $(seq 1 120); do
  test "$("$ANDROID_SDK_ROOT/platform-tools/adb" -s emulator-5554 shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" && break
  test "$i" -lt 120 || exit 1
  sleep 2
done
```

- [ ] **Step 4: Populate the iOS CI/release marker regions**

The CI macOS job runs on `macos-15`, selects `/Applications/Xcode_16.4.app`, requires `xcodebuild -version` to report 16.4, and fails unless runtime `com.apple.CoreSimulator.SimRuntime.iOS-18-5` plus device type `com.apple.CoreSimulator.SimDeviceType.iPhone-16` exist. It creates a fresh simulator and exports its UDID:

```bash
set -euo pipefail
sudo xcode-select -s /Applications/Xcode_16.4.app/Contents/Developer
test "$(xcodebuild -version | head -1)" = "Xcode 16.4"
export GC_GENETICS_SIMULATOR_UDID="$(xcrun simctl create GCGenetics com.apple.CoreSimulator.SimDeviceType.iPhone-16 com.apple.CoreSimulator.SimRuntime.iOS-18-5)"
xcrun simctl boot "$GC_GENETICS_SIMULATOR_UDID"
xcrun simctl bootstatus "$GC_GENETICS_SIMULATOR_UDID" -b
cd apps/mobile
flutter pub get --enforce-lockfile
python "$GITHUB_WORKSPACE/scripts/ci/run_locked_uv.py" -- run --project "$GITHUB_WORKSPACE/tooling/genetics" --frozen python "$GITHUB_WORKSPACE/scripts/contracts/generate_genetic_dart.py"
shasum -a 256 lib/features/genetics/domain/*.g.dart lib/features/genetics/crypto/genetic_release_roots.g.dart > /tmp/genetics-generated.first
python "$GITHUB_WORKSPACE/scripts/ci/run_locked_uv.py" -- run --project "$GITHUB_WORKSPACE/tooling/genetics" --frozen python "$GITHUB_WORKSPACE/scripts/contracts/generate_genetic_dart.py"
shasum -a 256 lib/features/genetics/domain/*.g.dart lib/features/genetics/crypto/genetic_release_roots.g.dart | diff -u /tmp/genetics-generated.first -
git diff --exit-code -- lib/features/genetics ../../packages/contracts/genetics
flutter test
flutter build ios --release --no-codesign
pwsh -File "$GITHUB_WORKSPACE/security/tests/genetic_release_permissions.ps1" -IosApp build/ios/iphoneos/Runner.app -RequireNoCodesign
cd "$GITHUB_WORKSPACE"
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/genetics/build_release_capture_harnesses.py ios --xcode /Applications/Xcode_16.4.app --out build/tools/genetics-capture/ios
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/genetics/prepare_ios_release_probe.py --simulator "$GC_GENETICS_SIMULATOR_UDID" --device-app apps/mobile/build/ios/iphoneos/Runner.app --capture-tool build/tools/genetics-capture/ios/gc-pktap-capture --out-dir build/genetics-evidence/ios-probe
xcodebuild build-for-testing -workspace apps/mobile/ios/Runner.xcworkspace -scheme GeneticReleaseJourney -testPlan GeneticReleaseJourney -configuration Release -sdk iphonesimulator -destination "platform=iOS Simulator,id=$GC_GENETICS_SIMULATOR_UDID" -derivedDataPath build/genetics-uitest CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO
GC_GENETICS_XCTESTRUN="$(python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/genetics/prepare_ios_release_probe.py locate-xctestrun --derived-data build/genetics-uitest)"
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/genetics/prepare_ios_release_probe.py bind-test-runner --xctestrun "$GC_GENETICS_XCTESTRUN" --probe-dir build/genetics-evidence/ios-probe
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/genetics/run_zero_egress_capture.py ios-start --simulator "$GC_GENETICS_SIMULATOR_UDID" --binding build/genetics-evidence/ios-probe/binding.json --session build/genetics-evidence/ios/session.json --out-dir build/genetics-evidence/ios
trap 'python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/genetics/run_zero_egress_capture.py abort --session build/genetics-evidence/ios/session.json' EXIT
xcodebuild test-without-building -xctestrun "$GC_GENETICS_XCTESTRUN" -destination "platform=iOS Simulator,id=$GC_GENETICS_SIMULATOR_UDID" -resultBundlePath build/genetics-evidence/ios/GeneticReleaseJourney.xcresult
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/genetics/run_zero_egress_capture.py ios-finish --session build/genetics-evidence/ios/session.json --journey-result build/genetics-evidence/ios/GeneticReleaseJourney.xcresult --out-dir build/genetics-evidence/ios
trap - EXIT
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/genetics/verify_zero_egress_evidence.py --evidence build/genetics-evidence/ios/evidence.json --pcap build/genetics-evidence/ios/candidate.pcapng --binding build/genetics-evidence/ios-probe/binding.json
```

Both jobs also run governance/safety/schema verification, permission/dependency scans, package-owned endpoint deny, and secret/log scans. The release jobs repeat G0/digest checks and package only unsigned Android plus no-codesign iOS evidence after CI succeeds. Preliminary runs upload `genetics-android-candidate-evidence` and `genetics-ios-candidate-evidence` with a SHA-256 manifest through the pinned upload action; these are review inputs, not authorized release archives. Authorized reruns use pinned `actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093`, exact repository/run/artifact IDs and digests from the seven-role manifest, and `actions:read` plus `contents:read`; they upload an `authorized-*` archive only after Step 8 verification. The workflow token cannot list arbitrary runs/artifacts in script or write repository contents. Mobile signing, key/certificate/profile custody, and Google Play/App Store publication remain blocked on the separate founder-approved mobile-signing/release plan.

- [ ] **Step 5: Run the common GREEN governance and static acceptance sequence**

```bash
python scripts/ci/run_locked_uv.py -- lock --project tooling/genetics --check
python scripts/ci/run_locked_uv.py -- sync --project tooling/genetics --frozen --all-groups
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python -m pytest scripts/governance/test_genetics_g0.py scripts/contracts/test_genetic_contracts.py scripts/genetics/test_safety_bundle.py scripts/genetics/test_zero_egress_harness.py scripts/genetics/test_release_authorization.py security/tests/genetic_ci_contract_test.py -q
: "${GENETICS_G0_GATE_ID:?set protected GENETICS_G0_GATE_ID}"
: "${GENETICS_G0_TRUST_ROOT_SHA256:?set protected GENETICS_G0_TRUST_ROOT_SHA256}"
: "${GENETICS_G0_ENVELOPE_SHA256:?set protected GENETICS_G0_ENVELOPE_SHA256}"
: "${GENETICS_G0_CANDIDATE_COMMIT:?set protected GENETICS_G0_CANDIDATE_COMMIT}"
: "${GENETICS_SAFETY_SEQUENCE:?set protected positive safety sequence}"
: "${GENETICS_SAFETY_CANDIDATE_COMMIT:?set protected safety candidate commit}"
: "${GENETICS_SAFETY_ENVELOPE_SHA256:?set protected safety envelope digest}"
[[ "$GENETICS_G0_GATE_ID" =~ ^g0-[0-9]{8}-[0-9]{4}$ ]]
[[ "$GENETICS_SAFETY_SEQUENCE" =~ ^[1-9][0-9]{0,9}$ ]]
G0_ENVELOPE="governance/genetics/gates/g0/${GENETICS_G0_GATE_ID}.dsse.json"
test -f "$G0_ENVELOPE"
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/governance/verify_genetics_g0.py "$G0_ENVELOPE" --trust-root-sha256 "$GENETICS_G0_TRUST_ROOT_SHA256" --envelope-sha256 "$GENETICS_G0_ENVELOPE_SHA256"
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/governance/render_genetic_authorization.py
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/governance/render_genetic_content_authorization.py
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/governance/render_genetic_trust_bootstrap.py
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/genetics/verify_safety_bundle.py apps/mobile/assets/genetics/safety-bundle.dsse.json --expected-sequence "$GENETICS_SAFETY_SEQUENCE" --expected-envelope-sha256 "$GENETICS_SAFETY_ENVELOPE_SHA256" --expected-candidate-commit "$GENETICS_SAFETY_CANDIDATE_COMMIT"
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/contracts/generate_genetic_dart.py
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/contracts/check_genetic_generation.py
git diff --exit-code -- packages/contracts/genetics/g0-authorized-tuples.json packages/contracts/genetics/g0-authorized-content.json packages/contracts/genetics/g0-release-trust.json apps/mobile/lib/features/genetics/domain apps/mobile/lib/features/genetics/crypto/genetic_release_roots.g.dart
pnpm install --frozen-lockfile
pnpm --filter @gc/genetics-security-tests test -- genetic_endpoint_deny.spec.ts
pwsh -File security/tests/genetic_release_permissions.ps1 -RepositoryRoot . -StaticOnly
git diff --check
```

Expected: governance, G0, safety, schema generation, endpoint-deny, static permission/dependency, and repository-diff gates pass before either platform job runs.

- [ ] **Step 6: Run the GREEN Android device and unsigned-candidate gate**

Run inside `gen_android_workstream` on `ubuntu-24.04` after Step 3 has created and booted `gc_genetics_api35` as `emulator-5554`:

```bash
set -euo pipefail
test "$(adb -s emulator-5554 shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1"
cd apps/mobile
flutter pub get --enforce-lockfile
flutter test
flutter build appbundle --release --flavor geneticsCandidate
pwsh -File ../../security/tests/genetic_release_permissions.ps1 -AndroidAab build/app/outputs/bundle/geneticsCandidateRelease/app-geneticsCandidate-release.aab -RequireUnsigned -ExpectedGradleVariant geneticsCandidateRelease
cd ../..
python scripts/ci/install_bundletool.py --destination build/tools/bundletool
apps/mobile/android/gradlew --no-daemon -p apps/mobile/android :app:assembleGeneticsCandidateReleaseAndroidTest
apps/mobile/android/gradlew --no-daemon -p security/mobile-egress-harness/android :app:assembleRelease :canary:assembleRelease
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/genetics/prepare_android_release_probe.py --aab apps/mobile/build/app/outputs/bundle/geneticsCandidateRelease/app-geneticsCandidate-release.aab --instrumentation-apk apps/mobile/build/app/outputs/apk/androidTest/geneticsCandidate/release/app-geneticsCandidate-release-androidTest.apk --vpn-apk security/mobile-egress-harness/android/app/build/outputs/apk/release/app-release-unsigned.apk --canary-apk security/mobile-egress-harness/android/canary/build/outputs/apk/release/canary-release-unsigned.apk --bundletool build/tools/bundletool/bundletool-all-1.18.1.jar --out-dir build/genetics-evidence/android-probe
adb -s emulator-5554 install --no-streaming build/genetics-evidence/android-probe/target-universal.apk
adb -s emulator-5554 install --no-streaming build/genetics-evidence/android-probe/journey-test.apk
adb -s emulator-5554 install --no-streaming build/genetics-evidence/android-probe/vpn-harness.apk
adb -s emulator-5554 install --no-streaming build/genetics-evidence/android-probe/egress-canary.apk
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/genetics/run_zero_egress_capture.py android-start --device emulator-5554 --binding build/genetics-evidence/android-probe/binding.json --session build/genetics-evidence/android/session.json --out-dir build/genetics-evidence/android
trap 'python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/genetics/run_zero_egress_capture.py abort --session build/genetics-evidence/android/session.json' EXIT
adb -s emulator-5554 shell am instrument -w -r kr.co.genomecompanion.mobile.test/androidx.test.runner.AndroidJUnitRunner | tee build/genetics-evidence/android/journey.txt
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/genetics/run_zero_egress_capture.py android-finish --session build/genetics-evidence/android/session.json --journey-result build/genetics-evidence/android/journey.txt --out-dir build/genetics-evidence/android
trap - EXIT
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/genetics/verify_zero_egress_evidence.py --evidence build/genetics-evidence/android/evidence.json --pcap build/genetics-evidence/android/candidate.pcapng --binding build/genetics-evidence/android-probe/binding.json
```

Expected: Flutter unit tests pass; the journey executes against the test-signed APK derived from the same unsigned AAB; baseline capture proves live; candidate capture has zero attributed packets/DNS; and the AAB/runtime-binding/evidence SHA-256 values are recorded by `gen_android_release`. A debug APK or `connectedDebugAndroidTest` result cannot satisfy this gate.

- [ ] **Step 7: Run the GREEN iOS simulator and no-codesign-candidate gate**

Run inside `gen_ios_workstream` on `macos-15` after Step 4 has created and booted the pinned iPhone 16/iOS 18.5 simulator:

```bash
set -euo pipefail
: "${GC_GENETICS_SIMULATOR_UDID:?Step 4 must export GC_GENETICS_SIMULATOR_UDID}"
xcrun simctl bootstatus "$GC_GENETICS_SIMULATOR_UDID" -b
cd apps/mobile
flutter pub get --enforce-lockfile
flutter test
flutter build ios --release --no-codesign
pwsh -File ../../security/tests/genetic_release_permissions.ps1 -IosApp build/ios/iphoneos/Runner.app -RequireNoCodesign
cd ../..
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/genetics/build_release_capture_harnesses.py ios --xcode /Applications/Xcode_16.4.app --out build/tools/genetics-capture/ios
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/genetics/prepare_ios_release_probe.py --simulator "$GC_GENETICS_SIMULATOR_UDID" --device-app apps/mobile/build/ios/iphoneos/Runner.app --capture-tool build/tools/genetics-capture/ios/gc-pktap-capture --out-dir build/genetics-evidence/ios-probe
xcodebuild build-for-testing -workspace apps/mobile/ios/Runner.xcworkspace -scheme GeneticReleaseJourney -testPlan GeneticReleaseJourney -configuration Release -sdk iphonesimulator -destination "platform=iOS Simulator,id=$GC_GENETICS_SIMULATOR_UDID" -derivedDataPath build/genetics-uitest CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO
GC_GENETICS_XCTESTRUN="$(python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/genetics/prepare_ios_release_probe.py locate-xctestrun --derived-data build/genetics-uitest)"
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/genetics/prepare_ios_release_probe.py bind-test-runner --xctestrun "$GC_GENETICS_XCTESTRUN" --probe-dir build/genetics-evidence/ios-probe
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/genetics/run_zero_egress_capture.py ios-start --simulator "$GC_GENETICS_SIMULATOR_UDID" --binding build/genetics-evidence/ios-probe/binding.json --session build/genetics-evidence/ios/session.json --out-dir build/genetics-evidence/ios
trap 'python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/genetics/run_zero_egress_capture.py abort --session build/genetics-evidence/ios/session.json' EXIT
xcodebuild test-without-building -xctestrun "$GC_GENETICS_XCTESTRUN" -destination "platform=iOS Simulator,id=$GC_GENETICS_SIMULATOR_UDID" -resultBundlePath build/genetics-evidence/ios/GeneticReleaseJourney.xcresult
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/genetics/run_zero_egress_capture.py ios-finish --session build/genetics-evidence/ios/session.json --journey-result build/genetics-evidence/ios/GeneticReleaseJourney.xcresult --out-dir build/genetics-evidence/ios
trap - EXIT
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/genetics/verify_zero_egress_evidence.py --evidence build/genetics-evidence/ios/evidence.json --pcap build/genetics-evidence/ios/candidate.pcapng --binding build/genetics-evidence/ios-probe/binding.json
```

Expected: Flutter unit tests pass; the host UI test drives the exact installed no-codesign Release simulator app; its canonical resource payload binds to the no-codesign device candidate; baseline pktap capture proves live; candidate capture has zero attributed packets/DNS; and all hashes are recorded by `gen_ios_release`. A debug XCTest app cannot satisfy this gate, and no command may use interactive device selection.

- [ ] **Step 8: Obtain the seven release sign-offs**

The DSSE payload type is exactly `application/vnd.genome-companion.genetics-release-authorization.v1+json`, and the payload is the exact canonical `genetic-release-evidence-manifest.v1`. That manifest is additional-properties-false and exactly `{schemaVersion,releaseId,sourceCommit,issuedAt,expiresAt,g0,safety,android,ios,sharedEvidence,manifestSha256}`. `g0` is exactly `{gateId,candidateCommit,trustRootSha256,envelopeSha256}`; `safety` is exactly `{sequence,candidateCommit,envelopeSha256,bundleDigest}`. Each platform object is exactly `{candidateArtifact,aabOrAppSha256,runtimeBindingSha256,zeroEgressEvidenceSha256,pcapSha256,dnsEvidenceSha256,permissionEvidenceSha256,backupScreenshotEvidenceSha256,sensitiveSinkEvidenceSha256,sbomSha256,provenanceSha256}`; `candidateArtifact` is `{repositoryId,runId,runAttempt,artifactId,artifactName,artifactDigest}` and binds an exact preliminary GitHub artifact. `sharedEvidence` is exactly `{sourceTreeSha256,dependencyLockSha256,endpointDenySha256,threatModelSha256,accessibilityMatrixSha256,g0AuthorizationSha256,g0ContentAuthorizationSha256,g0TrustBootstrapSha256}`. Every digest is lowercase `sha256:`; expiry is no more than 72 hours after issuance; Android and iOS source/tree/G0/safety values must agree; `manifestSha256` hashes RFC 8785 bytes omitting only itself.

The signing request is exactly `{schemaVersion:"genetic-release-signing-request.v1",payloadType,releaseId,sourceCommit,manifestSha256,paeSha256,g0EnvelopeSha256,safetyEnvelopeSha256,requiredApprovals,issuedAt,expiresAt,requestSha256}`. `requiredApprovals` is the exact ordered seven rows `{role,keyid}` for `founder,legal,regulatory,security,science,laboratory,accessibility`, byte-matched to the verified G0 trusted registry. The request digest omits only itself. Detached responses use these seven literal filenames and no others: `founder.signature.json`, `legal.signature.json`, `regulatory.signature.json`, `security.signature.json`, `science.signature.json`, `laboratory.signature.json`, and `accessibility.signature.json`; each strict file is exactly `{role,keyid,sig}` and its role/key must match its filename/request. The assembler accepts exactly seven distinct valid Ed25519 signatures over the DSSE PAE; threshold substitution, one actor/key in two roles, G0 lab/result key, test key, extra signature, or wrong prefix fails.

First commit and GREEN-test only the ceremony tooling:

```bash
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python -m pytest scripts/genetics/test_release_authorization.py -q
git add packages/contracts/jsonschema/genetic-release-evidence-manifest.schema.json packages/contracts/jsonschema/genetic-release-signing-request.schema.json packages/contracts/jsonschema/genetic-release-authorization.schema.json packages/contracts/jsonschema/genetic-release-candidate-handoff.schema.json packages/contracts/fixtures/genetic-release-evidence-manifest.valid.json packages/contracts/fixtures/genetic-release-authorization.valid.json scripts/genetics/build_release_authorization_request.py scripts/genetics/assemble_release_authorization.py scripts/genetics/verify_release_authorization.py scripts/genetics/release_candidate_handoff.py scripts/genetics/test_release_authorization.py
git commit -m "feat(genetics): add seven-role release authorization"
```

For a production candidate, start from that clean signed-tag source commit and exact preliminary artifact coordinates. `release_candidate_handoff.py fetch-evidence` uses GitHub's fixed API host and repository ID, accepts only numeric run/attempt/artifact IDs plus expected `sha256:` archive digest, caps each archive at 2 GiB and 10,000 regular entries/4 GiB expanded, rejects redirects outside GitHub artifact hosts, links/devices/absolute or parent paths/duplicates, and never logs `GITHUB_TOKEN`. It exact-verifies every inner evidence manifest before writing the two read-only evidence directories:

```bash
: "${GITHUB_TOKEN:?supply an actions-read token without echoing it}"
: "${GITHUB_REPOSITORY_ID:?set numeric repository ID}"
: "${GENETICS_RELEASE_ID:?set release ID}"
: "${GENETICS_ANDROID_RUN_ID:?set Android candidate run ID}"
: "${GENETICS_ANDROID_RUN_ATTEMPT:?set Android candidate run attempt}"
: "${GENETICS_ANDROID_ARTIFACT_ID:?set Android artifact ID}"
: "${GENETICS_ANDROID_ARTIFACT_SHA256:?set Android artifact digest}"
: "${GENETICS_IOS_RUN_ID:?set iOS candidate run ID}"
: "${GENETICS_IOS_RUN_ATTEMPT:?set iOS candidate run attempt}"
: "${GENETICS_IOS_ARTIFACT_ID:?set iOS artifact ID}"
: "${GENETICS_IOS_ARTIFACT_SHA256:?set iOS artifact digest}"
[[ "$GENETICS_RELEASE_ID" =~ ^gr-[0-9]{8}-[0-9]{4}$ ]]
test -z "$(git status --porcelain=v1 --untracked-files=all)"
GENETICS_RELEASE_SOURCE_COMMIT="$(git rev-parse HEAD)"
GENETICS_RELEASE_CEREMONY_DIR=".git/genetics-release-ceremony/${GENETICS_RELEASE_ID}"
mkdir -p "$GENETICS_RELEASE_CEREMONY_DIR/signatures"
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/genetics/release_candidate_handoff.py fetch-evidence --repository-id "$GITHUB_REPOSITORY_ID" --android-run-id "$GENETICS_ANDROID_RUN_ID" --android-run-attempt "$GENETICS_ANDROID_RUN_ATTEMPT" --android-artifact-id "$GENETICS_ANDROID_ARTIFACT_ID" --android-artifact-sha256 "$GENETICS_ANDROID_ARTIFACT_SHA256" --ios-run-id "$GENETICS_IOS_RUN_ID" --ios-run-attempt "$GENETICS_IOS_RUN_ATTEMPT" --ios-artifact-id "$GENETICS_IOS_ARTIFACT_ID" --ios-artifact-sha256 "$GENETICS_IOS_ARTIFACT_SHA256" --out-dir "$GENETICS_RELEASE_CEREMONY_DIR/evidence"
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/genetics/release_candidate_handoff.py prepare --release-id "$GENETICS_RELEASE_ID" --source-commit "$GENETICS_RELEASE_SOURCE_COMMIT" --evidence-dir "$GENETICS_RELEASE_CEREMONY_DIR/evidence" --g0-gate-id "$GENETICS_G0_GATE_ID" --g0-candidate-commit "$GENETICS_G0_CANDIDATE_COMMIT" --g0-trust-root-sha256 "$GENETICS_G0_TRUST_ROOT_SHA256" --g0-envelope-sha256 "$GENETICS_G0_ENVELOPE_SHA256" --safety-sequence "$GENETICS_SAFETY_SEQUENCE" --safety-candidate-commit "$GENETICS_SAFETY_CANDIDATE_COMMIT" --safety-envelope-sha256 "$GENETICS_SAFETY_ENVELOPE_SHA256" --ceremony-dir "$GENETICS_RELEASE_CEREMONY_DIR"
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/genetics/release_candidate_handoff.py verify-request --ceremony-dir "$GENETICS_RELEASE_CEREMONY_DIR" --source-commit "$GENETICS_RELEASE_SOURCE_COMMIT"
```

**STOP.** The seven named role owners independently exact-fetch both candidate archives, check the manifest/request and measurable G0-07 accessibility matrix, and return only their literal detached signature file. No role private key or signing command enters the repository, CI, or ceremony logs. Assemble and create the immutable candidate only after all seven exist:

```bash
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/genetics/release_candidate_handoff.py check-signature-set --request "$GENETICS_RELEASE_CEREMONY_DIR/genetic-release-signing-request.json" --signature-dir "$GENETICS_RELEASE_CEREMONY_DIR/signatures"
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/genetics/release_candidate_handoff.py assemble-candidate --source-commit "$GENETICS_RELEASE_SOURCE_COMMIT" --ceremony-dir "$GENETICS_RELEASE_CEREMONY_DIR" --signature-dir "$GENETICS_RELEASE_CEREMONY_DIR/signatures" --worktree-root build/genetics-release-worktrees --handoff-output "$GENETICS_RELEASE_CEREMONY_DIR/candidate-handoff.json"
GENETICS_RELEASE_CANDIDATE_COMMIT="$(python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/genetics/release_candidate_handoff.py field --handoff "$GENETICS_RELEASE_CEREMONY_DIR/candidate-handoff.json" --name candidateCommit)"
GENETICS_RELEASE_ENVELOPE_SHA256="$(python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/genetics/release_candidate_handoff.py field --handoff "$GENETICS_RELEASE_CEREMONY_DIR/candidate-handoff.json" --name envelopeSha256)"
[[ "$GENETICS_RELEASE_CANDIDATE_COMMIT" =~ ^[0-9a-f]{40}$ ]]
[[ "$GENETICS_RELEASE_ENVELOPE_SHA256" =~ ^[0-9a-f]{64}$ ]]
git push origin "$GENETICS_RELEASE_CANDIDATE_COMMIT:refs/heads/gen-release-candidate/${GENETICS_RELEASE_ID}"
```

The candidate has the source commit as sole parent and exactly three files under `governance/genetics/release-candidates/${GENETICS_RELEASE_ID}/`: `genetic-release-evidence-manifest.json`, `genetic-release-signing-request.json`, and `genetic-release-authorization.dsse.json`. Two protected-environment administrators independently verify the parent/diff/digests and set only `GENETICS_RELEASE_ID`, `GENETICS_RELEASE_CANDIDATE_COMMIT`, and `GENETICS_RELEASE_ENVELOPE_SHA256`; force-push/delete/squash/rebase is forbidden.

Every authorized `gen_android_release`/`gen_ios_release` rerun uses a second pinned checkout at exactly `GENETICS_RELEASE_CANDIDATE_COMMIT` with `persist-credentials:false`, pinned download-artifact on the exact manifest coordinate, and then runs:

```bash
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/genetics/release_candidate_handoff.py verify-candidate --release-id "$GENETICS_RELEASE_ID" --candidate-commit "$GENETICS_RELEASE_CANDIDATE_COMMIT" --source-commit "$GITHUB_SHA" --envelope-sha256 "$GENETICS_RELEASE_ENVELOPE_SHA256" --candidate-dir build/genetics-release-authorization --downloaded-evidence build/genetics-authorized-input
python scripts/ci/run_locked_uv.py -- run --project tooling/genetics --frozen python scripts/genetics/verify_release_authorization.py --manifest "build/genetics-release-authorization/governance/genetics/release-candidates/${GENETICS_RELEASE_ID}/genetic-release-evidence-manifest.json" --envelope "build/genetics-release-authorization/governance/genetics/release-candidates/${GENETICS_RELEASE_ID}/genetic-release-authorization.dsse.json" --trusted-approvers governance/genetics/trusted-approvers.json --g0-envelope "governance/genetics/gates/g0/${GENETICS_G0_GATE_ID}.dsse.json" --safety-envelope apps/mobile/assets/genetics/safety-bundle.dsse.json --downloaded-evidence build/genetics-authorized-input
```

Only then may the pinned upload action archive the same evidence as `authorized-genetics-android-${GENETICS_RELEASE_ID}` or `authorized-genetics-ios-${GENETICS_RELEASE_ID}`. Tests mutate every manifest/request/evidence field, PAE byte, role/key/signature/filename, expiry, parent/path, GitHub run/artifact ID/digest, G0/safety/candidate digest, packet/DNS count, candidate payload binding, SBOM/provenance/permission/sink/backup/accessibility digest, and prove anti-self/cross-role enforcement. A failed/expired gate, changed tuple/copy/dependency, debug-only journey, or missing native evidence blocks the archive.

- [ ] **Step 9: Commit the foundation-owned CI marker changes**

Commit:

```bash
git add .github/workflows/ci.yml .github/workflows/release.yml security/tests/genetic_ci_contract_test.py
git commit -m "ci(genetics): gate conditional offline wallet"
```

## Final acceptance gate

This conditional module is release-ready only when all of the following are true:

- the protected production G0 envelope verifies seven distinct role signatures, seven controls/artifact digests, exact authorization tuples, complete Korean knowledge/support content digests, initial root bootstrap, active timestamps, and the source commit;
- compact result verification follows global purpose-scoped `kid` lookup -> signature -> strict generated payload parse -> exact tuple/subject/time authorization, with parameterized expected `typ` and all confusion/tamper tests passing;
- the embedded/user-selected safety bundle passes threshold signatures, active/retired/revoked rules, two-phase root rotation, monotonic crash-safe persistence, and both result and knowledge recall tests;
- the original signed JWS remains encrypted and exportable; stale interpretation never blocks provenance/export/delete; recovery behavior is explicit and local;
- vault keys, binding secrets, migrations, account switching, concurrent operations, destruction, backups, screenshots, archives, KDF caps, nonces, AAD, temp cleanup, and external-copy limitations pass their exact tests;
- the complete genetics journey emits zero network packets and zero sensitive sink values, mobile release artifacts have no Internet path, and no server operation accepts genetic material;
- Flutter/Dart/dependencies and both platform lockfiles are pinned, both platform builds are source-bound/dependency-locked and rerunnable without claiming byte reproducibility, foundation CI marker ownership is respected, and the seven reviewers sign artifact-hashed release evidence.

Passing this plan authorizes only the exact G0 tuples and content digests. It does not authorize raw genomics, disease prediction, pharmacogenomics, diagnosis, medication guidance, family inference, server-side genetic processing, sync, support upload, or any future/changed tuple, Korean copy, citation, support route, or root bootstrap without a newly signed append-only G0 envelope.
