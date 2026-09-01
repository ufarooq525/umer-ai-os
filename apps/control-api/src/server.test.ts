import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';
import {
  bootstrapDemoState,
  createControlApiServer,
  createControlApiState,
} from './server.js';

async function request(
  server: Server,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('server not listening');
  }
  const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, json: (await response.json()) as Record<string, unknown> };
}

describe('control-api', () => {
  let state: Awaited<ReturnType<typeof createControlApiState>>;
  let server: ReturnType<typeof createControlApiServer>;

  beforeAll(async () => {
    state = await createControlApiState();
    server = createControlApiServer(state);
    await bootstrapDemoState(state);
    await new Promise<void>((resolve) => server.listen(0, resolve));
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('returns dashboard summary', async () => {
    const { status, json } = await request(server, 'GET', '/v1/dashboard');
    expect(status).toBe(200);
    expect(json.pendingGates).toBe(1);
    expect(json.workPackagesAwaitingReview).toBe(1);
  });

  it('lists registered Laragon projects', async () => {
    const { status, json } = await request(server, 'GET', '/v1/projects');
    expect(status).toBe(200);
    expect((json.projects as unknown[]).length).toBe(8);
  });

  it('accepts PM intake for a registered project', async () => {
    const { status, json } = await request(server, 'POST', '/v1/intake', {
      projectId: 'school-app',
      type: 'ux',
      goal: 'Improve student dashboard empty states and navigation clarity',
      doneWhen: 'UX notes with prioritized UI changes',
    });
    expect(status).toBe(201);
    expect((json.plan as { projectId: string }).projectId).toBe('school-app');
    expect(((json.plan as { recommendedSpecialists: string[] }).recommendedSpecialists)).toContain(
      'pm.intake',
    );
  });

  it('runs seo.audit for cursive-generator intake', async () => {
    const { status, json } = await request(server, 'POST', '/v1/intake', {
      projectId: 'cursive-generator',
      type: 'seo',
      goal: 'Improve landing and share URL SEO',
      doneWhen: 'P0 items done',
    });
    expect(status).toBe(201);
    const plan = json.plan as {
      seoAudit?: { specialistId: string; items: unknown[] };
      recommendedSpecialists: string[];
    };
    expect(plan.recommendedSpecialists).toContain('seo.audit');
    expect(plan.seoAudit?.specialistId).toBe('seo.audit');
    expect((plan.seoAudit?.items.length ?? 0) > 5).toBe(true);
  });

  it('applies SEO package when approving an seo gate', async () => {
    process.env.UMER_SEO_SKIP_LIGHTHOUSE = '1';
    const intake = await request(server, 'POST', '/v1/intake', {
      projectId: 'cursive-generator',
      type: 'seo',
      goal: 'Apply package after gate pass for cursive',
      doneWhen: 'Apply report written',
    });
    expect(intake.status).toBe(201);
    const intakeId = (intake.json as { intakeId: string }).intakeId;
    const pending = await request(server, 'GET', '/v1/gates/pending');
    const seoGate = (pending.json.gates as { waitId: string; gateId: string; workPackageId?: string }[]).find((g) =>
      g.gateId.startsWith('gate-seo-') && g.workPackageId === `wp-${intakeId}`,
    );
    expect(seoGate).toBeTruthy();
    const { status, json } = await request(server, 'POST', `/v1/gates/${seoGate!.waitId}/resolve`, {
      decision: 'Pass',
      approver: 'human.approver',
      rationale: 'Approve SEO apply into Laragon project',
    });
    expect(status).toBe(200);
    const applyResult = json.applyResult as {
      summary: string;
      files: Array<{ path: string; action: string }>;
      checks?: Array<{ itemId: string; status: string }>;
    } | null;
    expect(applyResult?.summary).toContain('Cursive Generator');
    expect(applyResult?.files.some((f) => f.path.includes('.umer/seo'))).toBe(true);
    expect((applyResult?.checks?.length ?? 0) > 0).toBe(true);
  });

  it('runs qa.verify for school-app intake', async () => {
    const { status, json } = await request(server, 'POST', '/v1/intake', {
      projectId: 'school-app',
      type: 'qa',
      goal: 'Full functional and non-functional UI verification',
      doneWhen: 'P0 items evidenced',
    });
    expect(status).toBe(201);
    const plan = json.plan as {
      qaAudit?: { specialistId: string; items: unknown[] };
      recommendedSpecialists: string[];
    };
    expect(plan.recommendedSpecialists).toContain('qa.verify');
    expect(plan.qaAudit?.specialistId).toBe('qa.verify');
    expect((plan.qaAudit?.items.length ?? 0) > 8).toBe(true);
  });

  it('applies QA package when approving a qa gate', async () => {
    process.env.UMER_QA_SKIP_RUN = '1';
    const intake = await request(server, 'POST', '/v1/intake', {
      projectId: 'school-app',
      type: 'qa',
      goal: 'Apply QA package after gate pass for school-app',
      doneWhen: 'Apply report written',
    });
    expect(intake.status).toBe(201);
    const pending = await request(server, 'GET', '/v1/gates/pending');
    const qaGate = (pending.json.gates as { waitId: string; gateId: string }[]).find((g) =>
      g.gateId.startsWith('gate-qa-'),
    );
    expect(qaGate).toBeTruthy();
    const { status, json } = await request(server, 'POST', `/v1/gates/${qaGate!.waitId}/resolve`, {
      decision: 'Pass',
      approver: 'human.approver',
      rationale: 'Approve QA evidence package into Laragon project',
    });
    expect(status).toBe(200);
    const applyResult = json.applyResult as {
      summary: string;
      files: Array<{ path: string; action: string }>;
      checks?: Array<{ itemId: string; status: string }>;
      recommendedCommand?: string;
    } | null;
    expect(applyResult?.summary).toContain('School App');
    expect(applyResult?.files.some((f) => f.path.includes('.umer/qa'))).toBe(true);
    expect((applyResult?.checks?.length ?? 0) > 0).toBe(true);
  });

  it('lists pending gates', async () => {
    const { status, json } = await request(server, 'GET', '/v1/gates/pending');
    expect(status).toBe(200);
    expect((json.gates as unknown[]).length).toBeGreaterThan(0);
  });

  it('resolves a pending gate', async () => {
    const pending = await request(server, 'GET', '/v1/gates/pending');
    const waitId = (pending.json.gates as { waitId: string }[])[0]!.waitId;
    const { status, json } = await request(server, 'POST', `/v1/gates/${waitId}/resolve`, {
      decision: 'Pass',
      approver: 'human.approver',
      rationale: 'QA evidence verified in control plane UI',
    });
    expect(status).toBe(200);
    expect((json.record as { status: string }).status).toBe('passed');
  });
});
