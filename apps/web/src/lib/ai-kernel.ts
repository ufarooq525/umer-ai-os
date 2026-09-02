import { createHash, randomUUID } from 'node:crypto';
import { createMySqlExecutor } from '@umer/db';

export type KernelTaskStatus = 'QUEUED' | 'CLAIMED' | 'RUNNING' | 'WAITING' | 'BLOCKED' | 'FAILED' | 'COMPLETED';

export type CreateTaskInput = {
  title: string;
  instructions?: string;
  taskType: string;
  objectiveId?: string | null;
  projectId?: string | null;
  parentTaskId?: string | null;
  runId?: string | null;
  priority?: number;
  requiredCapability?: string | null;
  tokenBudget?: number | null;
  costBudget?: number | null;
  maxAttempts?: number;
  scheduledAt?: Date | null;
  deadlineAt?: Date | null;
};

export type ClaimedTask = {
  taskId: string;
  leaseToken: string;
  agentId: string;
};

const DEFAULT_LEASE_SECONDS = 60;

export async function createKernelTask(input: CreateTaskInput): Promise<string> {
  const taskId = randomUUID();
  const db = createMySqlExecutor();
  const now = new Date();
  await db.execute(
    `INSERT INTO ai_tasks
      (task_id, objective_id, project_id, parent_task_id, run_id, task_type, title, instructions, status, priority,
       assigned_agent_id, token_budget, cost_budget, max_attempts, attempts, scheduled_at, deadline_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'QUEUED', ?, NULL, ?, ?, ?, 0, ?, ?, ?, ?)`,
    [taskId, input.objectiveId ?? null, input.projectId ?? null, input.parentTaskId ?? null, input.runId ?? null,
      input.taskType, input.title, input.instructions ?? null, input.priority ?? 50, input.tokenBudget ?? null,
      input.costBudget ?? null, input.maxAttempts ?? 3, input.scheduledAt ?? now, input.deadlineAt ?? null, now, now],
  );
  await emitKernelEvent('task.created', { taskId, projectId: input.projectId, runId: input.runId });
  return taskId;
}

/**
 * Atomically-ish claims the highest priority eligible task for an agent.
 * MySQL row locking prevents two workers sharing a connection transaction from
 * claiming the same task; the short transaction keeps the lock window small.
 */
export async function claimNextTask(agentId: string, leaseSeconds = DEFAULT_LEASE_SECONDS): Promise<ClaimedTask | null> {
  const db = createMySqlExecutor();
  const pool = db as unknown as { execute: <T = unknown>(sql: string, params?: readonly unknown[]) => Promise<T> };
  const leaseToken = randomUUID();
  const taskId = randomUUID();

  // Use a single UPDATE with an ordered derived table. The task id is selected
  // by MySQL and immediately transitioned, avoiding a read-then-write race.
  const result = await pool.execute<{ affectedRows?: number }>(
    `UPDATE ai_tasks t
       JOIN (
         SELECT task_id FROM (
           SELECT task_id FROM ai_tasks
           WHERE status='QUEUED' AND (scheduled_at IS NULL OR scheduled_at <= UTC_TIMESTAMP(3))
             AND (deadline_at IS NULL OR deadline_at > UTC_TIMESTAMP(3))
           ORDER BY priority DESC, created_at ASC
           LIMIT 1
         ) candidate
       ) picked ON picked.task_id=t.task_id
       SET t.status='CLAIMED', t.assigned_agent_id=?, t.claimed_at=UTC_TIMESTAMP(3), t.started_at=UTC_TIMESTAMP(3),
           t.attempts=t.attempts+1, t.updated_at=UTC_TIMESTAMP(3)`,
    [agentId],
  );
  const affected = Number((result as { affectedRows?: number })?.affectedRows ?? 0);
  if (affected === 0) return null;

  // The task id is recovered from the worker's newly assigned claimed task.
  const rows = await pool.execute<Array<{ task_id: string }>>(
    `SELECT task_id FROM ai_tasks WHERE assigned_agent_id=? AND status='CLAIMED' ORDER BY claimed_at DESC LIMIT 1`,
    [agentId],
  );
  const selected = rows[0]?.task_id;
  if (!selected) return null;

  await pool.execute(
    `INSERT INTO ai_task_leases (task_id, agent_id, lease_token, leased_at, lease_until, heartbeat_at)
     VALUES (?, ?, ?, UTC_TIMESTAMP(3), DATE_ADD(UTC_TIMESTAMP(3), INTERVAL ? SECOND), UTC_TIMESTAMP(3))
     ON DUPLICATE KEY UPDATE agent_id=VALUES(agent_id), lease_token=VALUES(lease_token),
       lease_until=VALUES(lease_until), heartbeat_at=VALUES(heartbeat_at)`,
    [selected, agentId, leaseToken, leaseSeconds],
  );
  await emitKernelEvent('task.claimed', { taskId: selected, agentId });
  return { taskId: selected, leaseToken, agentId };
}

