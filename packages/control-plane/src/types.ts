export const packageName = '@umer/control-plane' as const;

export type GateWaitStatus = 'waiting' | 'passed' | 'failed' | 'escalated';

export type GateWaitRecord = {
  waitId: string;
  gateId: string;
  execId: string;
  workPackageId: string;
  artifactId?: string;
  stageFrom: string;
  stageTo: string;
  status: GateWaitStatus;
  requiredApprovers: string[];
  recordedApprovers: string[];
  humanRequired: boolean;
  requestedAt: string;
  resolvedAt?: string;
  rationale?: string;
};

export type RequestGateReviewInput = {
  gateId: string;
  execId: string;
  workPackageId: string;
  artifactId?: string;
  stageFrom: string;
  stageTo: string;
  requiredApprovers?: string[];
  humanRequired?: boolean;
};

export type ResolveGateInput = {
  decision: 'Pass' | 'Fail';
  approver: string;
  rationale: string;
};

export type DashboardSummary = {
  pendingGates: number;
  workPackagesAwaitingReview: number;
  resolvedToday: number;
};
