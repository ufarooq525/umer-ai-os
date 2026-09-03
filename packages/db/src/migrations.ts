import { AI_OS_KERNEL_MIGRATIONS } from './ai-os-kernel-migrations.js';
import { AI_KERNEL_TELEMETRY_MIGRATIONS } from './ai-kernel-telemetry-migrations.js';
import { AI_KERNEL_RUNTIME_HARDENING_MIGRATIONS } from './ai-kernel-runtime-hardening-migration.js';
import { AI_KERNEL_EXPLAINABILITY_MIGRATIONS } from './ai-kernel-explainability-migration.js';
import { AI_OS_CONTROL_LINEAGE_MIGRATIONS } from './ai-os-control-lineage-migration.js';
import { AI_WORKER_SUPERVISOR_MIGRATIONS } from './ai-worker-supervisor-migration.js';
import { WORKFORCE_MIGRATIONS } from './workforce-migrations.js';

export type MySqlMigration = { id: string; checksum: string; statements: readonly string[] };

/** Revenue OS / Opportunity Intelligence schema migrations. */
export const OPPORTUNITY_MIGRATIONS: readonly MySqlMigration[] = [
  {
    id: '001_opportunity_intelligence',
    checksum: 'bd63f27c6add2bb8d3d5c6f3daba28eead9358153bf0f440e2998c2cdaa23c3c',
    statements: [
      `CREATE TABLE IF NOT EXISTS opportunity_niches (id VARCHAR(191) PRIMARY KEY, name VARCHAR(255) NOT NULL, description TEXT NOT NULL, geographies_json JSON NOT NULL, status VARCHAR(32) NOT NULL, priority VARCHAR(16) NOT NULL, target_businesses_per_run INT UNSIGNED NOT NULL, minimum_opportunity_score DECIMAL(5,2) NOT NULL, research_depth VARCHAR(16) NOT NULL, problem_hypotheses_json JSON NOT NULL, discovery_signals_json JSON NOT NULL, allowed_solution_types_json JSON NOT NULL, outreach_mode VARCHAR(32) NOT NULL, created_at DATETIME(3) NOT NULL, updated_at DATETIME(3) NOT NULL, INDEX idx_opportunity_niches_status_priority (status, priority))`,
      `CREATE TABLE IF NOT EXISTS opportunity_businesses (id VARCHAR(191) PRIMARY KEY, name VARCHAR(255) NOT NULL, website VARCHAR(2048) NULL, geography VARCHAR(255) NOT NULL, industry VARCHAR(255) NULL, niche_id VARCHAR(191) NULL, source_refs JSON NOT NULL, discovered_at DATETIME(3) NOT NULL, last_researched_at DATETIME(3) NULL, INDEX idx_opportunity_businesses_niche (niche_id), INDEX idx_opportunity_businesses_website (website(255)), CONSTRAINT fk_opportunity_business_niche FOREIGN KEY (niche_id) REFERENCES opportunity_niches(id) ON DELETE SET NULL)`,
      `CREATE TABLE IF NOT EXISTS opportunity_evidence (id VARCHAR(191) PRIMARY KEY, type VARCHAR(32) NOT NULL, title VARCHAR(500) NOT NULL, source_url VARCHAR(2048) NOT NULL, observed_at DATETIME(3) NOT NULL, excerpt TEXT NULL, observation TEXT NOT NULL, strength VARCHAR(16) NOT NULL, supports_json JSON NOT NULL, contradicts_json JSON NOT NULL, INDEX idx_opportunity_evidence_observed_at (observed_at), INDEX idx_opportunity_evidence_type (type))`,
      `CREATE TABLE IF NOT EXISTS opportunity_research_cases (id VARCHAR(191) PRIMARY KEY, objective TEXT NOT NULL, niche_id VARCHAR(191) NULL, business_id VARCHAR(191) NULL, depth VARCHAR(16) NOT NULL, questions_json JSON NOT NULL, evidence_refs_json JSON NOT NULL, status VARCHAR(32) NOT NULL, started_at DATETIME(3) NOT NULL, completed_at DATETIME(3) NULL, INDEX idx_opportunity_research_niche (niche_id), INDEX idx_opportunity_research_business (business_id))`,
      `CREATE TABLE IF NOT EXISTS opportunity_opportunities (id VARCHAR(191) PRIMARY KEY, type VARCHAR(32) NOT NULL, title VARCHAR(500) NOT NULL, geography VARCHAR(255) NOT NULL, market VARCHAR(255) NOT NULL, niche_id VARCHAR(191) NULL, business_id VARCHAR(191) NULL, problem_ids_json JSON NOT NULL, score_json JSON NOT NULL, estimated_value_min DECIMAL(18,2) NULL, estimated_value_max DECIMAL(18,2) NULL, currency CHAR(3) NULL, time_to_revenue_days INT UNSIGNED NULL, evidence_refs_json JSON NOT NULL, status VARCHAR(32) NOT NULL, created_at DATETIME(3) NOT NULL, updated_at DATETIME(3) NOT NULL, INDEX idx_opportunity_opportunities_niche_status (niche_id, status), INDEX idx_opportunity_opportunities_score (status, created_at), CONSTRAINT fk_opportunity_opportunity_niche FOREIGN KEY (niche_id) REFERENCES opportunity_niches(id) ON DELETE SET NULL)`,
      `CREATE TABLE IF NOT EXISTS opportunity_niche_runs (run_id VARCHAR(191) PRIMARY KEY, niche_id VARCHAR(191) NOT NULL, businesses_discovered INT UNSIGNED NOT NULL, businesses_researched INT UNSIGNED NOT NULL, qualified_businesses INT UNSIGNED NOT NULL, opportunities_found INT UNSIGNED NOT NULL, high_value_opportunities INT UNSIGNED NOT NULL, estimated_pipeline DECIMAL(18,2) NOT NULL, errors INT UNSIGNED NOT NULL, started_at DATETIME(3) NOT NULL, completed_at DATETIME(3) NULL, next_run_at DATETIME(3) NULL, INDEX idx_opportunity_runs_niche_started (niche_id, started_at), CONSTRAINT fk_opportunity_run_niche FOREIGN KEY (niche_id) REFERENCES opportunity_niches(id) ON DELETE CASCADE)`,
    ],
  },
  {
    id: '002_opportunity_events_and_problems',
    checksum: 'a8b7194c502b65103ce5b10cbcf1121d51fbcbf3cf3d2ef88062973418521d84',
    statements: [
      `CREATE TABLE IF NOT EXISTS opportunity_run_events (id VARCHAR(191) PRIMARY KEY, run_id VARCHAR(191) NOT NULL, niche_id VARCHAR(191) NOT NULL, stage VARCHAR(64) NOT NULL, agent_name VARCHAR(128) NOT NULL, level VARCHAR(32) NOT NULL DEFAULT 'info', message TEXT NOT NULL, metadata_json JSON NULL, occurred_at DATETIME(3) NOT NULL, INDEX idx_opportunity_run_events_run (run_id, occurred_at), INDEX idx_opportunity_run_events_niche (niche_id, occurred_at))`,
      `CREATE TABLE IF NOT EXISTS opportunity_problems (id VARCHAR(191) PRIMARY KEY, business_id VARCHAR(191) NOT NULL, niche_id VARCHAR(191) NOT NULL, run_id VARCHAR(191) NOT NULL, statement TEXT NOT NULL, severity DECIMAL(5,2) NOT NULL, frequency DECIMAL(5,2) NOT NULL, financial_impact DECIMAL(5,2) NOT NULL, evidence_confidence DECIMAL(5,2) NOT NULL, evidence_refs_json JSON NOT NULL, created_at DATETIME(3) NOT NULL, INDEX idx_opportunity_problems_business (business_id), INDEX idx_opportunity_problems_niche (niche_id), INDEX idx_opportunity_problems_run (run_id))`,
      `CREATE TABLE IF NOT EXISTS opportunity_discovery_candidates (id VARCHAR(191) PRIMARY KEY, run_id VARCHAR(191) NOT NULL, niche_id VARCHAR(191) NOT NULL, external_id VARCHAR(255) NULL, name VARCHAR(255) NOT NULL, website_url VARCHAR(2048) NULL, phone VARCHAR(64) NULL, address VARCHAR(500) NULL, geography VARCHAR(255) NOT NULL, industry VARCHAR(255) NULL, source_refs_json JSON NOT NULL, discovered_at DATETIME(3) NOT NULL, INDEX idx_opp_candidates_run (run_id), INDEX idx_opp_candidates_niche (niche_id))`,
    ],
  },
  {
    id: '003_opportunity_outreach_drafts',
    checksum: 'c4e9738bfd2f1b0a82643a6ec0409a807d9b9ea182061517441315579975b9aa',
    statements: [
      `CREATE TABLE IF NOT EXISTS opportunity_outreach_drafts (id VARCHAR(191) PRIMARY KEY, opportunity_id VARCHAR(191) NOT NULL, business_id VARCHAR(191) NOT NULL, niche_id VARCHAR(191) NOT NULL, channel VARCHAR(32) NOT NULL, recipient VARCHAR(255) NULL, subject VARCHAR(500) NULL, body TEXT NOT NULL, language VARCHAR(16) NOT NULL DEFAULT 'en', value_proposition TEXT NOT NULL, evidence_refs_json JSON NOT NULL, status VARCHAR(32) NOT NULL DEFAULT 'drafted', created_at DATETIME(3) NOT NULL, updated_at DATETIME(3) NOT NULL, INDEX idx_opportunity_outreach_opp (opportunity_id), INDEX idx_opportunity_outreach_business (business_id), INDEX idx_opportunity_outreach_status (status, created_at))`,
    ],
  },
];

export const ALL_MYSQL_MIGRATIONS: readonly MySqlMigration[] = [
  ...OPPORTUNITY_MIGRATIONS,
  ...WORKFORCE_MIGRATIONS,
  ...AI_OS_KERNEL_MIGRATIONS,
  ...AI_KERNEL_TELEMETRY_MIGRATIONS,
  ...AI_KERNEL_RUNTIME_HARDENING_MIGRATIONS,
  ...AI_KERNEL_EXPLAINABILITY_MIGRATIONS,
  ...AI_OS_CONTROL_LINEAGE_MIGRATIONS,
  ...AI_WORKER_SUPERVISOR_MIGRATIONS,
];
