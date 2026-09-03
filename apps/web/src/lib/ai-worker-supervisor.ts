import { randomUUID } from 'node:crypto';
import { createMySqlExecutor } from '@umer/db';
import { recoverExpiredKernelTasks } from './ai-kernel-runtime';

const HEARTBEAT_TIMEOUT_SECONDS = Math.max(60, Number(process.env.AI_WORKER_HEARTBEAT_TIMEOUT_SECONDS ?? 180) || 180);

type SupervisorAgent = {
  agentId: string;
  name: string;
  status: string;
  lastHeartbeatAt: Date | null;
  currentTask: string | null;
  currentRunId: string | null;
};

async function event(db: ReturnType<typeof createMySqlExecutor>, input: { eventType: string; agentId?: string | null; workerId?: string | null; severity?: string; message: string; metadata?: unknown }) {
  await db.execute(
    `INSERT INTO ai_worker_supervisor_events (event_id, event_type, agent_id, worker_id, severity, message, metadata_json, occurred_at) VALUES (?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(3))`,
    [randomUUID(), input.eventType, input.agentId ?? null, input.workerId ?? null, input.severity ?? 'info', input.message, input.metadata == null ? null : JSON.stringify(input.metadata)],
  );
}

export async function recordWorkerHeartbeat(input: { agentId: string; workerId: string; status?: string; lastTaskId?: string | null; metadata?: unknown }) {
  const db = createMySqlExecutor();
  const [queue, active] = await Promise.all([
    db.execute<any[]>(`SELECT COUNT(*) AS count FROM ai_tasks WHERE status='QUEUED'`),
    db.execute<any[]>(`SELECT COUNT(*) AS count FROM ai_task_leases WHERE status='ACTIVE' AND agent_id=?`, [input.agentId]),
  ]);
  await db.execute(
    `INSERT INTO ai_worker_heartbeats (heartbeat_id, agent_id, worker_id, status, queue_depth, active_tasks, last_task_id, metadata_json, occurred_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(3))`,
    [randomUUID(), input.agentId, input.workerId, input.status ?? 'ONLINE', Number(queue[0]?.count ?? 0), Number(active[0]?.count ?? 0), input.lastTaskId ?? null, input.metadata == null ? null : JSON.stringify(input.metadata)],
  );
  await db.execute(`UPDATE ai_agents SET last_heartbeat_at=UTC_TIMESTAMP(3), updated_at=UTC_TIMESTAMP(3) WHERE agent_id=?`, [input.agentId]);
  return { ok: true, queueDepth: Number(queue[0]?.count ?? 0), activeTasks: Number(active[0]?.count ?? 0) };
}

export async function superviseWorkers() {
  const db = createMySqlExecutor();
  const recoveredTasks = await recoverExpiredKernelTasks();
  const agents = await db.execute<SupervisorAgent[]>(`SELECT agent_id AS agentId, name, status, last_heartbeat_at AS lastHeartbeatAt, current_task AS currentTask, current_run_id AS currentRunId FROM ai_agents ORDER BY department, name`);
  const staleCutoff = new Date(Date.now() - HEARTBEAT_TIMEOUT_SECONDS * 1000);
  const staleAgents: string[] = [];

  for (const agent of agents) {
    if (agent.status === 'PAUSED' || agent.status === 'IDLE' || !agent.lastHeartbeatAt) continue;
    if (new Date(agent.lastHeartbeatAt) < staleCutoff) {
      staleAgents.push(agent.agentId);
      await db.execute(`UPDATE ai_agents SET status='STALE', last_error=?, updated_at=UTC_TIMESTAMP(3) WHERE agent_id=? AND status <> 'PAUSED'`, [`Worker heartbeat missing for ${HEARTBEAT_TIMEOUT_SECONDS}s`, agent.agentId]);
      await event(db, { eventType: 'worker.stale', agentId: agent.agentId, severity: 'warning', message: `Worker ${agent.agentId} is stale`, metadata: { lastHeartbeatAt: agent.lastHeartbeatAt, timeoutSeconds: HEARTBEAT_TIMEOUT_SECONDS } });
    }
  }

  const [queue, running, leases, recentEvents] = await Promise.all([
    db.execute<any[]>(`SELECT COUNT(*) AS count FROM ai_tasks WHERE status='QUEUED'`),
    db.execute<any[]>(`SELECT COUNT(*) AS count FROM ai_tasks WHERE status IN ('RUNNING','ASSIGNED','WAITING','BLOCKED')`),
    db.execute<any[]>(`SELECT COUNT(*) AS count FROM ai_task_leases WHERE status='ACTIVE'`),
    db.execute<any[]>(`SELECT event_id, event_type, agent_id, worker_id, severity, message, occurred_at FROM ai_worker_supervisor_events ORDER BY occurred_at DESC LIMIT 25`),
  ]);
  await event(db, { eventType: 'supervisor.reconciled', severity: staleAgents.length ? 'warning' : 'info', message: `Worker supervision completed: ${recoveredTasks} task lease(s) recovered`, metadata: { recoveredTasks, staleAgents, queueDepth: Number(queue[0]?.count ?? 0) } });

  return {
    recoveredTasks,
    staleAgents,
    heartbeatTimeoutSeconds: HEARTBEAT_TIMEOUT_SECONDS,
    queueDepth: Number(queue[0]?.count ?? 0),
    activeTaskCount: Number(running[0]?.count ?? 0),
    activeLeaseCount: Number(leases[0]?.count ?? 0),
    agents,
    recentEvents,
  };
}
