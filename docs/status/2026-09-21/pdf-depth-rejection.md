# PDF inspection nesting rejection

## Evidence date and revision

2026-09-21, Asia/Seoul. Base: PR #19 at
`82dd20d6b75a0f448cfe1d8ccbde23dd11d46ab2`.
Branch: `codex/pdf-depth-rejection`, continuing the latest backend stack.
Local results refer to the source and tests accompanying this report.

## Executive result

Inspection now rejects documents whose form or tiling-resource traversal exceeds
the configured nesting limit. Previously the counter stopped visiting deeper
content and could approve the partial count. The closed rejection reason is
`IMAGE_COMPLEXITY_EXCEEDED`; the policy is now `pdf-security-v2`.

## Live evidence

| Check | Result |
| --- | --- |
| Regression before the change | Expected `IMAGE_COMPLEXITY_EXCEEDED`, received `CLEAN` for an over-depth document |
| Additional inherited-resource regressions | Exposed approval of recursive content and reuse of an earlier form inspection in a different resource context |
| `./gradlew.bat test --no-daemon` | BUILD SUCCESSFUL in 1m 34s; 354 tests, 65 skipped, zero failures/errors (289 passed); unchanged tasks may reuse outputs |
| Pinned runtime policy | `runtime-policy: PASS node=24.20.0 pnpm=11.20.0 next=16.3.3` |
| Readiness validation | Exit 0; `release-readiness: NO_GO 12 blocking gate(s) are not PASS` |
| New-head GitHub CI | Not yet verified at report creation; use the associated PR's checks |

Local execution used Temurin 21.0.11 on Windows. PostgreSQL/scanner-dependent tests
were skipped without their local configuration; the new v1 rejection integration
test is compiled but awaits the configured PostgreSQL CI job. Inspector regressions
executed locally. No hosted runtime behavior is claimed.

## Findings ranked

- D1 (Wave 7b F05): an over-depth resource path was approved after traversal stopped.
  Crossing the cap now sets a persistent rejection flag in resource and content
  traversal. Even a null resource dictionary beyond the cap does not clear it.
- D2: a global visited set can conceal deeper paths through shared resources.
  Identity-based memoization now records the greatest inspected depth, revisiting
  a resource when reached deeper. This remains bounded by the nesting cap.
- D3: resource-less forms inherit their caller's resources. Form memoization keys
  both form identity and inherited resource identity, as well as depth.
- D4 (Wave 7b F07): the API accepted the previous policy identifier. It now accepts
  only v2 approvals. A PostgreSQL integration regression asserts that a v1 approval
  dead-letters the job without an approved object key or an extraction lease.
- D5: PDFBox dispatches transparency groups through a separate callback. A new
  synthetic regression first reproduced recursive group approval; ordinary forms
  and transparency groups now share the depth and resource-context guard.

## Readiness interpretation

NO_GO is unchanged. This is synthetic inspection evidence, not hosted safety or
real-data authorization. F06 remains open: unique resource-image pixels and visited
inline images do not bound repeated rendering work. Parser-error swallowing and
the broader hostile-input resource envelope are not resolved by this change.
Existing CVE exceptions and other Wave 7b findings remain open.

## Changes made by this audit

Depth overflow uses the existing closed complexity reason, without a schema or
response-shape change. Tests cover the exact allowed boundary, nested forms and
tiling patterns, cyclic resources, deeper shared paths, recursive inherited
resources, transparency groups, and resource-context changes across pages. Fixture PDFs are generated
in memory and marked synthetic; no document binaries are committed.

Worker and API must be upgraded together: an old worker's v1 approval is rejected
by the new API, and a v2 approval is rejected by the old API. No rollout occurred.

## Next safe sequence

Require green CI and independent review in the existing PR stack. Address repeated
image work and parser-failure handling in separate, test-backed changes. The large
frontend redesign remains parked in PR #16.

## Founder-only actions

No new founder input is required for this source correction. Hosted deployment,
registry visibility, provider activation and real-data gates remain separate.
