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

type BusinessRow = {
  id: string;
  name: string;
  website: string | null;
  geography: string;
  industry: string | null;
  niche_id: string | null;
  source_refs: string | string[];
  discovered_at: string;
  last_researched_at: string | null;
};

type EvidenceRow = {
  id: string;
  type: EvidenceRecord['type'];
  title: string;
  source_url: string;
  observed_at: string;
  excerpt: string | null;
  observation: string;
  strength: EvidenceRecord['strength'];
  supports_json: string | string[];
  contradicts_json: string | string[];
};

type OpportunityRow = {
  id: string;
  type: Opportunity['type'];
  title: string;
  geography: string;
  market: string;
  niche_id: string | null;
  business_id: string | null;
  problem_ids_json: string | string[];
  score_json: string | Opportunity['score'];
  estimated_value_min: number | string | null;
  estimated_value_max: number | string | null;
  currency: string | null;
  time_to_revenue_days: number | string | null;
  evidence_refs_json: string | string[];
  status: Opportunity['status'];
  created_at: string;
  updated_at: string;
};

function toMySqlDateTime(isoString?: string | Date | null): string | null {
  if (!isoString) return null;
  const date = isoString instanceof Date ? isoString : new Date(isoString);
  if (isNaN(date.getTime())) {
    if (typeof isoString === 'string') {
      return isoString.replace('T', ' ').replace('Z', '');
    }
    return null;
  }
  return date.toISOString().replace('T', ' ').replace('Z', '');
}

function toIsoDateTime(dateVal?: string | Date | null): string {
  if (!dateVal) return '';
  if (dateVal instanceof Date) return dateVal.toISOString();
  if (typeof dateVal === 'string') {
    if (dateVal.includes(' ') && !dateVal.endsWith('Z')) {
      return dateVal.replace(' ', 'T') + 'Z';
    }
    return dateVal;
  }
  return '';
}

export class MySqlOpportunityPersistence implements OpportunityPersistence {
  constructor(private readonly options: MySqlOpportunityPersistenceOptions) {}

  async saveBusiness(value: BusinessProspect): Promise<void> {
    await this.options.db.execute(
      `INSERT INTO opportunity_businesses (id, name, website, geography, industry, niche_id, source_refs, discovered_at, last_researched_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name=VALUES(name), website=VALUES(website), geography=VALUES(geography), industry=VALUES(industry), niche_id=VALUES(niche_id), source_refs=VALUES(source_refs), last_researched_at=VALUES(last_researched_at)`,
      [value.id, value.name, value.website ?? null, value.geography, value.industry ?? null, value.nicheId ?? null, JSON.stringify(value.sourceRefs), toMySqlDateTime(value.discoveredAt), toMySqlDateTime(value.lastResearchedAt)],
    );
  }

  async saveEvidence(value: EvidenceRecord): Promise<void> {
    await this.options.db.execute(
      `INSERT INTO opportunity_evidence (id, type, title, source_url, observed_at, excerpt, observation, strength, supports_json, contradicts_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE title=VALUES(title), excerpt=VALUES(excerpt), observation=VALUES(observation), strength=VALUES(strength), supports_json=VALUES(supports_json), contradicts_json=VALUES(contradicts_json)`,
      [value.id, value.type, value.title, value.sourceUrl, toMySqlDateTime(value.observedAt), value.excerpt ?? null, value.observation, value.strength, JSON.stringify(value.supports), JSON.stringify(value.contradicts)],
    );
  }

