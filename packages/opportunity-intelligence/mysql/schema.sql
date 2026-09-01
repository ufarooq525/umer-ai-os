CREATE TABLE IF NOT EXISTS schema_migrations (
  id VARCHAR(191) PRIMARY KEY,
  checksum CHAR(64) NOT NULL,
  applied_at DATETIME(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS opportunity_niches (
  id VARCHAR(191) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  geographies_json JSON NOT NULL,
  status VARCHAR(32) NOT NULL,
  priority VARCHAR(16) NOT NULL,
  target_businesses_per_run INT UNSIGNED NOT NULL,
  minimum_opportunity_score DECIMAL(5,2) NOT NULL,
  research_depth VARCHAR(16) NOT NULL,
  problem_hypotheses_json JSON NOT NULL,
  discovery_signals_json JSON NOT NULL,
  allowed_solution_types_json JSON NOT NULL,
  outreach_mode VARCHAR(32) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  INDEX idx_opportunity_niches_status_priority (status, priority)
);

CREATE TABLE IF NOT EXISTS opportunity_businesses (
  id VARCHAR(191) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  website VARCHAR(2048) NULL,
  geography VARCHAR(255) NOT NULL,
  industry VARCHAR(255) NULL,
  niche_id VARCHAR(191) NULL,
  source_refs JSON NOT NULL,
  discovered_at DATETIME(3) NOT NULL,
  last_researched_at DATETIME(3) NULL,
  INDEX idx_opportunity_businesses_niche (niche_id),
  INDEX idx_opportunity_businesses_website (website(255)),
  CONSTRAINT fk_opportunity_business_niche FOREIGN KEY (niche_id) REFERENCES opportunity_niches(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS opportunity_evidence (
  id VARCHAR(191) PRIMARY KEY,
  type VARCHAR(32) NOT NULL,
  title VARCHAR(500) NOT NULL,
  source_url VARCHAR(2048) NOT NULL,
  observed_at DATETIME(3) NOT NULL,
  excerpt TEXT NULL,
  observation TEXT NOT NULL,
  strength VARCHAR(16) NOT NULL,
  supports_json JSON NOT NULL,
  contradicts_json JSON NOT NULL,
  INDEX idx_opportunity_evidence_observed_at (observed_at),
  INDEX idx_opportunity_evidence_type (type)
);

CREATE TABLE IF NOT EXISTS opportunity_research_cases (
  id VARCHAR(191) PRIMARY KEY,
  objective TEXT NOT NULL,
  niche_id VARCHAR(191) NULL,
  business_id VARCHAR(191) NULL,
  depth VARCHAR(16) NOT NULL,
  questions_json JSON NOT NULL,
  evidence_refs_json JSON NOT NULL,
  status VARCHAR(32) NOT NULL,
  started_at DATETIME(3) NOT NULL,
  completed_at DATETIME(3) NULL,
  INDEX idx_opportunity_research_niche (niche_id),
  INDEX idx_opportunity_research_business (business_id)
);

CREATE TABLE IF NOT EXISTS opportunity_opportunities (
  id VARCHAR(191) PRIMARY KEY,
  type VARCHAR(32) NOT NULL,
  title VARCHAR(500) NOT NULL,
  geography VARCHAR(255) NOT NULL,
  market VARCHAR(255) NOT NULL,
  niche_id VARCHAR(191) NULL,
  business_id VARCHAR(191) NULL,
  problem_ids_json JSON NOT NULL,
  score_json JSON NOT NULL,
  estimated_value_min DECIMAL(18,2) NULL,
  estimated_value_max DECIMAL(18,2) NULL,
  currency CHAR(3) NULL,
  time_to_revenue_days INT UNSIGNED NULL,
  evidence_refs_json JSON NOT NULL,
  status VARCHAR(32) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  INDEX idx_opportunity_opportunities_niche_status (niche_id, status),
  INDEX idx_opportunity_opportunities_score (status, created_at),
  CONSTRAINT fk_opportunity_opportunity_niche FOREIGN KEY (niche_id) REFERENCES opportunity_niches(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS opportunity_niche_runs (
  run_id VARCHAR(191) PRIMARY KEY,
  niche_id VARCHAR(191) NOT NULL,
  businesses_discovered INT UNSIGNED NOT NULL,
  businesses_researched INT UNSIGNED NOT NULL,
  qualified_businesses INT UNSIGNED NOT NULL,
  opportunities_found INT UNSIGNED NOT NULL,
  high_value_opportunities INT UNSIGNED NOT NULL,
  estimated_pipeline DECIMAL(18,2) NOT NULL,
  errors INT UNSIGNED NOT NULL,
  started_at DATETIME(3) NOT NULL,
  completed_at DATETIME(3) NULL,
  next_run_at DATETIME(3) NULL,
  INDEX idx_opportunity_runs_niche_started (niche_id, started_at),
  CONSTRAINT fk_opportunity_run_niche FOREIGN KEY (niche_id) REFERENCES opportunity_niches(id) ON DELETE CASCADE
);
