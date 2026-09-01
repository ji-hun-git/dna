---
name: gc-sanity-check
description: Use when taking over the Genome Companion Korea repository, resuming after a break, before a release or publication decision, or when asked to audit, verify, or sanity-check project state, CI, registry, readiness, or documentation truth.
---

# Project sanity check

## Overview

An evidence-first audit that validates `PROJECT_GUIDE.md` against live Git, GitHub, registry, and readiness state without changing anything. The full prompt is `SANITY_CHECK_PROMPT.md`; this skill is the executable checklist.

## Commands (read-only)

```bash
git status -sb && git fetch origin --prune && git log --oneline -5 origin/main
gh run list -R ji-hun-git/dna --limit 5
gh api repos/ji-hun-git/dna/branches/main/protection   # 404 means unprotected
gh pr list -R ji-hun-git/dna --state open
# anonymous registry probe (200 = public)
T=$(curl -s 'https://ghcr.io/token?scope=repository:ji-hun-git/dna-web:pull' | python -c 'import sys,json;print(json.load(sys.stdin)["token"])')
curl -s -H "Authorization: Bearer $T" -o /dev/null -w "%{http_code}\n" https://ghcr.io/v2/ji-hun-git/dna-web/tags/list
```

With the pinned toolchain: `pnpm security:runtime-policy`, `pnpm release:readiness:validate`, `pnpm web:test`, `pnpm research:test`, `.\gradlew.bat test --no-daemon`.

## Checklist

1. Identity: repository, branch, HEAD equals `origin/main`, worktree clean, no `buup`/`corridor` contamination.
2. GitHub: CI run for HEAD is success; branch protection state; open PRs.
3. Registry: latest publication run, digests, attestations, anonymous pull result.
4. Boundaries: Spring authority, no Next route handlers, worker and research separation, providers disabled (`apps/web/app/connections/page.tsx`, `apps/research-web/lib/research-data/connectors.ts`).
5. Infra truth: OpenTofu code versus account-backed plan/apply evidence.
6. Reproducibility: pinned versions honoured; readiness validator exits 0; what skipped locally.
7. Contradictions: README, guide, dated reports, plans index. Cite file and line.

## Output

Write `docs/status/YYYY-MM-DD/sanity-check.md` using the section order in `gc-readiness-evidence`. Lead with the verdict (`GO`/`NO_GO`, current stage). Every claim carries a SHA, run URL, digest, or "not verified". End with the next safe step and the founder-only action list.

## Do not

Delete packages, dispatch workflows, run `tofu apply`, request secrets, or edit `release/readiness.json` statuses during the audit.