  async saveNiche(value: NicheDefinition): Promise<void> {
    await this.options.db.execute(
      `INSERT INTO opportunity_niches (id, name, description, geographies_json, status, priority, target_businesses_per_run, minimum_opportunity_score, research_depth, problem_hypotheses_json, discovery_signals_json, allowed_solution_types_json, outreach_mode, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description), status=VALUES(status), priority=VALUES(priority), target_businesses_per_run=VALUES(target_businesses_per_run), minimum_opportunity_score=VALUES(minimum_opportunity_score), research_depth=VALUES(research_depth), updated_at=VALUES(updated_at)`,
      [value.id, value.name, value.description, JSON.stringify(value.geographies), value.status, value.priority, value.targetBusinessesPerRun, value.minimumOpportunityScore, value.researchDepth, JSON.stringify(value.problemHypotheses), JSON.stringify(value.discoverySignals), JSON.stringify(value.allowedSolutionTypes), value.outreachMode, toMySqlDateTime(value.createdAt), toMySqlDateTime(value.updatedAt)],
    );
  }

  async saveOpportunity(value: Opportunity): Promise<void> {
    await this.options.db.execute(
      `INSERT INTO opportunity_opportunities (id, type, title, geography, market, niche_id, business_id, problem_ids_json, score_json, estimated_value_min, estimated_value_max, currency, time_to_revenue_days, evidence_refs_json, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE title=VALUES(title), score_json=VALUES(score_json), estimated_value_min=VALUES(estimated_value_min), estimated_value_max=VALUES(estimated_value_max), currency=VALUES(currency), time_to_revenue_days=VALUES(time_to_revenue_days), evidence_refs_json=VALUES(evidence_refs_json), status=VALUES(status), updated_at=VALUES(updated_at)`,
      [value.id, value.type, value.title, value.geography, value.market, value.nicheId ?? null, value.businessId ?? null, JSON.stringify(value.problemIds), JSON.stringify(value.score), value.estimatedValueMin ?? null, value.estimatedValueMax ?? null, value.currency ?? null, value.timeToRevenueDays ?? null, JSON.stringify(value.evidenceRefs), value.status, toMySqlDateTime(value.createdAt), toMySqlDateTime(value.updatedAt)],
    );
  }

  async saveResearchCase(value: ResearchCase): Promise<void> {
    await this.options.db.execute(
      `INSERT INTO opportunity_research_cases (id, objective, niche_id, business_id, depth, questions_json, evidence_refs_json, status, started_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE status=VALUES(status), evidence_refs_json=VALUES(evidence_refs_json), completed_at=VALUES(completed_at)`,
      [value.id, value.objective, value.nicheId ?? null, value.businessId ?? null, value.depth, JSON.stringify(value.questions), JSON.stringify(value.evidenceRefs), value.status, toMySqlDateTime(value.startedAt), toMySqlDateTime(value.completedAt)],
    );
  }

  async saveRunMetrics(value: NicheRunMetrics): Promise<void> {
    await this.options.db.execute(
      `INSERT INTO opportunity_niche_runs (run_id, niche_id, businesses_discovered, businesses_researched, qualified_businesses, opportunities_found, high_value_opportunities, estimated_pipeline, errors, started_at, completed_at, next_run_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE businesses_discovered=VALUES(businesses_discovered), businesses_researched=VALUES(businesses_researched), qualified_businesses=VALUES(qualified_businesses), opportunities_found=VALUES(opportunities_found), high_value_opportunities=VALUES(high_value_opportunities), estimated_pipeline=VALUES(estimated_pipeline), errors=VALUES(errors), completed_at=VALUES(completed_at), next_run_at=VALUES(next_run_at)`,
      [value.runId, value.nicheId, value.businessesDiscovered, value.businessesResearched, value.qualifiedBusinesses, value.opportunitiesFound, value.highValueOpportunities, value.estimatedPipeline, value.errors, toMySqlDateTime(value.startedAt), toMySqlDateTime(value.completedAt), toMySqlDateTime(value.nextRunAt)],
    );
  }

  async getBusiness(id: string): Promise<BusinessProspect | undefined> {
    const row = await this.queryOne<BusinessRow>('SELECT * FROM opportunity_businesses WHERE id = ?', [id]);
    return row ? this.mapBusiness(row) : undefined;
  }

