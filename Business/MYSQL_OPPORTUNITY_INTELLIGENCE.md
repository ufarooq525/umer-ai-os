# MySQL Persistence — Opportunity Intelligence

MySQL is the production persistence target for the Opportunity Intelligence / Revenue OS bounded context. Existing application domains continue to use PostgreSQL through `DATABASE_URL`.

## Storage model

- `opportunity_niches` — autonomous/CEO-selected search strategies.
- `opportunity_businesses` — normalized business prospects.
- `opportunity_evidence` — source-backed observations.
- `opportunity_research_cases` — bounded research work.
- `opportunity_opportunities` — scored commercial opportunities.
- `opportunity_niche_runs` — measurable discovery/research runs.
- `schema_migrations` — applied Revenue OS migration IDs and checksums.

The reference SQL schema lives in `packages/opportunity-intelligence/mysql/schema.sql`. Production migrations are embedded in `packages/db/src/migrations.ts` so compiled applications do not depend on `.sql` files being copied beside `dist`.

## Runtime configuration

Use the dedicated environment variable:

```text
OPPORTUNITY_DATABASE_URL=mysql://umer_revenue:umer_revenue@localhost:3306/umer_revenue_os
```

Do **not** repurpose `DATABASE_URL`; it remains the PostgreSQL connection for existing application infrastructure.

## Architecture

```text
mysql2/promise Pool
        ↓
@umer/db createMySqlExecutor()
        ↓
MySqlOpportunityPersistence
        ↓
OpportunityRunService
```

The domain persistence contract remains driver-agnostic. `@umer/db` is the only layer that imports `mysql2`.

## Production connection behavior

- Uses a bounded MySQL connection pool.
- Uses parameterized queries throughout the Opportunity Intelligence persistence adapter.
- Enables keep-alive and waits for available connections instead of creating global per-request connections.
- Exposes `createMySqlClient()`, `pingMySql()`, `createMySqlExecutor()`, and `closeMySql()`.
- Existing PostgreSQL helpers remain unchanged and isolated.

## Migrations

Run:

```bash
pnpm --filter @umer/db migrate
```

The migration runner creates `schema_migrations`, applies migrations in order, records a checksum, and executes each migration inside a transaction. Re-running the command is idempotent.

Do not run destructive migrations automatically. Future schema changes should add a new migration ID rather than modifying an already-applied migration.

## Docker

The local infrastructure includes a dedicated MySQL 8.4 service on port `3306` with database `umer_revenue_os`. This database is intentionally separate from the PostgreSQL service.

## Rules

1. All writes use parameterized SQL.
2. JSON columns store evolving arrays/score documents without forcing premature relational fragmentation.
3. Foreign keys preserve niche lineage.
4. Evidence remains independently addressable so every opportunity can be traced back to source observations.
5. Production execution should wrap multi-record opportunity creation in a transaction when the workflow requires atomicity.
6. Provider-specific scraping/search code does not belong in the persistence layer.
7. Historical evidence must not be overwritten merely because a new research run exists.
