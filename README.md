# Umer AI OS

Architecture V1 is frozen. Implementation follows `implementation/MONOREPO_BLUEPRINT.md`.

- Architecture SoR: `Core/`, `Execution/`, `Runtime/`, `Departments/`, …
- Deployment: `implementation/DEPLOYMENT.md`
- Roadmap: `ROADMAP.md`

## Commands

```bash
cp .env.example .env
pnpm install
pnpm build
pnpm typecheck
pnpm test
pnpm lint
pnpm dev:infra
pnpm --filter @umer/app-control-api dev
pnpm --filter @umer/app-web dev
```

## Projects (Laragon)

Eight apps are registered in `projects/catalog.json`. Open **Projects** in the UI to submit PM intake.

For QA: choose a project (e.g. **school-app**), set type **`qa`**, submit — then approve the `gate-qa-*` gate to seal `.umer/qa/` evidence and **run** allowlisted suites (PHPUnit / Playwright).

Skip suite execution with `UMER_QA_SKIP_RUN=1`. Skip only Playwright with `UMER_QA_SKIP_PLAYWRIGHT=1`.

To add another app later, append an entry to the catalog — see `projects/README.md`.

## Production-like stack

```bash
pnpm docker:build
pnpm prod:up
pnpm helm:lint
```
