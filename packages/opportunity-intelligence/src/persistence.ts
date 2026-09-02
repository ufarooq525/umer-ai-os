import type {
  BusinessProspect,
  DiscoveryCandidateRecord,
  EvidenceRecord,
  NicheDefinition,
  NicheRunMetrics,
  Opportunity,
  OpportunityProblemRecord,
  OpportunityRunEvent,
  Problem,
  ResearchCase,
} from '@umer/contracts';

export type ProblemSaveMeta = {
  businessId: string;
  nicheId: string;
  runId: string;
};

export type OpportunityPersistence = {
  saveBusiness(business: BusinessProspect): Promise<void>;
  saveEvidence(evidence: EvidenceRecord): Promise<void>;
  saveNiche(niche: NicheDefinition): Promise<void>;
  saveOpportunity(opportunity: Opportunity): Promise<void>;
  saveResearchCase(researchCase: ResearchCase): Promise<void>;
  saveRunMetrics(metrics: NicheRunMetrics): Promise<void>;
  saveEvent(event: OpportunityRunEvent): Promise<void>;
  saveProblem(problem: Problem, meta: ProblemSaveMeta): Promise<void>;
  saveDiscoveryCandidate(candidate: DiscoveryCandidateRecord): Promise<void>;
  getBusiness(id: string): Promise<BusinessProspect | undefined>;
  getEvidence(id: string): Promise<EvidenceRecord | undefined>;
  getOpportunity(id: string): Promise<Opportunity | undefined>;
  getNiche(id: string): Promise<NicheDefinition | undefined>;
  listNiches(): Promise<NicheDefinition[]>;
  listOpportunities(nicheId?: string): Promise<Opportunity[]>;
  listEvidence(ids?: string[]): Promise<EvidenceRecord[]>;
  listEvents(runId: string): Promise<OpportunityRunEvent[]>;
  listProblems(filter?: { businessId?: string; nicheId?: string; runId?: string }): Promise<OpportunityProblemRecord[]>;
  listDiscoveryCandidates(runId: string): Promise<DiscoveryCandidateRecord[]>;
  getLatestRun(nicheId?: string): Promise<NicheRunMetrics | undefined>;
  listRuns(nicheId?: string, limit?: number): Promise<NicheRunMetrics[]>;
};

export class InMemoryOpportunityPersistence implements OpportunityPersistence {
  private readonly businesses = new Map<string, BusinessProspect>();
  private readonly evidence = new Map<string, EvidenceRecord>();
  private readonly niches = new Map<string, NicheDefinition>();
  private readonly opportunities = new Map<string, Opportunity>();
  private readonly researchCases = new Map<string, ResearchCase>();
  private readonly runs = new Map<string, NicheRunMetrics>();
  private readonly events: OpportunityRunEvent[] = [];
  private readonly problems: OpportunityProblemRecord[] = [];
  private readonly discoveryCandidates: DiscoveryCandidateRecord[] = [];

  async saveBusiness(value: BusinessProspect): Promise<void> { this.businesses.set(value.id, structuredClone(value)); }
  async saveEvidence(value: EvidenceRecord): Promise<void> { this.evidence.set(value.id, structuredClone(value)); }
  async saveNiche(value: NicheDefinition): Promise<void> { this.niches.set(value.id, structuredClone(value)); }
  async saveOpportunity(value: Opportunity): Promise<void> { this.opportunities.set(value.id, structuredClone(value)); }
  async saveResearchCase(value: ResearchCase): Promise<void> { this.researchCases.set(value.id, structuredClone(value)); }
  async saveRunMetrics(value: NicheRunMetrics): Promise<void> { this.runs.set(value.runId, structuredClone(value)); }
  async saveEvent(event: OpportunityRunEvent): Promise<void> { this.events.push(structuredClone(event)); }
  async saveProblem(problem: Problem, meta: ProblemSaveMeta): Promise<void> {
    const existing = this.problems.findIndex((p) => p.id === problem.id && p.runId === meta.runId);
    const record: OpportunityProblemRecord = {
      id: problem.id,
      businessId: meta.businessId,
      nicheId: meta.nicheId,
      runId: meta.runId,
      statement: problem.statement,
      severity: problem.severity,
      frequency: problem.frequency,
      financialImpact: problem.financialImpact,
      evidenceConfidence: problem.evidenceConfidence,
      evidenceRefs: problem.evidenceRefs,
      createdAt: new Date().toISOString(),
    };
    if (existing >= 0) this.problems[existing] = record;
    else this.problems.push(record);
  }
  async saveDiscoveryCandidate(candidate: DiscoveryCandidateRecord): Promise<void> {
    this.discoveryCandidates.push(structuredClone(candidate));
  }

