import { randomUUID } from 'node:crypto';
import { createMySqlExecutor } from '@umer/db';

export type CEOControlAction = 'pause_agent' | 'resume_agent' | 'retry_task' | 'reassign_task' | 'cancel_task';

type ControlInput = { action: CEOControlAction; targetId: string; agentId?: string | null; reason?: string | null };

async function audit(db: ReturnType<typeof createMySqlExecutor>, input: ControlInput, before: unknown, after: unknown) {
  await db.execute(
    `INSERT INTO ai_control_audit_events (audit_id, action, target_type, target_id, actor_type, actor_id, reason, before_json, after_json, occurred_at)
     VALUES (?, ?, ?, ?, 'CEO', NULL, ?, ?, ?, UTC_TIMESTAMP(3))`,
    [randomUUID(), input.action, input.action.includes('agent') ? 'agent' : 'task', input.targetId, input.reason ?? null,
      before == null ? null : JSON.stringify(before), after == null ? null : JSON.stringify(after)],
  );
}

async function event(db: ReturnType<typeof createMySqlExecutor>, targetType: string, targetId: string, message: string, metadata: unknown) {
  await db.execute(
    `INSERT INTO ai_workflow_events (event_id, task_id, agent_id, event_type, entity_type, entity_id, message, metadata_json, occurred_at)
     VALUES (?, ?, ?, 'ceo.control', ?, ?, ?, ?, UTC_TIMESTAMP(3))`,
    [randomUUID(), targetType === 'task' ? targetId : null, targetType === 'agent' ? targetId : null, targetType, targetId, message, JSON.stringify(metadata)],
  );
}

export async function executeCEOControl(input: ControlInput) {
  const db = createMySqlExecutor();
  if (!input.targetId.trim()) throw new Error('targetId is required');
  if (input.action === 'pause_agent') {
    const rows = await db.execute<any[]>(`SELECT agent_id, status FROM ai_agents WHERE agent_id=? LIMIT 1`, [input.targetId]);
    if (!rows.length) throw new Error('Agent not found');
    const before = rows[0];
    await db.execute(`UPDATE ai_agents SET status='PAUSED', updated_at=UTC_TIMESTAMP(3), last_error=NULL WHERE agent_id=?`, [input.targetId]);
    const after = { ...before, status: 'PAUSED' };
    await audit(db, input, before, after); await event(db, 'agent', input.targetId, `CEO paused agent ${input.targetId}`, { action: input.action, reason: input.reason ?? null });
    return after;
  }
  if (input.action === 'resume_agent') {
    const rows = await db.execute<any[]>(`SELECT agent_id, status FROM ai_agents WHERE agent_id=? LIMIT 1`, [input.targetId]);
    if (!rows.length) throw new Error('Agent not found');
    const before = rows[0];
    if (before.status !== 'PAUSED') throw new Error(`Agent is ${before.status}, not PAUSED`);
    await db.execute(`UPDATE ai_agents SET status='IDLE', updated_at=UTC_TIMESTAMP(3) WHERE agent_id=?`, [input.targetId]);
    const after = { ...before, status: 'IDLE' };
    await audit(db, input, before, after); await event(db, 'agent', input.targetId, `CEO resumed agent ${input.targetId}`, { action: input.action, reason: input.reason ?? null });
    return after;
  }
  const rows = await db.execute<any[]>(`SELECT task_id, status, assigned_agent_id, priority, attempts, max_attempts, error_message FROM ai_tasks WHERE task_id=? LIMIT 1`, [input.targetId]);
  if (!rows.length) throw new Error('Task not found');
  const before = rows[0];
  if (input.action === 'retry_task') {
    if (!['FAILED', 'BLOCKED', 'WAITING', 'CANCELLED'].includes(before.status)) throw new Error(`Task cannot be retried from ${before.status}`);
    await db.execute(`UPDATE ai_tasks SET status='QUEUED', assigned_agent_id=NULL, completed_at=NULL, error_message=NULL, updated_at=UTC_TIMESTAMP(3) WHERE task_id=?`, [input.targetId]);
  } else if (input.action === 'cancel_task') {
    if (['COMPLETED', 'CANCELLED'].includes(before.status)) throw new Error(`Task cannot be cancelled from ${before.status}`);
    await db.execute(`UPDATE ai_tasks SET status='CANCELLED', completed_at=UTC_TIMESTAMP(3), error_message=?, updated_at=UTC_TIMESTAMP(3) WHERE task_id=?`, [`Cancelled by CEO${input.reason ? `: ${input.reason}` : ''}`, input.targetId]);
    await db.execute(`UPDATE ai_task_leases SET status='RELEASED', released_at=UTC_TIMESTAMP(3) WHERE task_id=? AND status='ACTIVE'`, [input.targetId]);
  } else if (input.action === 'reassign_task') {
    if (!input.agentId?.trim()) throw new Error('agentId is required for reassignment');
    const agents = await db.execute<any[]>(`SELECT agent_id, status FROM ai_agents WHERE agent_id=? LIMIT 1`, [input.agentId]);
    if (!agents.length) throw new Error('Target agent not found');
    if (agents[0].status === 'PAUSED') throw new Error('Cannot assign work to a paused agent');
    if (['COMPLETED', 'CANCELLED'].includes(before.status)) throw new Error(`Task cannot be reassigned from ${before.status}`);
    await db.execute(`UPDATE ai_tasks SET assigned_agent_id=?, status=CASE WHEN status IN ('QUEUED','ASSIGNED') THEN 'ASSIGNED' ELSE status END, updated_at=UTC_TIMESTAMP(3) WHERE task_id=?`, [input.agentId, input.targetId]);
  } else throw new Error(`Unsupported action: ${input.action}`);
  const afterRows = await db.execute<any[]>(`SELECT task_id, status, assigned_agent_id, priority, attempts, max_attempts, error_message FROM ai_tasks WHERE task_id=? LIMIT 1`, [input.targetId]);
  const after = afterRows[0];
  await audit(db, input, before, after);
  await event(db, 'task', input.targetId, `CEO ${input.action.replaceAll('_', ' ')} on task ${input.targetId}`, { action: input.action, reason: input.reason ?? null, agentId: input.agentId ?? null });
  return after;
}

export async function getControlState() {
  const db = createMySqlExecutor();
  const [agents, tasks, auditRows] = await Promise.all([
    db.execute<any[]>(`SELECT agent_id, name, status, current_task, current_run_id, updated_at FROM ai_agents ORDER BY department, name`),
    db.execute<any[]>(`SELECT task_id, title, status, assigned_agent_id, priority, attempts, max_attempts, error_message, updated_at FROM ai_tasks WHERE status NOT IN ('COMPLETED') ORDER BY updated_at DESC LIMIT 100`),
    db.execute<any[]>(`SELECT audit_id, action, target_type, target_id, reason, before_json, after_json, occurred_at FROM ai_control_audit_events ORDER BY occurred_at DESC LIMIT 50`),
  ]);
  return { agents, tasks, audit: auditRows };
}
