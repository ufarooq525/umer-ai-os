import { randomUUID } from 'node:crypto';
import { createMySqlExecutor } from '@umer/db';

type Entity = { type: string; id: string };
type Row = Record<string, unknown>;

async function addDerived(db: ReturnType<typeof createMySqlExecutor>, edges: Row[], from: Entity, relation: string, to: Entity, why: unknown) {
  edges.push({ fromType: from.type, fromId: from.id, relation, toType: to.type, toId: to.id, why });
  await db.execute(`INSERT IGNORE INTO ai_business_lineage (lineage_id, from_type, from_id, relation, to_type, to_id, why_json, created_by_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'SYSTEM', UTC_TIMESTAMP(3))`, [randomUUID(), from.type, from.id, relation, to.type, to.id, JSON.stringify(why)]);
}

function ids(value: unknown): string[] { if (!Array.isArray(value)) return []; return value.filter(v => typeof v === 'string' || typeof v === 'number').map(String); }
function json(value: unknown): unknown { if (value == null) return null; if (typeof value === 'object') return value; try { return JSON.parse(String(value)); } catch { return null; } }

export async function getRevenueLineage(entityType: string, entityId: string) {
  const db = createMySqlExecutor(); const edges: Row[] = [];
  const existing = await db.execute<Row[]>(`SELECT lineage_id, from_type, from_id, relation, to_type, to_id, confidence, why_json, metadata_json, created_by_type, created_at FROM ai_business_lineage WHERE (from_type=? AND from_id=?) OR (to_type=? AND to_id=?) ORDER BY created_at ASC`, [entityType, entityId, entityType, entityId]);
  existing.forEach(e => edges.push(e));
  if (entityType === 'opportunity') {
    const rows = await db.execute<Row[]>(`SELECT id, business_id, niche_id, problem_ids_json, evidence_refs_json, score_json, status, estimated_value_min, estimated_value_max, currency FROM opportunity_opportunities WHERE id=? LIMIT 1`, [entityId]);
    const o = rows[0]; if (o) {
      if (o.business_id) await addDerived(db, edges, { type: 'opportunity', id: entityId }, 'targets_business', { type: 'business', id: String(o.business_id) }, { source: 'opportunity_opportunities.business_id' });
      if (o.niche_id) await addDerived(db, edges, { type: 'opportunity', id: entityId }, 'belongs_to_niche', { type: 'niche', id: String(o.niche_id) }, { source: 'opportunity_opportunities.niche_id' });
      ids(json(o.problem_ids_json)).forEach(id => void addDerived(db, edges, { type: 'opportunity', id: entityId }, 'addresses_problem', { type: 'problem', id }, { source: 'opportunity_opportunities.problem_ids_json' }));
      ids(json(o.evidence_refs_json)).forEach(id => void addDerived(db, edges, { type: 'opportunity', id: entityId }, 'supported_by', { type: 'evidence', id }, { source: 'opportunity_opportunities.evidence_refs_json' }));
    }
  } else if (entityType === 'problem') {
    const rows = await db.execute<Row[]>(`SELECT id, business_id, niche_id, run_id, evidence_refs_json FROM opportunity_problems WHERE id=? LIMIT 1`, [entityId]); const p = rows[0];
    if (p) { if (p.business_id) await addDerived(db, edges, { type: 'problem', id: entityId }, 'concerns_business', { type: 'business', id: String(p.business_id) }, { source: 'opportunity_problems.business_id' }); if (p.niche_id) await addDerived(db, edges, { type: 'problem', id: entityId }, 'belongs_to_niche', { type: 'niche', id: String(p.niche_id) }, { source: 'opportunity_problems.niche_id' }); ids(json(p.evidence_refs_json)).forEach(id => void addDerived(db, edges, { type: 'problem', id: entityId }, 'supported_by', { type: 'evidence', id }, { source: 'opportunity_problems.evidence_refs_json' })); }
  } else if (entityType === 'business') {
    const rows = await db.execute<Row[]>(`SELECT id, niche_id FROM opportunity_businesses WHERE id=? LIMIT 1`, [entityId]); if (rows[0]?.niche_id) await addDerived(db, edges, { type: 'business', id: entityId }, 'belongs_to_niche', { type: 'niche', id: String(rows[0].niche_id) }, { source: 'opportunity_businesses.niche_id' });
  } else if (entityType === 'evidence') {
    const rows = await db.execute<Row[]>(`SELECT id, supports_json FROM opportunity_evidence WHERE id=? LIMIT 1`, [entityId]); ids(json(rows[0]?.supports_json)).forEach(id => void addDerived(db, edges, { type: 'evidence', id: entityId }, 'supports', { type: 'opportunity', id }, { source: 'opportunity_evidence.supports_json' }));
  }
  const outcomes = await db.execute<Row[]>(`SELECT outcome_id, entity_type, entity_id, outcome_type, status, amount, currency, occurred_at, metadata_json FROM ai_business_outcomes WHERE entity_id=? OR (entity_type=? AND entity_id=?) ORDER BY created_at DESC`, [entityId, entityType, entityId]);
  const costs = await db.execute<Row[]>(`SELECT COALESCE(SUM(amount),0) AS amount FROM ai_cost_events WHERE task_id=? OR project_id=?`, [entityId, entityId]);
  return { entity: { type: entityType, id: entityId }, edges, outcomes, trackedCost: Number(costs[0]?.amount ?? 0) };
}

