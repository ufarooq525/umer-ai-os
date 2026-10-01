import { describe, it, expect } from 'vitest';

// Test the smoke agent detection logic
function isSmokeAgent(agentId: string | null | undefined, correlationId: string | null | undefined): boolean {
  if (!agentId) return false;
  
  const SMOKE_PATTERNS = [
    /smoke/i,
    /test/i,
    /demo/i,
    /e2e/i,
    /fixture/i,
    /example/i,
  ];
  
  const idMatch = SMOKE_PATTERNS.some(p => p.test(agentId));
  const corrMatch = correlationId ? SMOKE_PATTERNS.some(p => p.test(correlationId)) : false;
  
  return idMatch || corrMatch;
}

describe('cleanup-test-agents', () => {
  describe('isSmokeAgent', () => {
    it('identifies smoke agents by agent_id pattern', () => {
      // Real samples from production data
      expect(isSmokeAgent('architecture-smoke-worker-1789061670391:ux.design', null)).toBe(true);
      expect(isSmokeAgent('eng-smoke-worker-1788984933465:eng.app-delivery', null)).toBe(true);
      expect(isSmokeAgent('requirements-smoke-worker-1789046073973:eng.app-delivery', null)).toBe(true);
    });

    it('identifies smoke agents by correlation_id pattern', () => {
      expect(isSmokeAgent('some-agent-id', 'corr-ux-smoke-1789061670425')).toBe(true);
      expect(isSmokeAgent('regular-agent', 'corr-test-12345')).toBe(true);
    });

    it('identifies various test patterns', () => {
      expect(isSmokeAgent('test-worker-123', null)).toBe(true);
      expect(isSmokeAgent('demo-agent-456', null)).toBe(true);
      expect(isSmokeAgent('e2e-runner-789', null)).toBe(true);
      expect(isSmokeAgent('fixture-agent-001', null)).toBe(true);
      expect(isSmokeAgent('example-worker', null)).toBe(true);
    });

    it('is case-insensitive', () => {
      expect(isSmokeAgent('SMOKE-WORKER-123', null)).toBe(true);
      expect(isSmokeAgent('Test-Agent', null)).toBe(true);
      expect(isSmokeAgent('regular', 'CORR-SMOKE-456')).toBe(true);
    });

    it('rejects seeded workforce agents (handled separately)', () => {
      // These are checked by SEEDED_AGENTS in isTestAgent(), not isSmokeAgent()
      // But they wouldn't match smoke patterns anyway
      expect(isSmokeAgent('orchestrator', null)).toBe(false);
      expect(isSmokeAgent('discovery', null)).toBe(false);
      expect(isSmokeAgent('research', null)).toBe(false);
    });

    it('rejects normal specialist agents', () => {
      // Real specialist IDs that are NOT smoke agents
      expect(isSmokeAgent('eng-specialist-123:eng.app-delivery', null)).toBe(false);
      expect(isSmokeAgent('architecture-specialist-456:ux.design', null)).toBe(false);
      expect(isSmokeAgent('qa-specialist-789:qa.verification', null)).toBe(false);
    });

    it('handles null/undefined inputs', () => {
      expect(isSmokeAgent(null, null)).toBe(false);
      expect(isSmokeAgent(undefined, null)).toBe(false);
      expect(isSmokeAgent('', null)).toBe(false);
      expect(isSmokeAgent('valid-agent', null)).toBe(false);
      expect(isSmokeAgent('valid-agent', '')).toBe(false);
    });

    it('matches smoke pattern in either agent_id OR correlation_id', () => {
      expect(isSmokeAgent('regular-agent', 'corr-smoke-123')).toBe(true);
      expect(isSmokeAgent('smoke-agent', 'regular-corr')).toBe(true);
      expect(isSmokeAgent('smoke-agent', 'corr-smoke-123')).toBe(true);
      expect(isSmokeAgent('regular-agent', 'regular-corr')).toBe(false);
    });
  });
});