  async getBusiness(id: string): Promise<BusinessProspect | undefined> { return this.businesses.get(id); }
  async getEvidence(id: string): Promise<EvidenceRecord | undefined> { return this.evidence.get(id); }
  async getOpportunity(id: string): Promise<Opportunity | undefined> { return this.opportunities.get(id); }
  async getNiche(id: string): Promise<NicheDefinition | undefined> { return this.niches.get(id); }
  async listNiches(): Promise<NicheDefinition[]> { return [...this.niches.values()]; }
  async listOpportunities(nicheId?: string): Promise<Opportunity[]> {
    return [...this.opportunities.values()].filter((item) => !nicheId || item.nicheId === nicheId);
  }
  async listEvidence(ids?: string[]): Promise<EvidenceRecord[]> {
    if (!ids) return [...this.evidence.values()];
    return ids.flatMap((id) => { const item = this.evidence.get(id); return item ? [item] : []; });
  }
  async listEvents(runId: string): Promise<OpportunityRunEvent[]> {
    return this.events.filter((e) => e.runId === runId);
  }
  async listProblems(filter?: { businessId?: string; nicheId?: string; runId?: string }): Promise<OpportunityProblemRecord[]> {
    return this.problems.filter((p) => {
      if (filter?.businessId && p.businessId !== filter.businessId) return false;
      if (filter?.nicheId && p.nicheId !== filter.nicheId) return false;
      if (filter?.runId && p.runId !== filter.runId) return false;
      return true;
    });
  }
  async listDiscoveryCandidates(runId: string): Promise<DiscoveryCandidateRecord[]> {
    return this.discoveryCandidates.filter((c) => c.runId === runId);
  }
  async getLatestRun(nicheId?: string): Promise<NicheRunMetrics | undefined> {
    const runs = [...this.runs.values()]
      .filter((r) => !nicheId || r.nicheId === nicheId)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    return runs[0];
  }
  async listRuns(nicheId?: string, limit = 50): Promise<NicheRunMetrics[]> {
    return [...this.runs.values()]
      .filter((r) => !nicheId || r.nicheId === nicheId)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, limit);
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

type NicheRow = {
  id: string;
  name: string;
  description: string;
  geographies_json: string | string[];
  status: NicheDefinition['status'];
  priority: NicheDefinition['priority'];
  target_businesses_per_run: number;
  minimum_opportunity_score: number | string;
  research_depth: NicheDefinition['researchDepth'];
  problem_hypotheses_json: string | string[];
  discovery_signals_json: string | string[];
  allowed_solution_types_json: string | string[];
  outreach_mode: NicheDefinition['outreachMode'];
  created_at: string;
  updated_at: string;
};

type RunMetricsRow = {
  run_id: string;
  niche_id: string;
  businesses_discovered: number;
  businesses_researched: number;
  qualified_businesses: number;
  opportunities_found: number;
  high_value_opportunities: number;
  estimated_pipeline: number | string;
  errors: number;
  started_at: string;
  completed_at: string | null;
  next_run_at: string | null;
};

type EventRow = {
  id: string;
  run_id: string;
  niche_id: string;
  stage: string;
  agent_name: string;
  level: OpportunityRunEvent['level'];
  message: string;
  metadata_json: string | Record<string, unknown> | null;
  occurred_at: string;
};

type ProblemRow = {
  id: string;
  business_id: string;
  niche_id: string;
  run_id: string;
  statement: string;
  severity: number | string;
  frequency: number | string;
  financial_impact: number | string;
  evidence_confidence: number | string;
  evidence_refs_json: string | string[];
  created_at: string;
};

type CandidateRow = {
  id: string;
  run_id: string;
  niche_id: string;
  external_id: string | null;
  name: string;
  website_url: string | null;
  phone: string | null;
  address: string | null;
  geography: string;
  industry: string | null;
  source_refs_json: string | string[];
  discovered_at: string;
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

  async saveEvent(event: OpportunityRunEvent): Promise<void> {
    await this.options.db.execute(
      `INSERT INTO opportunity_run_events (id, run_id, niche_id, stage, agent_name, level, message, metadata_json, occurred_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE message=VALUES(message), metadata_json=VALUES(metadata_json)`,
      [event.id, event.runId, event.nicheId, event.stage, event.agentName, event.level, event.message, event.metadata ? JSON.stringify(event.metadata) : null, toMySqlDateTime(event.occurredAt)],
    );
  }

  async saveProblem(problem: Problem, meta: ProblemSaveMeta): Promise<void> {
    await this.options.db.execute(
      `INSERT INTO opportunity_problems (id, business_id, niche_id, run_id, statement, severity, frequency, financial_impact, evidence_confidence, evidence_refs_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE statement=VALUES(statement), severity=VALUES(severity), frequency=VALUES(frequency), financial_impact=VALUES(financial_impact), evidence_confidence=VALUES(evidence_confidence), evidence_refs_json=VALUES(evidence_refs_json)`,
      [problem.id, meta.businessId, meta.nicheId, meta.runId, problem.statement, problem.severity, problem.frequency, problem.financialImpact, problem.evidenceConfidence, JSON.stringify(problem.evidenceRefs), toMySqlDateTime(new Date())],
    );
  }

  async saveDiscoveryCandidate(candidate: DiscoveryCandidateRecord): Promise<void> {
    await this.options.db.execute(
      `INSERT INTO opportunity_discovery_candidates (id, run_id, niche_id, external_id, name, website_url, phone, address, geography, industry, source_refs_json, discovered_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name=VALUES(name), website_url=VALUES(website_url), phone=VALUES(phone), address=VALUES(address), source_refs_json=VALUES(source_refs_json)`,
      [candidate.id, candidate.runId, candidate.nicheId, candidate.externalId ?? null, candidate.name, candidate.websiteUrl ?? null, candidate.phone ?? null, candidate.address ?? null, candidate.geography, candidate.industry ?? null, JSON.stringify(candidate.sourceRefs), toMySqlDateTime(candidate.discoveredAt)],
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

  async getNiche(id: string): Promise<NicheDefinition | undefined> {
    const row = await this.queryOne<NicheRow>('SELECT * FROM opportunity_niches WHERE id = ?', [id]);
    return row ? this.mapNiche(row) : undefined;
  }

  async listNiches(): Promise<NicheDefinition[]> {
    const rows = await this.queryMany<NicheRow>('SELECT * FROM opportunity_niches ORDER BY priority ASC, name ASC');
    return rows.map((r) => this.mapNiche(r));
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

  async listEvents(runId: string): Promise<OpportunityRunEvent[]> {
    const rows = await this.queryMany<EventRow>('SELECT * FROM opportunity_run_events WHERE run_id = ? ORDER BY occurred_at ASC', [runId]);
    return rows.map((r) => ({
      id: r.id,
      runId: r.run_id,
      nicheId: r.niche_id,
      stage: r.stage,
      agentName: r.agent_name,
      level: r.level,
      message: r.message,
      ...(r.metadata_json ? { metadata: this.parseJson<Record<string, unknown>>(r.metadata_json) } : {}),
      occurredAt: toIsoDateTime(r.occurred_at),
    }));
  }

  async listProblems(filter?: { businessId?: string; nicheId?: string; runId?: string }): Promise<OpportunityProblemRecord[]> {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (filter?.businessId) { clauses.push('business_id = ?'); params.push(filter.businessId); }
    if (filter?.nicheId) { clauses.push('niche_id = ?'); params.push(filter.nicheId); }
    if (filter?.runId) { clauses.push('run_id = ?'); params.push(filter.runId); }

    const sql = clauses.length > 0
      ? `SELECT * FROM opportunity_problems WHERE ${clauses.join(' AND ')} ORDER BY severity DESC, created_at DESC`
      : 'SELECT * FROM opportunity_problems ORDER BY severity DESC, created_at DESC';
    const rows = await this.queryMany<ProblemRow>(sql, params);
    return rows.map((r) => ({
      id: r.id,
      businessId: r.business_id,
      nicheId: r.niche_id,
      runId: r.run_id,
      statement: r.statement,
      severity: Number(r.severity),
      frequency: Number(r.frequency),
      financialImpact: Number(r.financial_impact),
      evidenceConfidence: Number(r.evidence_confidence),
      evidenceRefs: this.parseJson<string[]>(r.evidence_refs_json),
      createdAt: toIsoDateTime(r.created_at),
    }));
  }

  async listDiscoveryCandidates(runId: string): Promise<DiscoveryCandidateRecord[]> {
    const rows = await this.queryMany<CandidateRow>('SELECT * FROM opportunity_discovery_candidates WHERE run_id = ? ORDER BY discovered_at ASC', [runId]);
    return rows.map((r) => ({
      id: r.id,
      runId: r.run_id,
      nicheId: r.niche_id,
      ...(r.external_id ? { externalId: r.external_id } : {}),
      name: r.name,
      ...(r.website_url ? { websiteUrl: r.website_url } : {}),
      ...(r.phone ? { phone: r.phone } : {}),
      ...(r.address ? { address: r.address } : {}),
      geography: r.geography,
      ...(r.industry ? { industry: r.industry } : {}),
      sourceRefs: this.parseJson<string[]>(r.source_refs_json),
      discoveredAt: toIsoDateTime(r.discovered_at),
    }));
  }

  async getLatestRun(nicheId?: string): Promise<NicheRunMetrics | undefined> {
    const sql = nicheId
      ? 'SELECT * FROM opportunity_niche_runs WHERE niche_id = ? ORDER BY started_at DESC LIMIT 1'
      : 'SELECT * FROM opportunity_niche_runs ORDER BY started_at DESC LIMIT 1';
    const params = nicheId ? [nicheId] : [];
    const row = await this.queryOne<RunMetricsRow>(sql, params);
    return row ? this.mapRunMetrics(row) : undefined;
  }

  async listRuns(nicheId?: string, limit = 50): Promise<NicheRunMetrics[]> {
    const sql = nicheId
      ? 'SELECT * FROM opportunity_niche_runs WHERE niche_id = ? ORDER BY started_at DESC LIMIT ?'
      : 'SELECT * FROM opportunity_niche_runs ORDER BY started_at DESC LIMIT ?';
    const params = nicheId ? [nicheId, limit] : [limit];
    const rows = await this.queryMany<RunMetricsRow>(sql, params);
    return rows.map((r) => this.mapRunMetrics(r));
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

  private mapNiche(row: NicheRow): NicheDefinition {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      geographies: this.parseJson<string[]>(row.geographies_json),
      status: row.status,
      priority: row.priority,
      targetBusinessesPerRun: Number(row.target_businesses_per_run),
      minimumOpportunityScore: Number(row.minimum_opportunity_score),
      researchDepth: row.research_depth,
      problemHypotheses: this.parseJson<string[]>(row.problem_hypotheses_json),
      discoverySignals: this.parseJson<string[]>(row.discovery_signals_json),
      allowedSolutionTypes: this.parseJson<string[]>(row.allowed_solution_types_json),
      outreachMode: row.outreach_mode,
      createdAt: toIsoDateTime(row.created_at),
      updatedAt: toIsoDateTime(row.updated_at),
    };
  }

  private mapRunMetrics(row: RunMetricsRow): NicheRunMetrics {
    return {
      runId: row.run_id,
      nicheId: row.niche_id,
      businessesDiscovered: Number(row.businesses_discovered),
      businessesResearched: Number(row.businesses_researched),
      qualifiedBusinesses: Number(row.qualified_businesses),
      opportunitiesFound: Number(row.opportunities_found),
      highValueOpportunities: Number(row.high_value_opportunities),
      estimatedPipeline: Number(row.estimated_pipeline),
      errors: Number(row.errors),
      startedAt: toIsoDateTime(row.started_at),
      ...(row.completed_at ? { completedAt: toIsoDateTime(row.completed_at) } : {}),
      ...(row.next_run_at ? { nextRunAt: toIsoDateTime(row.next_run_at) } : {}),
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

