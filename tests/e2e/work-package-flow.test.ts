import { describe, expect, it } from 'vitest';
import { resolveRepoRoot, runWorkPackageE2EFlow } from './support/flow.js';

describe('M6 E2E — Request → Work Package → Orchestrator → Specialist → Artifact', () => {
  it('runs the engineering delivery flow end-to-end', async () => {
    const result = await runWorkPackageE2EFlow(resolveRepoRoot());

    expect(result.request.requestId).toBe('req-e2e-1');
    expect(result.finalStatus).toBe('AwaitingReview');

    const artifact = await result.artifactStore.get(result.artifactId!);
    expect(artifact?.artifactType).toBe('Code');
    expect(artifact?.producedFor).toBe('EXEC-001');
    expect(artifact?.acceptanceStatus).toBe('submitted');
    expect(artifact?.metadata.annotations?.memoryCitations).toContain('mem-e2e-lesson-handoff');

    const validation = result.artifactEngine.validate(artifact!, {
      requiredCriteria: ['Task task-e2e-1 delivery evidence'],
    });
    expect(validation.valid).toBe(true);
    expect(result.artifactEngine.getSealRecord(result.artifactId!)?.contentHash).toBeTruthy();

    const integrity = await result.auditService.verifyIntegrity(result.correlationId);
    expect(integrity.valid).toBe(true);
    expect(integrity.recordCount).toBeGreaterThanOrEqual(2);

    const auditTrail = await result.auditService.query({
      correlationId: result.correlationId,
      action: 'artifact.sealed',
    });
    expect(auditTrail.length).toBe(1);
  });
});
