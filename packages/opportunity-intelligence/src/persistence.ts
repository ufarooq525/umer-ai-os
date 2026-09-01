import type {
  BusinessProspect,
  EvidenceRecord,
  NicheDefinition,
  NicheRunMetrics,
  Opportunity,
  ResearchCase,
} from '@umer/contracts';

export type OpportunityPersistence = {
  saveBusiness(business: BusinessProspect): Promise<void>;
  saveEvidence(evidence: EvidenceRecord): Promise<void>;
  saveNiche(niche: NicheDefinition): Promise<void>;
  saveOpportunity(opportunity: Opportunity): Promise<void>;
  saveResearchCase(researchCase: ResearchCase): Promise<void>;
  saveRunMetrics(metrics: NicheRunMetrics): Promise<void>;
  getBusiness(id: string): Promise<BusinessProspect | undefined>;
  getEvidence(id: string): Promise<EvidenceRecord | undefined>;
  getOpportunity(id: string): Promise<Opportunity | undefined>;
  listOpportunities(nicheId?: string): Promise<Opportunity[]>;
  listEvidence(ids?: string[]): Promise<EvidenceRecord[]>;
};

export class InMemoryOpportunityPersistence implements OpportunityPersistence {
  private readonly businesses = new Map<string, BusinessProspect>();
  private readonly evidence = new Map<string, EvidenceRecord>();
  private readonly niches = new Map<string, NicheDefinition>();
  private readonly opportunities = new Map<string, Opportunity>();
  private readonly researchCases = new Map<string, ResearchCase>();
  private readonly runs = new Map<string, NicheRunMetrics>();

  async saveBusiness(value: BusinessProspect): Promise<void> { this.businesses.set(value.id, structuredClone(value)); }
  async saveEvidence(value: EvidenceRecord): Promise<void> { this.evidence.set(value.id, structuredClone(value)); }
  async saveNiche(value: NicheDefinition): Promise<void> { this.niches.set(value.id, structuredClone(value)); }
  async saveOpportunity(value: Opportunity): Promise<void> { this.opportunities.set(value.id, structuredClone(value)); }
  async saveResearchCase(value: ResearchCase): Promise<void> { this.researchCases.set(value.id, structuredClone(value)); }
  async saveRunMetrics(value: NicheRunMetrics): Promise<void> { this.runs.set(value.runId, structuredClone(value)); }
  async getBusiness(id: string): Promise<BusinessProspect | undefined> { return this.businesses.get(id); }
  async getEvidence(id: string): Promise<EvidenceRecord | undefined> { return this.evidence.get(id); }
  async getOpportunity(id: string): Promise<Opportunity | undefined> { return this.opportunities.get(id); }
  async listOpportunities(nicheId?: string): Promise<Opportunity[]> {
    return [...this.opportunities.values()].filter((item) => !nicheId || item.nicheId === nicheId);
  }
  async listEvidence(ids?: string[]): Promise<EvidenceRecord[]> {
    if (!ids) return [...this.evidence.values()];
    return ids.flatMap((id) => { const item = this.evidence.get(id); return item ? [item] : []; });
  }
}

/**
 * MySQL adapter contract. The implementation is intentionally injected so the
 * domain package never depends on a specific MySQL driver or connection pool.
 * The production adapter should use parameterized queries and transactions.
 */
export type MySqlExecutor = {
  execute<T = unknown>(sql: string, params?: readonly unknown[]): Promise<T>;
};

export type MySqlOpportunityPersistenceOptions = {
  db: MySqlExecutor;
};

export class MySqlOpportunityPersistence implements OpportunityPersistence {
  constructor(private readonly options: MySqlOpportunityPersistenceOptions) {}

  async saveBusiness(value: BusinessProspect): Promise<void> {
    await this.options.db.execute(
      `INSERT INTO opportunity_businesses (id, name, website, geography, industry, niche_id, source_refs, discovered_at, last_researched_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name=VALUES(name), website=VALUES(website), geography=VALUES(geography), industry=VALUES(industry), niche_id=VALUES(niche_id), source_refs=VALUES(source_refs), last_researched_at=VALUES(last_researched_at)`,
      [value.id, value.name, value.website ?? null, value.geography, value.industry ?? null, value.nicheId ?? null, JSON.stringify(value.sourceRefs), value.discoveredAt, value.lastResearchedAt ?? null],
    );
  }

  async saveEvidence(value: EvidenceRecord): Promise<void> {
    await this.options.db.execute(
      `INSERT INTO opportunity_evidence (id, type, title, source_url, observed_at, excerpt, observation, strength, supports_json, contradicts_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE title=VALUES(title), excerpt=VALUES(excerpt), observation=VALUES(observation), strength=VALUES(strength), supports_json=VALUES(supports_json), contradicts_json=VALUES(contradicts_json)`,
      [value.id, value.type, value.title, value.sourceUrl, value.observedAt, value.excerpt ?? null, value.observation, value.strength, JSON.stringify(value.supports), JSON.stringify(value.contradicts)],
    );
  }