export async function addRevenueLineageEdge(input: { fromType: string; fromId: string; relation: string; toType: string; toId: string; why?: unknown; confidence?: number; metadata?: unknown }) {
  const db = createMySqlExecutor();
  if (![input.fromType, input.fromId, input.relation, input.toType, input.toId].every(v => v?.trim())) throw new Error('fromType, fromId, relation, toType and toId are required');
  await db.execute(`INSERT INTO ai_business_lineage (lineage_id, from_type, from_id, relation, to_type, to_id, confidence, why_json, metadata_json, created_by_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'CEO', UTC_TIMESTAMP(3)) ON DUPLICATE KEY UPDATE confidence=VALUES(confidence), why_json=VALUES(why_json), metadata_json=VALUES(metadata_json)`, [randomUUID(), input.fromType, input.fromId, input.relation, input.toType, input.toId, input.confidence ?? null, input.why == null ? null : JSON.stringify(input.why), input.metadata == null ? null : JSON.stringify(input.metadata)]);
  await db.execute(`INSERT INTO ai_workflow_events (event_id, event_type, entity_type, entity_id, message, metadata_json, occurred_at) VALUES (?, 'lineage.edge_created', ?, ?, ?, ?, UTC_TIMESTAMP(3))`, [randomUUID(), input.fromType, input.fromId, `${input.fromType}/${input.fromId} ${input.relation} ${input.toType}/${input.toId}`, JSON.stringify({ toType: input.toType, toId: input.toId, why: input.why ?? null })]);
  return { ok: true };
}

export async function recordBusinessOutcome(input: { entityType: string; entityId: string; outcomeType: string; status?: string; amount?: number | null; currency?: string; metadata?: unknown }) {
  const db = createMySqlExecutor(); const id = randomUUID();
  await db.execute(`INSERT INTO ai_business_outcomes (outcome_id, entity_type, entity_id, outcome_type, status, amount, currency, occurred_at, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(3), ?, UTC_TIMESTAMP(3))`, [id, input.entityType, input.entityId, input.outcomeType, input.status ?? 'OPEN', input.amount ?? null, input.currency ?? 'USD', input.metadata == null ? null : JSON.stringify(input.metadata)]);
  await db.execute(`INSERT INTO ai_workflow_events (event_id, event_type, entity_type, entity_id, message, metadata_json, occurred_at) VALUES (?, 'business.outcome_recorded', ?, ?, ?, ?, UTC_TIMESTAMP(3))`, [randomUUID(), input.entityType, input.entityId, `${input.outcomeType} outcome recorded`, JSON.stringify({ outcomeId: id, amount: input.amount ?? null, currency: input.currency ?? 'USD' })]);
  return { outcomeId: id };
}
