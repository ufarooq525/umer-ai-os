const DEFAULT_CONTROL_API_URL = 'http://127.0.0.1:4000';

export function controlApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_CONTROL_API_URL ?? DEFAULT_CONTROL_API_URL;
}

export type DashboardSummary = {
  pendingGates: number;
  workPackagesAwaitingReview: number;
  resolvedToday: number;
};

export type GateWaitRecord = {
  waitId: string;
  gateId: string;
  execId: string;
  workPackageId: string;
  artifactId?: string;
  stageFrom: string;
  stageTo: string;
  status: string;
  requiredApprovers: string[];
  recordedApprovers: string[];
  humanRequired: boolean;
  requestedAt: string;
  resolvedAt?: string;
  rationale?: string;
};

export type WorkPackageSummary = {
  workPackageId: string;
  execId: string;
  status: string;
  specialistId: string;
  stage: string;
  artifactId?: string;
};

export type AuditRecord = {
  id: string;
  auditId: string;
  action: string;
  actor: string;
  resourceType: string;
  resourceId: string;
  outcome: string;
  correlationId?: string;
  occurredAt: string;
};

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${controlApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...init?.headers,
    },
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`control-api ${path} failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function getDashboard(): Promise<DashboardSummary> {
  return fetchJson<DashboardSummary>('/v1/dashboard');
}

export async function getPendingGates(): Promise<GateWaitRecord[]> {
  const body = await fetchJson<{ gates: GateWaitRecord[] }>('/v1/gates/pending');
  return body.gates;
}

export async function getWorkPackages(): Promise<WorkPackageSummary[]> {
  const body = await fetchJson<{ workPackages: WorkPackageSummary[] }>('/v1/work-packages');
  return body.workPackages;
}

export async function getRecentAudit(): Promise<AuditRecord[]> {
  const body = await fetchJson<{ records: AuditRecord[] }>('/v1/audit/recent');
  return body.records;
}

export async function resolveGate(
  waitId: string,
  input: { decision: 'Pass' | 'Fail'; approver: string; rationale: string },
): Promise<void> {
  await fetchJson(`/v1/gates/${waitId}/resolve`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
