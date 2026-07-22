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

## Production-like stack

```bash
pnpm docker:build
pnpm prod:up
pnpm helm:lint
```
