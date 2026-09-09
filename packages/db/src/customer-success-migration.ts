import { createHash } from 'node:crypto';
import type { MySqlMigration } from './migrations.js';

const STATEMENTS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS customer_accounts (
    id VARCHAR(191) PRIMARY KEY,
    prospect_id VARCHAR(191) NOT NULL,
    deal_id VARCHAR(191) NULL,
    company_name VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL,
    health_score INT NOT NULL,
    health_tier VARCHAR(32) NOT NULL,
    primary_contact_id VARCHAR(191) NULL,
    active_project_ids_json JSON NOT NULL,
    mrr DECIMAL(18,2) NOT NULL DEFAULT 0,
    lifetime_value DECIMAL(18,2) NOT NULL DEFAULT 0,
    created_at DATETIME(3) NOT NULL,
    updated_at DATETIME(3) NOT NULL,
    INDEX idx_customer_accounts_status (status, updated_at),
    INDEX idx_customer_accounts_health (health_tier, health_score),
    INDEX idx_customer_accounts_prospect (prospect_id)
  )`,
  `CREATE TABLE IF NOT EXISTS customer_delivery_outcomes (
    id VARCHAR(191) PRIMARY KEY,
    project_id VARCHAR(191) NOT NULL,
    customer_id VARCHAR(191) NOT NULL,
    status VARCHAR(32) NOT NULL,
    delivered_at DATETIME(3) NOT NULL,
    scope_delivered_percent DECIMAL(5,2) NOT NULL,
    acceptance_criteria_met BOOLEAN NOT NULL,
    client_signoff_json JSON NOT NULL,
    kpi_results_json JSON NOT NULL,
    notes TEXT NULL,
    created_at DATETIME(3) NOT NULL,
    updated_at DATETIME(3) NOT NULL,
    INDEX idx_delivery_outcomes_project (project_id),
    INDEX idx_delivery_outcomes_customer (customer_id)
  )`,
  `CREATE TABLE IF NOT EXISTS customer_support_cases (
    id VARCHAR(191) PRIMARY KEY,
    customer_id VARCHAR(191) NOT NULL,
    project_id VARCHAR(191) NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    severity VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL,
    sla_hours INT NOT NULL,
    sla_breached BOOLEAN NOT NULL DEFAULT FALSE,
    reported_by VARCHAR(255) NOT NULL,
    assigned_specialist VARCHAR(191) NOT NULL,
    resolution_summary TEXT NULL,
    resolved_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL,
    updated_at DATETIME(3) NOT NULL,
    INDEX idx_support_cases_customer (customer_id, status),
    INDEX idx_support_cases_severity (severity, status)
  )`,
  `CREATE TABLE IF NOT EXISTS customer_feedback (
    id VARCHAR(191) PRIMARY KEY,
    customer_id VARCHAR(191) NOT NULL,
    project_id VARCHAR(191) NOT NULL,
    nps_score INT NOT NULL,
    csat_score INT NOT NULL,
    sentiment VARCHAR(32) NOT NULL,
    category VARCHAR(64) NOT NULL,
    feedback_text TEXT NOT NULL,
    actionable_quotes_json JSON NOT NULL,
    submitted_at DATETIME(3) NOT NULL,
    created_at DATETIME(3) NOT NULL,
    updated_at DATETIME(3) NOT NULL,
    INDEX idx_customer_feedback_customer (customer_id),
    INDEX idx_customer_feedback_sentiment (sentiment)
  )`,
  `CREATE TABLE IF NOT EXISTS customer_financial_summaries (
    id VARCHAR(191) PRIMARY KEY,
    project_id VARCHAR(191) NOT NULL,
    customer_id VARCHAR(191) NOT NULL,
    contract_revenue DECIMAL(18,2) NOT NULL,
    recognized_revenue DECIMAL(18,2) NOT NULL,
    invoiced_amount DECIMAL(18,2) NOT NULL,
    collected_amount DECIMAL(18,2) NOT NULL,
    costs_json JSON NOT NULL,
    gross_margin DECIMAL(18,2) NOT NULL,
    margin_percentage DECIMAL(5,2) NOT NULL,
    profitability_status VARCHAR(32) NOT NULL,
    calculated_at DATETIME(3) NOT NULL,
    created_at DATETIME(3) NOT NULL,
    updated_at DATETIME(3) NOT NULL,
    INDEX idx_financial_summaries_project (project_id),
    INDEX idx_financial_summaries_customer (customer_id)
  )`,
  `CREATE TABLE IF NOT EXISTS customer_learnings (
    id VARCHAR(191) PRIMARY KEY,
    source_type VARCHAR(64) NOT NULL,
    project_id VARCHAR(191) NULL,
    customer_id VARCHAR(191) NULL,
    opportunity_id VARCHAR(191) NULL,
    title VARCHAR(500) NOT NULL,
    category VARCHAR(64) NOT NULL,
    key_insight TEXT NOT NULL,
    recommended_actions_json JSON NOT NULL,
    impact_estimates_json JSON NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    extracted_at DATETIME(3) NOT NULL,
    created_at DATETIME(3) NOT NULL,
    updated_at DATETIME(3) NOT NULL,
    INDEX idx_customer_learnings_source (source_type),
    INDEX idx_customer_learnings_category (category)
  )`,
];

const checksum = createHash('sha256')
  .update(STATEMENTS.map((s) => s.trim().replace(/\s+/g, ' ')).join('\n'))
  .digest('hex');

/** Durable customer success, delivery outcomes, financials, and learnings state. */
export const CUSTOMER_SUCCESS_MIGRATIONS: readonly MySqlMigration[] = [
  {
    id: '017_customer_success',
    checksum,
    statements: STATEMENTS,
  },
];