  async getEvidence(id: string): Promise<EvidenceRecord | undefined> {
    const row = await this.queryOne<EvidenceRow>('SELECT * FROM opportunity_evidence WHERE id = ?', [id]);
    return row ? this.mapEvidence(row) : undefined;
  }

  async getOpportunity(id: string): Promise<Opportunity | undefined> {
    const row = await this.queryOne<OpportunityRow>('SELECT * FROM opportunity_opportunities WHERE id = ?', [id]);
    return row ? this.mapOpportunity(row) : undefined;
  }

  async listOpportunities(nicheId?: string): Promise<Opportunity[]> {
    const rows = nicheId
      ? await this.queryMany<OpportunityRow>('SELECT * FROM opportunity_opportunities WHERE niche_id = ? ORDER BY created_at DESC', [nicheId])
      : await this.queryMany<OpportunityRow>('SELECT * FROM opportunity_opportunities ORDER BY created_at DESC');
    return rows.map((row) => this.mapOpportunity(row));
  }

  async listEvidence(ids?: string[]): Promise<EvidenceRecord[]> {
    const rows = !ids?.length
      ? await this.queryMany<EvidenceRow>('SELECT * FROM opportunity_evidence ORDER BY observed_at DESC')
      : await this.queryMany<EvidenceRow>(
          `SELECT * FROM opportunity_evidence WHERE id IN (${ids.map(() => '?').join(', ')})`,
          ids,
        );
    return rows.map((row) => this.mapEvidence(row));
  }

  private mapBusiness(row: BusinessRow): BusinessProspect {
    return {
      id: row.id,
      name: row.name,
      ...(row.website ? { website: row.website } : {}),
      geography: row.geography,
      ...(row.industry ? { industry: row.industry } : {}),
      ...(row.niche_id ? { nicheId: row.niche_id } : {}),
      sourceRefs: this.parseJson<string[]>(row.source_refs),
      discoveredAt: toIsoDateTime(row.discovered_at),
      ...(row.last_researched_at ? { lastResearchedAt: toIsoDateTime(row.last_researched_at) } : {}),
    };
  }

  private mapEvidence(row: EvidenceRow): EvidenceRecord {
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      sourceUrl: row.source_url,
      observedAt: toIsoDateTime(row.observed_at),
      ...(row.excerpt ? { excerpt: row.excerpt } : {}),
      observation: row.observation,
      strength: row.strength,
      supports: this.parseJson<string[]>(row.supports_json),
      contradicts: this.parseJson<string[]>(row.contradicts_json),
    };
  }

  private mapOpportunity(row: OpportunityRow): Opportunity {
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      geography: row.geography,
      market: row.market,
      ...(row.niche_id ? { nicheId: row.niche_id } : {}),
      ...(row.business_id ? { businessId: row.business_id } : {}),
      problemIds: this.parseJson<string[]>(row.problem_ids_json),
      score: this.parseJson<Opportunity['score']>(row.score_json),
      ...(row.estimated_value_min !== null ? { estimatedValueMin: Number(row.estimated_value_min) } : {}),
      ...(row.estimated_value_max !== null ? { estimatedValueMax: Number(row.estimated_value_max) } : {}),
      ...(row.currency ? { currency: row.currency } : {}),
      ...(row.time_to_revenue_days !== null ? { timeToRevenueDays: Number(row.time_to_revenue_days) } : {}),
      evidenceRefs: this.parseJson<string[]>(row.evidence_refs_json),
      status: row.status,
      createdAt: toIsoDateTime(row.created_at),
      updatedAt: toIsoDateTime(row.updated_at),
    };
  }

  private parseJson<T>(value: string | T): T {
    return typeof value === 'string' ? JSON.parse(value) as T : value;
  }

  private async queryOne<T>(sql: string, params: readonly unknown[]): Promise<T | undefined> {
    const result = await this.options.db.execute<T[]>(sql, params);
    return result[0];
  }

  private async queryMany<T>(sql: string, params: readonly unknown[] = []): Promise<T[]> {
    return this.options.db.execute<T[]>(sql, params);
  }
}
