import { type NextRequest, NextResponse } from 'next/server';
import { createMySqlExecutor } from '@umer/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_LIMIT = 200;

type TimelineRow = {
  eventId: string;
  source: string;
  eventType: string;
  occurredAt: string;
  level: string;
  message: string;
  taskId: string | null;
  agentId: string | null;
  runId: string | null;
  projectId: string | null;
  entityType: string | null;
  entityId: string | null;
  metadata: unknown;
};

function nullable(value: unknown): string | null {
  return value == null ? null : String(value);
}

function parseMetadata(value: unknown): unknown {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return value; }
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const runId = params.get('runId');
  const taskId = params.get('taskId');
  const agentId = params.get('agentId');
  const projectId = params.get('projectId');
  const entityType = params.get('entityType');
  const entityId = params.get('entityId');
  const query = params.get('q');
  const parsedLimit = Number(params.get('limit') ?? 100);
  const limit = Number.isFinite(parsedLimit) ? Math.min(MAX_LIMIT, Math.max(1, Math.floor(parsedLimit))) : 100;

  try {
    const db = createMySqlExecutor();
    const rows = await db.execute<Array<Record<string, unknown>>>(
      `SELECT eventId, source, eventType, occurredAt, level, message, taskId, agentId,
              runId, projectId, entityType, entityId, metadata
         FROM (
           SELECT event_id AS eventId, 'kernel' AS source, event_type AS eventType,
                  occurred_at AS occurredAt, 'info' AS level, COALESCE(message, event_type) AS message,
                  task_id AS taskId, agent_id AS agentId, run_id AS runId, project_id AS projectId,
                  entity_type AS entityType, entity_id AS entityId, metadata_json AS metadata
             FROM ai_workflow_events
           UNION ALL
           SELECT e.event_id AS eventId, 'workforce' AS source, e.event_type AS eventType,
                  e.occurred_at AS occurredAt, 'info' AS level, e.message,
                  NULL AS taskId, e.agent_id AS agentId, e.run_id AS runId, NULL AS projectId,
                  NULL AS entityType, NULL AS entityId, e.metadata_json AS metadata
             FROM ai_agent_events e
           UNION ALL
           SELECT CONCAT('opportunity:', e.id) AS eventId, 'opportunity' AS source,
                  CONCAT(e.stage, '.', e.level) AS eventType, e.occurred_at AS occurredAt,
                  e.level AS level, e.message,
                  NULL AS taskId, a.agent_id AS agentId, e.run_id AS runId, NULL AS projectId,
                  'niche' AS entityType, e.niche_id AS entityId, e.metadata_json AS metadata
             FROM opportunity_run_events e
             LEFT JOIN ai_agents a ON LOWER(a.name) = LOWER(e.agent_name)
         ) timeline
        WHERE (? IS NULL OR runId = ?)
          AND (? IS NULL OR taskId = ?)
          AND (? IS NULL OR agentId = ?)
          AND (? IS NULL OR projectId = ?)
          AND (? IS NULL OR entityType = ?)
          AND (? IS NULL OR entityId = ?)
          AND (? IS NULL OR LOWER(CONCAT_WS(' ', eventId, source, eventType, message, taskId, agentId, runId, projectId, entityType, entityId, metadata)) LIKE CONCAT('%', LOWER(?), '%'))
        ORDER BY occurredAt DESC
        LIMIT ${limit}`,
      [runId, runId, taskId, taskId, agentId, agentId, projectId, projectId, entityType, entityType, entityId, entityId, query, query],
    );

    const events: TimelineRow[] = rows.map((row) => ({
      eventId: String(row.eventId),
      source: String(row.source),
      eventType: String(row.eventType),
      occurredAt: String(row.occurredAt),
      level: String(row.level ?? 'info'),
      message: String(row.message ?? ''),
      taskId: nullable(row.taskId),
      agentId: nullable(row.agentId),
      runId: nullable(row.runId),
      projectId: nullable(row.projectId),
      entityType: nullable(row.entityType),
      entityId: nullable(row.entityId),
      metadata: parseMetadata(row.metadata),
    }));

    return NextResponse.json({ generatedAt: new Date().toISOString(), filters: { runId, taskId, agentId, projectId, entityType, entityId, q: query }, events }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 503, headers: { 'cache-control': 'no-store' } });
  }
}
