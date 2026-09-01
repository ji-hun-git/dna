# AGENTS.md — operating contract for agents

This file is the short version. The authority is `PROJECT_GUIDE.md`; when they disagree, the guide wins.

## Read in this order

1. `PROJECT_GUIDE.md` (sections 1, 2, 6, 8 at minimum)
2. `release/readiness.json` and `docs/release/readiness.md`
3. The ADR or operations document nearest your change
4. The nearest `AGENTS.md` (for example `apps/web/AGENTS.md` for Next.js version notes)

## Boundaries that end a task

- Real health data, real documents, credentials, tokens, certificates, or PHI anywhere: stop.
- Diagnosis, normal/abnormal, reference ranges, risk, treatment, medication, alerts, or autonomous clinical action in code or copy: stop.
- Next.js gaining an API route, provider token, or authorization rule: stop. Spring is the authority.
- A hosted, registry, AWS, provider, deletion, or release action: stop and name the founder gate.
- Converting a plan, workflow, IaC file, mock, or UI into a PASS claim: stop; only runtime evidence changes a gate.

## Change protocol

1. Branch from current `origin/main` as `codex/<topic>`.
2. State scope and which boundary it touches.
3. Failing test first, then the smallest coherent change.
4. Run the gates for your area (below) with the pinned toolchain: Node `24.20.0`, pnpm `11.20.0`, Java `21`.
5. Update evidence documents without upgrading gates.
6. Inspect the diff for secrets, real data, generated files, unrelated changes.
7. Push, open a PR, require green `genome-companion-ci`.

## Gates by area

| Area | Commands |
|---|---|
| Any | `pnpm security:runtime-policy`, `pnpm release:readiness:validate` |
| `apps/web` | `pnpm web:test`, `pnpm --dir apps/web build`, `pnpm auth-security:gate` |
| `apps/research-web` | `pnpm research:test`, `pnpm research:build` |
| JVM (`apps/core-api`, `apps/document-worker`, `packages/document-boundary`) | `.\gradlew.bat test --no-daemon` (PostgreSQL classes skip without Docker; CI runs them) |
| Workflows | `pnpm security:github-actions-policy` |
| Infra | `tofu fmt -check -recursive infra` and the module `validate`/`test` targets in `.github/workflows/ci.yml` |

## Skills and agents

Project skills live in `.claude/skills/`: `gc-sanity-check`, `gc-safe-change`, `gc-korean-copy`, `gc-readiness-evidence`, `gc-synthetic-fixture`. Agent roles live in `.claude/agents/`. Load the skill that matches your task before editing.

## Founder-only inputs

Registry visibility decision, branch protection, AWS account identifiers, provider application metadata, public-data API keys, legal and regulatory memos. Never ask for secret values in chat.
