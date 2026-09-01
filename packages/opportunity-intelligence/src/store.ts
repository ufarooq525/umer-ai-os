import type {
  BusinessProspect,
  EvidenceRecord,
  NicheDefinition,
  NicheRunMetrics,
  Opportunity,
  ResearchCase,
} from '@umer/contracts';

export type OpportunityStore = {
  save(opportunity: Opportunity): Promise<void>;
  get(id: string): Promise<Opportunity | undefined>;
  list(): Promise<Opportunity[]>;
};

export type BusinessProspectStore = {
  save(prospect: BusinessProspect): Promise<void>;
  get(id: string): Promise<BusinessProspect | undefined>;
  list(): Promise<BusinessProspect[]>;
};

export type EvidenceStore = {
  save(evidence: EvidenceRecord): Promise<void>;
  get(id: string): Promise<EvidenceRecord | undefined>;
  list(): Promise<EvidenceRecord[]>;
};

export type ResearchCaseStore = {
  save(researchCase: ResearchCase): Promise<void>;
  get(id: string): Promise<ResearchCase | undefined>;
  list(): Promise<ResearchCase[]>;
};

export type NicheStore = {
  save(niche: NicheDefinition): Promise<void>;
  get(id: string): Promise<NicheDefinition | undefined>;
  list(): Promise<NicheDefinition[]>;
};

export type NicheRunMetricsStore = {
  save(metrics: NicheRunMetrics): Promise<void>;
  get(runId: string): Promise<NicheRunMetrics | undefined>;
  listByNiche(nicheId: string): Promise<NicheRunMetrics[]>;
};

type Identifiable = { id: string };

class InMemoryStore<T extends Identifiable> {
  protected readonly records = new Map<string, T>();

  async save(record: T): Promise<void> {
    this.records.set(record.id, structuredClone(record));
  }

  async get(id: string): Promise<T | undefined> {
    const record = this.records.get(id);
    return record ? structuredClone(record) : undefined;
  }

  async list(): Promise<T[]> {
    return structuredClone([...this.records.values()]);
  }

  clear(): void {
    this.records.clear();
  }
}

export class InMemoryOpportunityStore extends InMemoryStore<Opportunity> implements OpportunityStore {}
export class InMemoryBusinessProspectStore extends InMemoryStore<BusinessProspect> implements BusinessProspectStore {}
export class InMemoryEvidenceStore extends InMemoryStore<EvidenceRecord> implements EvidenceStore {}
export class InMemoryResearchCaseStore extends InMemoryStore<ResearchCase> implements ResearchCaseStore {}
export class InMemoryNicheStore extends InMemoryStore<NicheDefinition> implements NicheStore {}

export class InMemoryNicheRunMetricsStore implements NicheRunMetricsStore {
  private readonly records = new Map<string, NicheRunMetrics>();

  async save(metrics: NicheRunMetrics): Promise<void> {
    this.records.set(metrics.runId, structuredClone(metrics));
  }

  async get(runId: string): Promise<NicheRunMetrics | undefined> {
    const record = this.records.get(runId);
    return record ? structuredClone(record) : undefined;
  }

  async listByNiche(nicheId: string): Promise<NicheRunMetrics[]> {
    return structuredClone([...this.records.values()].filter((record) => record.nicheId === nicheId));
  }

  clear(): void {
    this.records.clear();
  }
}
