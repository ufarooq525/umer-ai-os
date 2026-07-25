/**
 * Turn raw audit machine fields into copy a human can scan.
 * Demo seed events (control-api bootstrap) are flagged separately.
 */

export type AuditRecordLike = {
  action: string;
  actor: string;
  resourceType: string;
  resourceId: string;
  outcome: string;
  correlationId?: string;
  occurredAt: string;
  detail?: Record<string, unknown>;
};

export type AuditStory = {
  title: string;
  projectLabel: string | null;
  who: string;
  what: string;
  isDemo: boolean;
  technical: string;
};

const ACTION_TITLES: Record<string, string> = {
  'agent.run.completed': 'Specialist finished a run',
  'artifact.sealed': 'Results sealed (saved evidence package)',
  'control.approval.requested': 'Waiting for your approval at a gate',
  'gate.decide': 'Gate decision recorded',
};

const ACTOR_LABELS: Record<string, string> = {
  'eng.app-delivery': 'Engineering',
  'qa.verify': 'QA',
  'seo.audit': 'SEO',
  'perf.optimize': 'Performance',
  'security.review': 'Security',
  'ux.design': 'UX Design',
  'pm.intake': 'Project Manager',
  'human.approver': 'You (approver)',
  'human.operator': 'You (operator)',
};

const DEMO_CORRELATIONS = new Set(['corr-e2e-flow', 'corr-demo-seed']);

export function isDemoAuditRecord(record: AuditRecordLike): boolean {
  if (record.detail?.demo === true) return true;
  if (record.correlationId && DEMO_CORRELATIONS.has(record.correlationId)) return true;
  if (record.resourceId === 'wp-e2e-1' || record.resourceId === 'art-wp-e2e-1-1') return true;
  return false;
}

function actorLabel(actor: string): string {
  return ACTOR_LABELS[actor] ?? actor;
}

function projectFromRecord(record: AuditRecordLike): string | null {
  if (record.resourceType === 'project' && record.resourceId) {
    return record.resourceId;
  }
  const fromDetail = record.detail?.projectId;
  if (typeof fromDetail === 'string' && fromDetail.length > 0) return fromDetail;
  if (record.resourceId.startsWith('gate-')) {
    // gate-perf-umer-portfolio → umer-portfolio
    const parts = record.resourceId.split('-');
    if (parts.length >= 3) return parts.slice(2).join('-');
  }
  return null;
}

export function describeAuditRecord(record: AuditRecordLike): AuditStory {
  const isDemo = isDemoAuditRecord(record);
  const projectId = projectFromRecord(record);
  const title = ACTION_TITLES[record.action] ?? record.action;
  const who = actorLabel(record.actor);

  let what: string;
  if (record.action === 'control.approval.requested') {
    what = projectId
      ? `${who} opened a review gate for project “${projectId}”.`
      : `${who} opened a review gate.`;
  } else if (record.action === 'gate.decide') {
    what =
      record.outcome === 'success'
        ? `${who} approved a gate${projectId ? ` for “${projectId}”` : ''}.`
        : `${who} rejected a gate${projectId ? ` for “${projectId}”` : ''}.`;
  } else if (record.action === 'artifact.sealed') {
    what = projectId
      ? `${who} saved an evidence package for project “${projectId}”.`
      : `${who} saved an evidence package (${record.resourceType}/${record.resourceId}).`;
  } else if (record.action === 'agent.run.completed') {
    what = isDemo
      ? 'Sample demo run (not from one of your Quick Tasks).'
      : `${who} finished work on ${record.resourceType}/${record.resourceId}.`;
  } else {
    what = `${who} · ${record.resourceType}/${record.resourceId}`;
  }

  return {
    title,
    projectLabel: isDemo ? 'Demo seed (not a real project task)' : projectId,
    who,
    what,
    isDemo,
    technical: `${record.actor} · ${record.resourceType}/${record.resourceId}`,
  };
}

export function partitionAuditRecords<T extends AuditRecordLike>(
  records: T[],
): { real: T[]; demo: T[] } {
  const real: T[] = [];
  const demo: T[] = [];
  for (const r of records) {
    if (isDemoAuditRecord(r)) demo.push(r);
    else real.push(r);
  }
  return { real, demo };
}
