import type { AgentRecord, AgentRunRecord, WorkProjectRecord, WorkTaskRecord } from '@/lib/control-api';

const OPEN_TASK_STATUSES = new Set(['Ready', 'Assigned', 'InProgress', 'InReview']);

export function agentCurrentTask(agent: AgentRecord, tasks: WorkTaskRecord[]): WorkTaskRecord | undefined {
  if (agent.currentTaskIds && agent.currentTaskIds.length > 0) {
    const byId = tasks.find((t) => agent.currentTaskIds!.includes(t.taskId));
    if (byId) return byId;
  }
  return tasks.find((t) => t.assignedAgentId === agent.agentId && OPEN_TASK_STATUSES.has(t.status));
}

export function agentProjectName(
  agent: AgentRecord,
  tasks: WorkTaskRecord[],
  projects: WorkProjectRecord[],
): string | undefined {
  const projectId = agent.currentProjectId ?? agentCurrentTask(agent, tasks)?.projectId;
  return projectId ? projects.find((p) => p.projectId === projectId)?.name : undefined;
}

export function agentCurrentRun(agent: AgentRecord, agentRuns: AgentRunRecord[]): AgentRunRecord | undefined {
  if (agent.currentWorkPackageId) {
    const byWp = agentRuns.find((r) => r.workPackageId === agent.currentWorkPackageId);
    if (byWp) return byWp;
  }
  return agentRuns.find((r) => r.agentId === agent.agentId && r.status === 'running');
}