  async saveNiche(value: NicheDefinition): Promise<void> {
    await this.options.db.execute(
      `INSERT INTO opportunity_niches (id, name, description, geographies_json, status, priority, target_businesses_per_run, minimum_opportunity_score, research_depth, problem_hypotheses_json, discovery_signals_json, allowed_solution_types_json, outreach_mode, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description), status=VALUES(status), priority=VALUES(priority), target_businesses_per_run=VALUES(target_businesses_per_run), minimum_opportunity_score=VALUES(minimum_opportunity_score), research_depth=VALUES(research_depth), updated_at=VALUES(updated_at)`,
      [value.id, value.name, value.description, JSON.stringify(value.geographies), value.status, value.priority, value.targetBusinessesPerRun, value.minimumOpportunityScore, value.researchDepth, JSON.stringify(value.problemHypotheses), JSON.stringify(value.discoverySignals), JSON.stringify(value.allowedSolutionTypes), value.outreachMode, value.createdAt, value.updatedAt],
    );
  }

  async saveOpportunity(value: Opportunity): Promise<void> {
    await this.options.db.execute(
      `INSERT INTO opportunity_opportunities (id, type, title, geography, market, niche_id, business_id, problem_ids_json, score_json, estimated_value_min, estimated_value_max, currency, time_to_revenue_days, evidence_refs_json, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE title=VALUES(title), score_json=VALUES(score_json), estimated_value_min=VALUES(estimated_value_min), estimated_value_max=VALUES(estimated_value_max), currency=VALUES(currency), time_to_revenue_days=VALUES(time_to_revenue_days), evidence_refs_json=VALUES(evidence_refs_json), status=VALUES(status), updated_at=VALUES(updated_at)`,
      [value.id, value.type, value.title, value.geography, value.market, value.nicheId ?? null, value.businessId ?? null, JSON.stringify(value.problemIds), JSON.stringify(value.score), value.estimatedValueMin ?? null, value.estimatedValueMax ?? null, value.currency ?? null, value.timeToRevenueDays ?? null, JSON.stringify(value.evidenceRefs), value.status, value.createdAt, value.updatedAt],
    );
  }

  async saveResearchCase(value: ResearchCase): Promise<void> {
    await this.options.db.execute(
      `INSERT INTO opportunity_research_cases (id, objective, niche_id, business_id, depth, questions_json, evidence_refs_json, status, started_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE status=VALUES(status), evidence_refs_json=VALUES(evidence_refs_json), completed_at=VALUES(completed_at)`,
      [value.id, value.objective, value.nicheId ?? null, value.businessId ?? null, value.depth, JSON.stringify(value.questions), JSON.stringify(value.evidenceRefs), value.status, value.startedAt, value.completedAt ?? null],
    );
  }

  async saveRunMetrics(value: NicheRunMetrics): Promise<void> {
    await this.options.db.execute(
      `INSERT INTO opportunity_niche_runs (run_id, niche_id, businesses_discovered, businesses_researched, qualified_businesses, opportunities_found, high_value_opportunities, estimated_pipeline, errors, started_at, completed_at, next_run_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE businesses_discovered=VALUES(businesses_discovered), businesses_researched=VALUES(businesses_researched), qualified_businesses=VALUES(qualified_businesses), opportunities_found=VALUES(opportunities_found), high_value_opportunities=VALUES(high_value_opportunities), estimated_pipeline=VALUES(estimated_pipeline), errors=VALUES(errors), completed_at=VALUES(completed_at), next_run_at=VALUES(next_run_at)`,
      [value.runId, value.nicheId, value.businessesDiscovered, value.businessesResearched, value.qualifiedBusinesses, value.opportunitiesFound, value.highValueOpportunities, value.estimatedPipeline, value.errors, value.startedAt, value.completedAt ?? null, value.nextRunAt ?? null],
    );
  }

  async getBusiness(id: string): Promise<BusinessProspect | undefined> { return this.queryOne<BusinessProspect>('SELECT * FROM opportunity_businesses WHERE id = ?', [id]); }
  async getEvidence(id: string): Promise<EvidenceRecord | undefined> { return this.queryOne<EvidenceRecord>('SELECT * FROM opportunity_evidence WHERE id = ?', [id]); }
  async getOpportunity(id: string): Promise<Opportunity | undefined> { return this.queryOne<Opportunity>('SELECT * FROM opportunity_opportunities WHERE id = ?', [id]); }
  async listOpportunities(nicheId?: string): Promise<Opportunity[]> {
    return nicheId
      ? this.queryMany<Opportunity>('SELECT * FROM opportunity_opportunities WHERE niche_id = ? ORDER BY created_at DESC', [nicheId])
      : this.queryMany<Opportunity>('SELECT * FROM opportunity_opportunities ORDER BY created_at DESC');
  }
  async listEvidence(ids?: string[]): Promise<EvidenceRecord[]> {
    if (!ids?.length) return this.queryMany<EvidenceRecord>('SELECT * FROM opportunity_evidence ORDER BY observed_at DESC');
    const placeholders = ids.map(() => '?').join(', ');
    return this.queryMany<EvidenceRecord>(`SELECT * FROM opportunity_evidence WHERE id IN (${placeholders})`, ids);
  }

  private async queryOne<T>(sql: string, params: readonly unknown[]): Promise<T | undefined> {
    const result = await this.options.db.execute<T[]>(sql, params);
    return result[0];
  }

  private async queryMany<T>(sql: string, params: readonly unknown[] = []): Promise<T[]> {
    return this.options.db.execute<T[]>(sql, params);
  }
}
