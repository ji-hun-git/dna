# Next-stage baseline repair

## Evidence date and revision

2026-09-08, Asia/Seoul. Reviewed PR #6 at `637030a31ba1f4d344e335a7518efaaa9432c4b2`;
product PR #5 at `4157a4eef798b9222bbc5904fdd38e9227cb1aea`.
Local results below apply to the baseline repair accompanying this report.

## Executive result

NO_GO for hosted synthetic staging. Repair PR #6's vulnerable baseline with the
same narrow Tomcat patch already present in PR #5. N1 remains unstarted.

## Live evidence

| Evidence | Result |
| --- | --- |
| [PR #6 run 34097448040](https://github.com/ji-hun-git/dna/actions/runs/34097448040) | Dependency policy and core image failed on Tomcat 10.1.55; logs report CVE-2026-65182, CVE-2026-65905 and CVE-2026-68525 |
| PR #5 at the revision above | OPEN, REVIEW_REQUIRED; successful CI reported at that head |
| Main protection, queried 2026-09-08 | One approving review required; stale reviews dismissed |
| New-head remote scans | Pending push and CI; not established by local tests |

## Findings

- B1: PR #6 branches from the older baseline and lacks PR #5's dependency patch.
  Carry only the version catalogue, Gradle override, lockfile and runtime-version test.
- B2: Independent approval remains required. Do not self-approve or merge either PR.

## Readiness interpretation

No gate is upgraded. Existing published images remain outside this source repair.
No cloud, registry, deployment, provider or real-data action was performed.

## Changes and validation

Before the fix, `./gradlew.bat :apps:core-api:test --tests '*TomcatRuntimeVersionTest' --no-daemon`
failed its loaded-version assertion. After the fix, `./gradlew.bat test --no-daemon`
reported `BUILD SUCCESSFUL`: JUnit XML totals 91 tests, 10 skipped, zero failures
(81 passed). PostgreSQL/scanner-dependent coverage is not claimed from skipped tests.
Java 21 was used.

With the cached Node 24.20.0 binary:

```text
node scripts/security/check-runtime-policy.mjs
runtime-policy: PASS node=24.20.0 pnpm=11.20.0 next=16.3.3
node scripts/release/check-readiness.mjs --validate-only
release-readiness: NO_GO 12 blocking gate(s) are not PASS
```

The readiness validator exits zero for a valid NO_GO snapshot, not release approval.

## Next safe sequence

Finish current-head CI and independent product/plan review. After PR #5 is reviewed
and merged, start N1 from current main with concurrent-write red tests and local
storage parity. Keep the accepted source-confirmation-history-visit-preparation flow.

## Founder-only actions

An independent GitHub reviewer must approve the PRs before protected merge. No
credentials or AWS metadata are needed for the current local corrections.
