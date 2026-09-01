# Independent project review — Genome Companion Korea

**Review date:** 2026-09-02 (Asia/Seoul)
**Reviewed revision:** `d57cf6c` on `main` (merge of PR #2)
**Reviewer stance:** evidence-first, adversarial, product-aware. Facts are stated as facts; judgements are marked as such.
**Scope:** repository, live GitHub state, local reproduction with the pinned toolchain. No AWS, package, provider, or data state was inspected beyond read-only probes.

## 1. Verdict in one paragraph

This is an unusually disciplined engineering foundation attached to a product that does not yet do its job. The security boundary, evidence hierarchy, CI matrix, supply-chain attestation, and honesty about readiness are better than most funded health startups reach in a year. The user-facing product, however, still performs one hard-coded action: every allow-listed synthetic document produces the single candidate `총콜레스테롤 188 mg/dL`, which the user confirms, corrects, or excludes. The approved MVP journey (several fields per document, a longitudinal timeline, a visit-preparation summary) has no implementation. The main risk to the company is not a security gap. It is that infrastructure maturity keeps outrunning product learning, and that the founder-only external gates (legal, MFDS, provider onboarding, brand clearance) have no visible progress.

## 2. What was verified

| Check | Result |
|---|---|
| Repository identity | `ji-hun-git/dna`, public, default branch `main`, HEAD `d57cf6c` |
| Main CI for HEAD | run 33571040366, success |
| Open PRs / issues | 0 / 0 |
| Branch protection on `main` | none (`GET /branches/main/protection` → 404); repository rulesets: none |
| Remote branches | 30 `codex/*` branches, 2 merged; the rest are stale prototypes |
| GHCR anonymous pull (`dna-web` tags list) | 401 without token, **200 with an anonymous token** → still public |
| GHCR login method in `publish-runtime-images.yml` | `docker/login-action` with `password: ${{ github.token }}` |
| Local JS gates (Node 24.20.0 via pinned binary, pnpm 11.20.0) | runtime-policy PASS; readiness validate: valid `NO_GO`, 12 blocking gates not PASS |
| `pnpm web:test` / `pnpm research:test` | 85 / 14 passing |
| `gradlew test` | BUILD SUCCESSFUL; the four PostgreSQL-backed classes skip locally (no Docker, no `GC_TEST_POSTGRES_URL`) |
| Extraction behaviour | `DocumentWorkerBoundary.completeExtraction` inserts one fixed candidate row; document completes on first decision |
| Test inventory | 89 Vitest cases, 70 JUnit cases, 8 Playwright scenarios, Python layout tests |
| Documentation volume | ~21,000 lines of plans under `docs/superpowers/plans`; 412 tracked files total |

## 3. Strengths (keep these)

1. **Trust boundary is real, not aspirational.** Spring owns session, CSRF, consent, documents, records, audit, deletion. Next.js has no route handlers except `/healthz`. `ModuleBoundaryTest` and `ProhibitedRouteTest` enforce it.
2. **Hostile-document pipeline is production-shaped.** Digest-bound upload capability, quarantine zones, real ClamAV adapter execution in CI, separate worker artifact without database credentials, lease/retry/DLQ semantics proven with a concurrent duplicate-delivery test.
3. **Evidence discipline.** `release/readiness.json` is validated by a script, refuses to be GO without evidence, and the guide states an explicit evidence hierarchy. Dated reports are treated as history, not truth.
4. **Supply chain.** Pinned action SHAs, checksum-verified tool downloads, CodeQL for both languages, Gitleaks, Trivy, CycloneDX SBOM, keyless Cosign, SLSA attestations, protected environment with required reviewer.
5. **Korean-first copy is tested.** A forbidden-term scan keeps internal jargon and real institution names out of user-facing components; non-diagnostic sentences are asserted verbatim.
6. **Accessibility is in CI**, with axe coverage and a keyboard-only 200 percent lifecycle.

## 4. Findings, ranked

### F-1 (Critical, product): the MVP journey is not implemented

Evidence: `DocumentWorkerBoundary.kt` L310–322 inserts `총콜레스테롤|188|mg/dL|2026-07-28` for every approved digest; `FoundationRepository.createRecordFromCandidate` and `excludeCandidate` set the document to `COMPLETED` after one decision. The records page lists one value per document. There is no multi-field review, no grouping by date, no visit-preparation output, and the public provider explorer is a synthetic demo. Judgement: the product cannot yet produce the value the program design promises, so no user learning is possible.

Action: implemented in this wave (multi-candidate review, grouped records, visit preparation). Spec: `docs/superpowers/specs/2026-09-02-mvp-multi-candidate-and-agent-os-design.md`.

### F-2 (Critical, security policy): GHCR packages are public and would be public again after a republish

Evidence: the publish workflow authenticates to GHCR with the repository's `github.token`. Packages first published this way are linked to the repository and inherit its visibility. The repository is public, so the packages are public. Deleting and republishing with the same workflow would reproduce the problem.

Action (founder decision required): choose one of
- keep GHCR but publish with a fine-grained PAT stored as a secret and set package visibility to private before linking, or
- move runtime images to the private ECR already defined in the OpenTofu foundation and stop publishing to GHCR, or
- accept public packages as policy (the source is public and the images contain synthetic-only code), and rewrite the operations document accordingly.
Recommendation: option 2. It aligns with the release ladder and removes a second registry to govern.

### F-3 (High, governance): `main` is unprotected while the documentation assumes reviewed merges

Evidence: no branch protection, no rulesets. The `synthetic-staging-registry` environment is protected, the branch that feeds it is not. Judgement: a single mistaken push to `main` could trigger a protected publication with unreviewed source.

Action (founder, one-time): require pull requests, require the `genome-companion-ci` check, block force-push and deletion, and require linear history. This is a GitHub setting, not code.

### F-4 (High, process): two parallel UIs and a 563-line orchestrator

Evidence: `app/page.tsx` switches between `HealthExperience` (demo data in React memory) and `IntegratedHealthExperience` (server-owned) on `GC_INTEGRATED_SYNTHETIC_UI`. The demo UI is the default. The forbidden-term copy test covers the demo components but not the integrated ones. Judgement: drift is inevitable; the demo UI will keep looking richer than the real one.

Action: this wave extracts `CandidateReview`, adds a shared shell, and extends the copy scan to the integrated components. Next: make the integrated UI the default and retire the demo components once feature parity is reached.

### F-5 (High, documentation): plans describe intent as status

Evidence: `docs/superpowers/plans/README.md` lists FND "Tasks 3–11 not started" and PUB/REC/AI/UX as "Plan-ready; not executed", while the codebase already implements consent, audit, telemetry, hostile-document boundary, and a research runtime under different names. ~21,000 lines of plans exist for a product with 412 files. Judgement: new agents will trust the index and re-plan work that exists.

Action: the plan index now points to the roadmap that supersedes it; the six 2026-08-09 plans stay as reference and are labelled as such.

### F-6 (Medium, reproducibility): local development cannot run the PostgreSQL-backed tests

Evidence: Testcontainers requires Docker; the workstation has none; the four integration classes skip silently. Node 22 is the global version. Judgement: the "passing locally" signal is weaker than it looks.

Action: add a `docs/operations/local-development.md` note on running with a pinned Node binary and a local PostgreSQL URL; consider a `compose.yaml` for PostgreSQL only. Not done in this wave.

### F-7 (Medium, business): zero validation evidence

Evidence: the program design mandates a quarterly wedge tournament, five interviews per segment, and a paid or deposit-backed price test. No interview notes, price test, or brand clearance record exists. `앎` remains unclear for public use (`governance/founder-final-direction-recommendation-2026-08-10.md`).

Action: Track C of the roadmap. These do not need code and can run in parallel with the release ladder.

### F-8 (Low, hygiene): stale branches and legacy tooling

Evidence: 28 unmerged `codex/*` branches; `scripts/ci/install_android_sdk.py`, `install_bundletool.py` and their tests remain from the earlier Flutter plan and are enforced by `test_repository_layout.py`. Judgement: harmless today, confusing tomorrow.

Action: delete merged/abandoned remote branches after founder confirmation; keep the mobile installers only if the genetic-wallet track survives the next review.

## 5. What this wave changes

- Product: ordered three-candidate review, document completes only after every decision, records grouped by date and document, printable visit-preparation questions with a fixed non-interpretive question set.
- Design: shared integrated shell, review progress and completion states, print stylesheet, stories.
- Agent operating system: `AGENTS.md`, five project skills under `.claude/skills/`, five agent definitions under `.claude/agents/`.
- Documentation: this review, `docs/roadmap/2026-09-02-roadmap.md`, guide and index updates.
- Not changed: readiness gate statuses, registry, AWS, providers, data policy.

## 6. Skill check results

Recorded after Task 4 (see the roadmap document's appendix for the exact scenarios and outcomes).
