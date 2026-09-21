# PDF render cancellation and Windows environment correction

## Evidence date and revision

2026-09-21, Asia/Seoul. Base: PR #18 at
`f4e4984f5e8da0be08749088b782a89c9c817b40`.
Branch: `codex/render-cancellation-cleanup`, stacked on the current Wave 7b branch.
Local results below apply to the source and test changes accompanying this report.

## Executive result

Two reproduced subprocess lifecycle defects corrected. The caller can cancel an
active PDF render without abandoning its child JVM, and the environment allowlist
retains Windows `Path` while excluding worker credentials. No release gate changes;
hosted synthetic staging remains NO_GO.

## Evidence

| Check | Result |
| --- | --- |
| Red cancellation regression | Real sleeping child remained alive after the render caller was interrupted; assertion failed at `cancelled renderer must not survive its caller` |
| Existing environment test before fix | Failed on Windows: child had SYSTEMROOT/TEMP/TMP but lacked PATH |
| `./gradlew.bat :apps:document-worker:test --tests '*PageRenderSubprocessTest*' --no-daemon` after fix | BUILD SUCCESSFUL; four tests passed, including timeout, OOM, environment isolation and cancellation |
| `./gradlew.bat test --no-daemon` | BUILD SUCCESSFUL in 1m 30s; JUnit XML totals 348 tests, 64 skipped, zero failures/errors (284 passed). Gradle reused unchanged task outputs where applicable |
| `node scripts/security/check-runtime-policy.mjs` with Node 24.20.0 | `runtime-policy: PASS node=24.20.0 pnpm=11.20.0 next=16.3.3` |
| `node scripts/release/check-readiness.mjs --validate-only` | Exit 0; `release-readiness: NO_GO 12 blocking gate(s) are not PASS` |
| `git diff --check` | Exit 0 |

JVM: Temurin 21.0.11, Windows. No local PostgreSQL test URL was supplied; skipped
integration/scanner-dependent coverage is not claimed. New-head Linux CI supplies
the complete configured integration matrix after push; its outcome is not asserted
by this local report.

## Findings

- R1: `waitFor`/`join` interruption bypassed timeout-only cleanup. A real child and
  blocked pipe threads could survive their caller. The new test snapshots this
  test JVM's direct children and existing threads, interrupts the render, and checks
  child termination and disappearance of the new pipe threads. Its own `finally`
  also removes the test child on failure. It does not depend on command-line process
  metadata, which Windows may omit.
- R2: `System.getenv()` map lookup treated `PATH` and `Path` differently on Windows.
  Named `System.getenv(key)` lookup respects the platform's environment semantics.
  The same narrow allowlist remains in force.

## Readiness interpretation

This verifies synthetic subprocess lifecycle behavior, not complete PDF safety,
hosted shutdown behavior, clinical validation or real-data authorization. Existing
Wave 7b findings and the web image's CVE exceptions remain unresolved by this patch.

## Changes made

The render wait/result path now owns cleanup in `finally`. Cleanup forcibly stops
a surviving child and joins the pipe threads against one monotonic 15-second budget.
Repeated interruption cannot extend that cleanup deadline; the interrupt flag is
restored afterward. Existing fatal pipe-thread errors remain fatal. The budget is
a bound on waiting, not a guarantee that an unresponsive OS completes termination.

No API, schema, UI, dependency, image policy, deployment or readiness status changed.
Only synthetic in-memory bytes are used; no PDF artifact is committed.

## Next safe sequence

Check CI on the new PR and obtain independent review in the existing PR stack.
Continue with the unresolved document-inspection limits and image-risk findings;
the broader front-end redesign remains parked in PR #16.

## Founder-only actions

No new external inputs are needed for this correction. Existing hosted, registry,
provider and real-data gates remain separate.
