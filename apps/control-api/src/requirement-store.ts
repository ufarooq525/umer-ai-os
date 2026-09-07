import { randomUUID } from 'node:crypto';
import { RequirementContractSchema, SCHEMA_VERSION, parseContract, type RequirementContract, type RequirementStatus } from '@umer/contracts';
import type { MySqlExecutor } from '@umer/db';

export type CreateRequirementInput = {
  requestId?: string;
  projectId?: string;
  opportunityId?: string;
  customerId?: string;
  title: string;
  problem: string;
  desiredOutcome: string;
  constraints?: string[];
  acceptanceCriteria: string[];
  assumptions?: string[];
  openQuestions?: string[];
  source: RequirementContract['source'];
};

export type RequirementStore = {
  create(input: CreateRequirementInput): Promise<RequirementContract>;
  get(requirementId: string): Promise<RequirementContract | undefined>;
  list(filter?: { projectId?: string; requestId?: string; status?: RequirementStatus }): Promise<RequirementContract[]>;
  decide(requirementId: string, decision: RequirementContract['decision']): Promise<RequirementContract | undefined>;
};

function buildRequirement(input: CreateRequirementInput): RequirementContract {
  const requirementId = `req-${randomUUID()}`;
  const now = new Date().toISOString();
  return parseContract(RequirementContractSchema, {
    id: requirementId,
    schemaVersion: SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
    metadata: { labels: {}, annotations: {} },
    kind: 'requirement',
    requirementId,
    requestId: input.requestId,
    projectId: input.projectId,
    opportunityId: input.opportunityId,
    customerId: input.customerId,
    status: 'Draft',
    title: input.title,
    problem: input.problem,
    desiredOutcome: input.desiredOutcome,
    constraints: input.constraints ?? [],
    acceptanceCriteria: input.acceptanceCriteria,
    assumptions: input.assumptions ?? [],
    openQuestions: input.openQuestions ?? [],
    source: input.source,
  });
}

export class InMemoryRequirementStore implements RequirementStore {
  private readonly records = new Map<string, RequirementContract>();

  async create(input: CreateRequirementInput): Promise<RequirementContract> {
    const record = buildRequirement(input);
    this.records.set(record.requirementId, record);
    return record;
  }

  async get(requirementId: string): Promise<RequirementContract | undefined> {
    return this.records.get(requirementId);
  }

  async list(filter?: { projectId?: string; requestId?: string; status?: RequirementStatus }): Promise<RequirementContract[]> {
    return [...this.records.values()].filter((r) =>
      (!filter?.projectId || r.projectId === filter.projectId) &&
      (!filter?.requestId || r.requestId === filter.requestId) &&
      (!filter?.status || r.status === filter.status),
    );
  }

  async decide(requirementId: string, decision: RequirementContract['decision']): Promise<RequirementContract | undefined> {
    const existing = this.records.get(requirementId);
    if (!existing || !decision) return existing;
    const updated = { ...existing, decision, status: decision.decision === 'Approved' ? 'Accepted' : 'Rejected', updatedAt: new Date().toISOString() } as RequirementContract;
    this.records.set(requirementId, updated);
    return updated;
  }
}

export class MySqlRequirementStore implements RequirementStore {
  constructor(private readonly db: MySqlExecutor) {}

  async create(input: CreateRequirementInput): Promise<RequirementContract> {
    const record = buildRequirement(input);
    await this.db.execute(
      `INSERT INTO requirements (requirement_id, request_id, project_id, opportunity_id, customer_id, status, title, problem, desired_outcome, constraints_json, acceptance_criteria_json, assumptions_json, open_questions_json, source_kind, source_id, source_label, decision_json, header_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [record.requirementId, record.requestId ?? null, record.projectId ?? null, record.opportunityId ?? null, record.customerId ?? null, record.status, record.title, record.problem, record.desiredOutcome, JSON.stringify(record.constraints), JSON.stringify(record.acceptanceCriteria), JSON.stringify(record.assumptions), JSON.stringify(record.openQuestions), record.source.kind, record.source.id ?? null, record.source.label ?? null, record.decision ? JSON.stringify(record.decision) : null, record.id, record.createdAt, record.updatedAt],
    );
    return record;
  }

  async get(requirementId: string): Promise<RequirementContract | undefined> {
    const rows = await this.db.execute<Array<Record<string, unknown>>>('SELECT * FROM requirements WHERE requirement_id = ? LIMIT 1', [requirementId]);
    return rows[0] ? this.fromRow(rows[0]) : undefined;
  }

  async list(filter?: { projectId?: string; requestId?: string; status?: RequirementStatus }): Promise<RequirementContract[]> {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (filter?.projectId) { clauses.push('project_id = ?'); params.push(filter.projectId); }
    if (filter?.requestId) { clauses.push('request_id = ?'); params.push(filter.requestId); }
    if (filter?.status) { clauses.push('status = ?'); params.push(filter.status); }
    const rows = await this.db.execute<Array<Record<string, unknown>>>(`SELECT * FROM requirements${clauses.length ? ` WHERE ${clauses.join(' AND ')}` : ''} ORDER BY created_at DESC`, params);
    return rows.map((row) => this.fromRow(row));
  }

  async decide(requirementId: string, decision: RequirementContract['decision']): Promise<RequirementContract | undefined> {
    const existing = await this.get(requirementId);
    if (!existing || !decision) return existing;
    const status = decision.decision === 'Approved' ? 'Accepted' : 'Rejected';
    const updatedAt = new Date().toISOString();
    await this.db.execute('UPDATE requirements SET status = ?, decision_json = ?, updated_at = ? WHERE requirement_id = ?', [status, JSON.stringify(decision), updatedAt, requirementId]);
    return { ...existing, status, decision, updatedAt } as RequirementContract;
  }

  private fromRow(row: Record<string, unknown>): RequirementContract {
    return parseContract(RequirementContractSchema, {
      id: String(row.header_id),
      schemaVersion: SCHEMA_VERSION,
      createdAt: new Date(String(row.created_at)).toISOString(),
      updatedAt: new Date(String(row.updated_at)).toISOString(),
      metadata: { labels: {}, annotations: {} },
      kind: 'requirement',
      requirementId: String(row.requirement_id),
      requestId: row.request_id ? String(row.request_id) : undefined,
      projectId: row.project_id ? String(row.project_id) : undefined,
      opportunityId: row.opportunity_id ? String(row.opportunity_id) : undefined,
      customerId: row.customer_id ? String(row.customer_id) : undefined,
      status: String(row.status),
      title: String(row.title),
      problem: String(row.problem),
      desiredOutcome: String(row.desired_outcome),
      constraints: JSON.parse(String(row.constraints_json)),
      acceptanceCriteria: JSON.parse(String(row.acceptance_criteria_json)),
      assumptions: JSON.parse(String(row.assumptions_json)),
      openQuestions: JSON.parse(String(row.open_questions_json)),
      source: { kind: String(row.source_kind), id: row.source_id ? String(row.source_id) : undefined, label: row.source_label ? String(row.source_label) : undefined },
      decision: row.decision_json ? JSON.parse(String(row.decision_json)) : undefined,
    });
  }
}
