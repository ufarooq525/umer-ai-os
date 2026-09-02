import { createMySqlExecutor } from '@umer/db';

export type WorkforceAgent = {
  agentId: string;
  name: string;
  department: string;
  role: string;
  status: string;
  currentTask: string | null;
  currentProject: string | null;
  currentBusiness: string | null;
  currentRunId: string | null;
  lastHeartbeatAt: string | null;
  updatedAt: string;
  assignment: {
    assignmentId: string;
    task: string;
    status: string;
    priority: string;
    projectId: string | null;
    projectName: string | null;
    nicheId: string | null;
    businessId: string | null;
    businessName: string | null;
    nextAction: string | null;
    assignedAt: string;
    startedAt: string | null;
  } | null;
};

export type WorkforceSnapshot = {
  totals: Record<string, number>;
  totalAgents: number;
  activeAssignments: number;
  agents: WorkforceAgent[];
  recentEvents: Array<{
    eventId: string;
    agentName: string;
    eventType: string;
    stage: string | null;
    message: string;
    runId: string | null;
    occurredAt: string;
  }>;
};

type Row = Record<string, unknown>;

function text(row: Row, key: string): string | null {
  const value = row[key];
  return value == null ? null : String(value);
}

export async function getWorkforceSnapshot(): Promise<WorkforceSnapshot> {
  const db = createMySqlExecutor();
  const agents = await db.execute<Row[]>(`SELECT
      a.agent_id AS agentId, a.name, a.department, a.role, a.status,
      a.current_task AS currentTask, a.current_project AS currentProject,
      a.current_business AS currentBusiness, a.current_run_id AS currentRunId,
      a.last_heartbeat_at AS lastHeartbeatAt, a.updated_at AS updatedAt,
      x.assignment_id AS assignmentId, x.task AS assignmentTask, x.status AS assignmentStatus,
      x.priority AS assignmentPriority, x.project_id AS assignmentProjectId,
      x.project_name AS assignmentProjectName, x.niche_id AS assignmentNicheId,
      x.business_id AS assignmentBusinessId, x.business_name AS assignmentBusinessName,
      x.next_action AS assignmentNextAction, x.assigned_at AS assignmentAssignedAt,
      x.started_at AS assignmentStartedAt
    FROM ai_agents a
    LEFT JOIN ai_agent_assignments x ON x.assignment_id = (
      SELECT y.assignment_id FROM ai_agent_assignments y
      WHERE y.agent_id = a.agent_id
      ORDER BY CASE WHEN y.status IN ('RUNNING','ASSIGNED','BLOCKED','WAITING') THEN 0 ELSE 1 END,
               y.assigned_at DESC LIMIT 1
    )
    ORDER BY CASE WHEN a.status = 'RUNNING' THEN 0 WHEN a.status = 'BLOCKED' THEN 1 WHEN a.status = 'WAITING' THEN 2 ELSE 3 END,
             a.department, a.name`);

  const events = await db.execute<Row[]>(`SELECT e.event_id AS eventId, a.name AS agentName,
      e.event_type AS eventType, e.stage, e.message, e.run_id AS runId, e.occurred_at AS occurredAt
    FROM ai_agent_events e JOIN ai_agents a ON a.agent_id = e.agent_id
    ORDER BY e.occurred_at DESC LIMIT 30`);

  const mapped = agents.map((row) => ({
    agentId: String(row.agentId),
    name: String(row.name),
    department: String(row.department),
    role: String(row.role),
    status: String(row.status),
    currentTask: text(row, 'currentTask'),
    currentProject: text(row, 'currentProject'),
    currentBusiness: text(row, 'currentBusiness'),
    currentRunId: text(row, 'currentRunId'),
    lastHeartbeatAt: text(row, 'lastHeartbeatAt'),
    updatedAt: String(row.updatedAt),
    assignment: row.assignmentId == null ? null : {
      assignmentId: String(row.assignmentId),
      task: String(row.assignmentTask),
      status: String(row.assignmentStatus),
      priority: String(row.assignmentPriority),
      projectId: text(row, 'assignmentProjectId'),
      projectName: text(row, 'assignmentProjectName'),
      nicheId: text(row, 'assignmentNicheId'),
      businessId: text(row, 'assignmentBusinessId'),
      businessName: text(row, 'assignmentBusinessName'),
      nextAction: text(row, 'assignmentNextAction'),
      assignedAt: String(row.assignmentAssignedAt),
      startedAt: text(row, 'assignmentStartedAt'),
    },
  }));

  const totals = mapped.reduce<Record<string, number>>((acc, agent) => {
    acc[agent.status] = (acc[agent.status] ?? 0) + 1;
    return acc;
  }, {});

  return {
    totals,
    totalAgents: mapped.length,
    activeAssignments: mapped.filter((agent) => agent.assignment && ['RUNNING', 'ASSIGNED', 'WAITING', 'BLOCKED'].includes(agent.assignment.status)).length,
    agents: mapped,
    recentEvents: events.map((row) => ({
      eventId: String(row.eventId),
      agentName: String(row.agentName),
      eventType: String(row.eventType),
      stage: text(row, 'stage'),
      message: String(row.message),
      runId: text(row, 'runId'),
      occurredAt: String(row.occurredAt),
    })),
  };
}
