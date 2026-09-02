import { randomUUID } from 'node:crypto';
import { createMySqlExecutor } from '@umer/db';

const AGENT_IDS: Record<string, string> = {
  Orchestrator: 'orchestrator',
  'Discovery Agent': 'discovery',
  'Identity Agent': 'identity',
  'Research Agent': 'research',
  'Audit Agent': 'audit',
  'Analysis Agent': 'analysis',
  'Opportunity Agent': 'opportunity',
  'Outreach Agent': 'outreach',
};

function idFor(agentName: string): string | null {
  return AGENT_IDS[agentName] ?? null;
}

/** Best-effort telemetry: observability must never crash the business run. */
export function persistWorkforceState(input: {
  agentName: string;
  status: string;
  task?: string | null;
  project?: string | null;
  business?: string | null;
  runId?: string | null;
  assignmentStatus?: string;
  nextAction?: string | null;
  eventType?: string;
  stage?: string | null;
  message?: string;
}): void {
  const agentId = idFor(input.agentName);
  if (!agentId) return;

  void (async () => {
    try {
      const db = createMySqlExecutor();
      const now = new Date();
      await db.execute(
        `UPDATE ai_agents SET status=?, current_task=?, current_project=?, current_business=?, current_run_id=?, last_heartbeat_at=?,
         started_at=CASE WHEN ?='RUNNING' AND started_at IS NULL THEN ? ELSE started_at END,
         completed_at=CASE WHEN ? IN ('COMPLETED','FAILED') THEN ? ELSE completed_at END,
         last_error=CASE WHEN ?='FAILED' THEN ? ELSE last_error END, updated_at=? WHERE agent_id=?`,
        [input.status, input.task ?? null, input.project ?? null, input.business ?? null, input.runId ?? null, now,
          input.status, now, input.status, now, input.status, input.status === 'FAILED' ? input.message ?? null : null, now, agentId],
      );

      if (input.runId && input.task) {
        const assignmentId = `${agentId}-${input.runId}`;
        await db.execute(
          `INSERT INTO ai_agent_assignments
           (assignment_id, agent_id, run_id, project_name, niche_id, business_name, task, status, assigned_at, started_at, next_action)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE task=VALUES(task), status=VALUES(status), project_name=VALUES(project_name),
             niche_id=VALUES(niche_id), business_name=VALUES(business_name), next_action=VALUES(next_action),
             started_at=CASE WHEN VALUES(status)='RUNNING' AND started_at IS NULL THEN VALUES(started_at) ELSE started_at END,
             completed_at=CASE WHEN VALUES(status) IN ('COMPLETED','FAILED') THEN CURRENT_TIMESTAMP(3) ELSE completed_at END`,
          [assignmentId, agentId, input.runId, input.project ?? null, input.stage ? `stage:${input.stage}` : null,
            input.business ?? null, input.task, input.assignmentStatus ?? input.status, now, input.status === 'RUNNING' ? now : null, input.nextAction ?? null],
        );
      }

      if (input.message) {
        await db.execute(
          `INSERT INTO ai_agent_events (event_id, agent_id, run_id, assignment_id, event_type, stage, message, occurred_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [randomUUID(), agentId, input.runId ?? null, input.runId ? `${agentId}-${input.runId}` : null,
            input.eventType ?? 'state', input.stage ?? null, input.message, now],
        );
      }
    } catch (error) {
      console.warn('[workforce] telemetry write failed', error);
    }
  })();
}
