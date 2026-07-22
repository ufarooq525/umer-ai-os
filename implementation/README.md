# Implementation (V1 scaffold)

Architecture V1 is frozen under `Core/`, `Execution/`, `Runtime/`, etc.

Software lives under `apps/`, `packages/`, `infra/`. See `implementation/MONOREPO_BLUEPRINT.md`.

## Quick start

```bash
cp .env.example .env
pnpm install
pnpm build
pnpm typecheck
pnpm dev:infra    # postgres, redis, nats, minio, otel collector
pnpm --filter @umer/app-control-api dev
```

Phase 6 = skeleton only. No business logic, APIs, tables, or specialists yet.
