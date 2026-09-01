import { describe, expect, it } from 'vitest';
import type { EvidenceRecord } from '@umer/contracts';
import { InMemoryOpportunityPersistence } from './persistence.js';
import { ResearchOrchestrator } from './research-orchestrator.js';
import { SAUDI_UMRAH_NICHE } from './niche-profiles.js';
import type { ResearchAdapter } from './pipeline.js';

describe('ResearchOrchestrator', () => {
  const candidate = {
    externalId: 'transport-1',
    name: 'Example Transport',
    geography: 'Makkah, Saudi Arabia',
    industry: 'transport',
    websiteUrl: 'https://example-transport.test',
    sourceRefs: ['https://directory.example/transport-1'],
  };

  it('persists evidence and completes the research case', async () => {
    const persistence = new InMemoryOpportunityPersistence();
    const evidence: EvidenceRecord = {
      id: 'evidence-1',
      type: 'website',
      title: 'Booking evidence',
      sourceUrl: candidate.websiteUrl,
      observedAt: '2026-09-02T10:00:00.000Z',
      observation: 'The business presents a public transport service.',
      strength: 'moderate',
      supports: ['transport service exists'],
      contradicts: [],
    };
    const research: ResearchAdapter = { research: async () => [evidence] };

    const result = await new ResearchOrchestrator({
      research,
      persistence,
      now: () => '2026-09-02T10:00:00.000Z',
    }).run(SAUDI_UMRAH_NICHE, candidate);

    expect(result.error).toBeUndefined();
    expect(result.researchCase.status).toBe('completed');
    expect(result.researchCase.evidenceRefs).toEqual(['evidence-1']);
    expect(await persistence.getEvidence('evidence-1')).toEqual(evidence);
  });

  it('marks a failed research adapter as blocked', async () => {
    const persistence = new InMemoryOpportunityPersistence();
    const research: ResearchAdapter = {
      research: async () => { throw new Error('provider unavailable'); },
    };

    const result = await new ResearchOrchestrator({ research, persistence }).run(SAUDI_UMRAH_NICHE, candidate);

    expect(result.researchCase.status).toBe('blocked');
    expect(result.error).toBe('provider unavailable');
    expect(result.evidence).toEqual([]);
  });
});
