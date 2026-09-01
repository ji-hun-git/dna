# Local development on a workstation

Updated: 2026-09-02. Applies to Windows and macOS/Linux; commands shown for Git Bash on Windows.

## Toolchain without changing the global Node

The repository pins Node `24.20.0` and pnpm `11.20.0`. If the global Node differs, obtain the exact binary without a global install:

```bash
npx -y node@24.20.0 -v                      # downloads the pinned binary once, prints v24.20.0
NODE24="$(npx -y node@24.20.0 -e "console.log(require('path').dirname(process.execPath))")"
mkdir -p ~/.gc-node24 && cp "$NODE24/node.exe" ~/.gc-node24/   # on macOS/Linux copy "$NODE24/node"
export PATH="$HOME/.gc-node24:$PATH"
corepack enable --install-directory ~/.gc-node24              # creates pnpm shims next to the binary
node -v && pnpm -v                                             # v24.20.0 / 11.20.0
pnpm install --frozen-lockfile
pnpm security:runtime-policy                                   # must print PASS with node=24.20.0
```

Do not weaken `scripts/security/check-runtime-policy.mjs` to match a workstation.

## What runs where

| Gate | Local | Notes |
|---|---|---|
| `pnpm web:test`, `pnpm research:test`, builds | yes | ~25 s and ~5 s |
| `pnpm release:readiness:validate` | yes | exits 0 while the file is valid; `pnpm release:readiness` exits 1 while `NO_GO` |
| `./gradlew.bat test --no-daemon` | partly | the PostgreSQL-backed classes (`*PostgresIntegrationTest`, `ConsentJdbcRepositoryTest`, `SyntheticFhirEvidenceProjectorTest`) skip unless Docker (Testcontainers) or `GC_TEST_POSTGRES_URL` is available |
| `pnpm foundation:e2e` | needs PostgreSQL | requires `GC_TEST_POSTGRES_URL` and `GC_TEST_QUARANTINE_ROOT`; starts Spring, the worker, and Next on loopback |
| ClamAV adapter test | CI only | needs the checksum-verified engine from `.github/workflows/ci.yml` |

To run the PostgreSQL-backed classes locally, point `GC_TEST_POSTGRES_URL` at any PostgreSQL 16+ instance with trust auth on a throwaway database, for example `jdbc:postgresql://127.0.0.1:5432/postgres`. Never point it at a database that holds anything but synthetic data.

## Worktrees

The repository is used with several git worktrees (one per branch). Check `git worktree list` before creating a branch; a branch checked out in another worktree cannot be checked out again.

## What a green local run proves

Only the stated synthetic contract on this machine. CI on `main` is the evidence of record; state which classes skipped in any report.
