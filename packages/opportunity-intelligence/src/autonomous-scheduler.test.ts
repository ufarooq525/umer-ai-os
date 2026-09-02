import { describe, expect, it } from 'vitest';
import type { EvidenceRecord } from '@umer/contracts';
import { EvidenceBasedProblemDetector } from './business-audit.js';
import { CompositeDiscoveryAdapter, EvidenceResearchAdapter, StaticDiscoverySource, StaticEvidenceSource, SourceDiscoveryProvider } from './adapters.js';
import { DefaultOpportunityBuilder } from './opportunity-builder.js';
import { InMemoryOpportunityPersistence } from './persistence.js';
import { SAUDI_UMRAH_NICHE } from './niche-profiles.js';
import { OpportunityRunService } from './run-service.js';
import { OpportunityAutonomousScheduler } from './autonomous-scheduler.js';

const candidate = {
  externalId: 'hotel-1',
  name: 'Makkah Royal Pilgrim VIP Services',
  geography: 'Makkah',
  industry: 'transportation',
  website: 'https://makkah-royal.test',
  sourceRefs: ['fixture://discovery/makkah-1'],
};

const evidence: EvidenceRecord[] = [
  {
    id: 'ev-1',
    type: 'website',
    title: 'Makkah Royal Live Scan',
    sourceUrl: 'https://makkah-royal.test',
    observedAt: '2026-09-02T00:00:00.000Z',
    observation: 'Static website with phone number only. No online booking, no card payments, no CRM workflow.',
    strength: 'verified',
    supports: ['digital presence'],
    contradicts: [],
  },
];

describe('OpportunityAutonomousScheduler', () => {
  it('executes an autonomous cycle and records metrics & events', async () => {
    const provider = new SourceDiscoveryProvider([new StaticDiscoverySource([candidate])]);
    const discovery = new CompositeDiscoveryAdapter(provider);
    const research = new EvidenceResearchAdapter([new StaticEvidenceSource(evidence)], SAUDI_UMRAH_NICHE);
    const persistence = new InMemoryOpportunityPersistence();
    const events: string[] = [];

    const service = new OpportunityRunService({
      discovery,
      research,
      problemDetector: new EvidenceBasedProblemDetector(),
      opportunityBuilder: new DefaultOpportunityBuilder(),
      persistence,
      onEvent: (ev) => {
        events.push(`${ev.agentName}: ${ev.message}`);
      },
    });

    const scheduler = new OpportunityAutonomousScheduler(service, persistence, {
      minHoursBetweenRuns: 0,
    });

    const statusBefore = scheduler.getStatus();
    expect(statusBefore.running).toBe(false);
    expect(statusBefore.totalCyclesCompleted).toBe(0);

    const result = await scheduler.tick();
    expect(result).not.toBeNull();
    expect(result?.opportunities.length).toBeGreaterThan(0);
    expect(events.length).toBeGreaterThan(3);

    const statusAfter = scheduler.getStatus();
    expect(statusAfter.totalCyclesCompleted).toBe(1);
    expect(statusAfter.lastRunAt).toBeDefined();

    // Verify persistence contains the run, problems, and events
    const latestRun = await persistence.getLatestRun(SAUDI_UMRAH_NICHE.id);
    expect(latestRun).toBeDefined();
    expect(latestRun?.opportunitiesFound).toBe(result?.opportunities.length);

    const problems = await persistence.listProblems();
    expect(problems.length).toBeGreaterThan(0);

    const runEvents = await persistence.listEvents(result!.runId);
    expect(runEvents.length).toBeGreaterThan(0);
  });
});
