<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Product UI consistency

For live product UI changes, follow `../../docs/design/product-ui-contract.md`.
Use the shared `IntegratedShell` and `app/product.css` contract. Keep navigation,
page widths, headings, surfaces and controls consistent across routes; review
the seven-width foundation browser captures before reporting a visual change.