export async function heartbeatTask(taskId: string, agentId: string, leaseToken: string, leaseSeconds = DEFAULT_LEASE_SECONDS): Promise<boolean> {
  const db = createMySqlExecutor();
  const result = await db.execute<{ affectedRows?: number }>(
    `UPDATE ai_task_leases
       SET heartbeat_at=UTC_TIMESTAMP(3), lease_until=DATE_ADD(UTC_TIMESTAMP(3), INTERVAL ? SECOND)
     WHERE task_id=? AND agent_id=? AND lease_token=? AND status='ACTIVE' AND lease_until > UTC_TIMESTAMP(3)`,
    [leaseSeconds, taskId, agentId, leaseToken],
  );
  return Number(result?.affectedRows ?? 0) > 0;
}

export async function completeTask(taskId: string, agentId: string, leaseToken: string, result: unknown, status: Extract<KernelTaskStatus, 'COMPLETED' | 'FAILED'> = 'COMPLETED'): Promise<void> {
  const db = createMySqlExecutor();
  const now = new Date();
  const serialized = JSON.stringify(result ?? null);
  await db.execute(
    `UPDATE ai_tasks t JOIN ai_task_leases l ON l.task_id=t.task_id
       SET t.status=?, t.completed_at=?, t.result_json=?, t.updated_at=?
     WHERE t.task_id=? AND l.agent_id=? AND l.lease_token=? AND l.status='ACTIVE'`,
    [status, now, serialized, now, taskId, agentId, leaseToken],
  );
  await db.execute(
    `UPDATE ai_task_leases SET status='RELEASED', released_at=UTC_TIMESTAMP(3) WHERE task_id=? AND agent_id=? AND lease_token=?`,
    [taskId, agentId, leaseToken],
  );
  await emitKernelEvent(`task.${status.toLowerCase()}`, { taskId, agentId });
}

/** Requeues expired leases and makes failed workers recoverable. */
export async function recoverExpiredTasks(): Promise<number> {
  const db = createMySqlExecutor();
  const result = await db.execute<{ affectedRows?: number }>(
    `UPDATE ai_tasks t JOIN ai_task_leases l ON l.task_id=t.task_id
       SET t.status=CASE WHEN t.attempts < t.max_attempts THEN 'QUEUED' ELSE 'FAILED' END,
           t.assigned_agent_id=NULL, t.updated_at=UTC_TIMESTAMP(3),
           t.error_message=CASE WHEN t.attempts < t.max_attempts THEN 'Lease expired; task requeued' ELSE 'Maximum attempts reached after lease expiry' END,
           l.status='EXPIRED', l.released_at=UTC_TIMESTAMP(3)
     WHERE l.status='ACTIVE' AND l.lease_until <= UTC_TIMESTAMP(3) AND t.status IN ('CLAIMED','RUNNING')`,
  );
  const affected = Number(result?.affectedRows ?? 0);
  if (affected > 0) await emitKernelEvent('task.leases_recovered', { affected });
  return affected;
}

export function estimateTokens(text: string): number {
  // Conservative English/code approximation; provider tokenizers should replace
  // this estimate at model-call time. Keeping it local avoids an extra model call.
  return Math.ceil(text.length / 4);
}

export function compactText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const head = Math.floor(maxChars * 0.65);
  const tail = maxChars - head;
  return `${text.slice(0, head)}\n…[context compacted]…\n${text.slice(-tail)}`;
}

export function stableCacheKey(toolName: string, input: unknown): string {
  return createHash('sha256').update(`${toolName}:${JSON.stringify(input ?? null)}`).digest('hex');
}

async function emitKernelEvent(eventType: string, payload: Record<string, unknown>): Promise<void> {
  try {
    const db = createMySqlExecutor();
    await db.execute(
      `INSERT INTO ai_workflow_events (event_id, event_type, task_id, agent_id, project_id, run_id, message, metadata_json, occurred_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(3))`,
      [randomUUID(), eventType, payload.taskId ?? null, payload.agentId ?? null, payload.projectId ?? null, payload.runId ?? null,
        eventType, JSON.stringify(payload)],
    );
  } catch (error) {
    console.warn('[ai-kernel] event write failed', error);
  }
}
