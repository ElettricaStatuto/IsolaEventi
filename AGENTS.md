# AGENTS for IsolaEventi

## Purpose
This file helps AI coding agents understand the monorepo structure, key packages, and the commands to run changes safely.

## Project overview
- PNPM workspace repository with TypeScript, Node.js, React, Vite, Express, PostgreSQL, Drizzle ORM, Zod, and OpenAPI code generation.
- Primary packages:
  - `artifacts/api-server` — backend Express API, Drizzle ORM, `@workspace/api-zod` validation, `DATABASE_URL` required.
  - `artifacts/sardegna-map` — primary React frontend map app.
  - `artifacts/mockup-sandbox` — UI / design sandbox with Vite.
  - `lib/api-spec` — OpenAPI spec + Orval codegen.
  - `lib/api-client-react` — generated React API client.
  - `lib/db` — Drizzle schema definitions and database push scripts.
  - `scraper/` — Python scraper and analysis code separate from the TS workspace.

## Key commands
- `pnpm install` — install workspace dependencies. The repo enforces pnpm in `package.json`.
- `pnpm run build` — typecheck and build all packages.
- `pnpm run typecheck` — full workspace typecheck.
- `pnpm --filter @workspace/api-server run dev` — run backend dev server.
- `pnpm --filter @workspace/sardegna-map run dev` — run the main frontend.
- `pnpm --filter @workspace/mockup-sandbox run dev` — run the sandbox frontend.
- `pnpm --filter @workspace/api-spec run codegen` — regenerate generated API code from OpenAPI.
- `pnpm --filter @workspace/db run push` — apply database schema changes.
- `pnpm --filter @workspace/db run push-force` — force-push DB schema changes.

## Conventions and important notes
- Use `pnpm` only; root `package.json` enforces that with `npx only-allow pnpm`.
- The workspace uses `pnpm-workspace.yaml` with `catalog` dependency aliases and a `minimumReleaseAge` policy.
- Do not manually edit generated sources under `lib/api-client-react/src/generated` or `lib/api-zod/src/generated`.
- Backend `artifacts/api-server` expects environment variables from the repo root `.env` file when started.
- `lib/db/src/schema` is the source of truth for DB schema definitions; apply changes via `pnpm --filter @workspace/db run push`.
- `replit.md` contains more run & operate details and can be referenced for commands.

## What agents should do first
- Identify whether changes are in backend, frontend, codegen, or DB schema before applying fixes.
- Regenerate API clients after changes to the OpenAPI spec or route contracts.
- Run the workspace typecheck script before finalizing TypeScript changes.
