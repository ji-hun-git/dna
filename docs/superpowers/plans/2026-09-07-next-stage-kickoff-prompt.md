# Next-stage implementation kickoff

Use this prompt for the first code slice after baseline review. It is not a cloud approval.

```text
Resume Genome Companion Korea (ji-hun-git/dna), not buup.

Read PROJECT_GUIDE.md, AGENTS.md, release/readiness.json, docs/release/readiness.md,
ADR-001, the nearest operations document, and the applicable project skills completely.
Then read docs/superpowers/plans/2026-09-07-private-synthetic-next-stage.md.

Verify the remote, current branch, dirty state, origin/main SHA, and PR #5 status.
PR #5's recorded head is 4157a4eef798b9222bbc5904fdd38e9227cb1aea, but inspect live
state rather than assuming that head is still current. Do not self-approve or merge it.
If its product changes are not reviewed and merged, report that N1 dependency and
do only independent read-only preparation. Do not duplicate the product rebuild.

After the baseline is merged, use an isolated codex/* branch from current origin/main.
Execute N1 only: introduce a narrow document-storage port with local behavior parity.
Start with a failing concurrent different-byte same-key write test, then cover identical
replay, promotion digest binding, preview validity, invalid keys and deletion behavior.
Preserve Spring authority, exact synthetic digests, worker isolation and current UI.
No AWS SDK, provider integration, model call, schema migration or hosted activation in N1.

Use pinned tool versions. Run the applicable runtime-policy, readiness, JVM and browser
gates; distinguish skips from passes. Inspect the complete diff. Commit and open a PR
without pushing main or bypassing review. Report files, exact tests, limitations and
the next dependency. Do not upgrade release gates from local evidence.

Stop before any AWS account access, apply, registry publication, deployment, destructive
action, new credential, real data, clinical claim or external recruitment. Name the exact
founder gate and request only the non-secret metadata needed at that point.
```
