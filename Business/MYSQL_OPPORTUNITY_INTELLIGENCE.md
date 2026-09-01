# MySQL Persistence — Opportunity Intelligence

MySQL is the production persistence target for the Opportunity Intelligence context.

## Storage model

- `opportunity_niches` — autonomous/CEO-selected search strategies.
- `opportunity_businesses` — normalized business prospects.
- `opportunity_evidence` — source-backed observations.
- `opportunity_research_cases` — bounded research work.
- `opportunity_opportunities` — scored commercial opportunities.
- `opportunity_niche_runs` — measurable discovery/research runs.

The SQL schema lives in `packages/opportunity-intelligence/mysql/schema.sql`.

## Rules

1. All writes use parameterized SQL.
2. JSON columns store evolving arrays/score documents without forcing premature relational fragmentation.
3. Foreign keys preserve niche lineage.
4. Evidence remains independently addressable so every opportunity can be traced back to source observations.
5. Production execution should wrap multi-record opportunity creation in a transaction.
6. The domain package depends only on `MySqlExecutor`; the application chooses the MySQL driver/pool.
7. No provider-specific scraping code belongs in the persistence layer.

## Recommended production adapter

Use the project's application/database layer to supply a MySQL pool implementing:

```ts
const db = {
  async execute(sql: string, params: readonly unknown[]) {
    return pool.execute(sql, params);
  },
};
```

This keeps `@umer/opportunity-intelligence` independent from `mysql2`, Prisma, Drizzle, or another driver while making MySQL the explicit production database.

## Migration strategy

Start with the schema as a versioned migration. Do not run destructive migrations automatically. Add indexes based on measured query patterns after real opportunity runs begin producing data.
