import { randomUUID } from 'node:crypto';
import type { EvidenceRecord, NicheDefinition } from '@umer/contracts';
import type { BusinessCandidate } from '@umer/opportunity-intelligence';
import {
  CompositeDiscoveryAdapter,
  createMySqlOpportunityPersistence,
  DefaultOpportunityBuilder,
  EvidenceBasedProblemDetector,
  EvidenceResearchAdapter,
  GooglePlacesDiscoverySource,
  OpportunityRunService,
  SAUDI_UMRAH_NICHE,
  SourceDiscoveryProvider,
  StaticDiscoverySource,
  StaticEvidenceSource,
  WebsiteEvidenceSource,
} from '@umer/opportunity-intelligence';

export type OpportunityEvent = { at: string; agent: string; message: string; stage?: string; level?: string };
export type OpportunityAgent = { name: string; status: 'IDLE' | 'RUNNING' | 'COMPLETED' | 'FAILED'; task: string };
export type OpportunityMetrics = {
  businessesDiscovered: number;
  businessesResearched: number;
  problemsDetected: number;
  opportunitiesFound: number;
  highValueOpportunities: number;
  estimatedPipeline: number;
};
export type OpportunityRunStatus = {
  running: boolean;
  mode: 'LIVE_GOOGLE_PLACES' | 'DETERMINISTIC_FALLBACK';
  runId: string | null;
  stage: string;
  progress: number;
  completedStages: string[];
  metrics: OpportunityMetrics;
  agents: OpportunityAgent[];
  events: OpportunityEvent[];
  error: string | null;
};

const state: OpportunityRunStatus = {
  running: false,
  mode: process.env.GOOGLE_MAPS_API_KEY ? 'LIVE_GOOGLE_PLACES' : 'DETERMINISTIC_FALLBACK',
  runId: null,
  stage: 'Idle',
  progress: 0,
  completedStages: [],
  metrics: { businessesDiscovered: 0, businessesResearched: 0, problemsDetected: 0, opportunitiesFound: 0, highValueOpportunities: 0, estimatedPipeline: 0 },
  agents: [
    { name: 'Discovery Agent', status: 'IDLE', task: 'Waiting for a run' },
    { name: 'Research Agent', status: 'IDLE', task: 'Waiting for discovery' },
    { name: 'Opportunity Agent', status: 'IDLE', task: 'Waiting for research' },
  ],
  events: [],
  error: null,
};

function event(agent: string, message: string, stage?: string, level?: string) {
  state.events.push({ at: new Date().toISOString(), agent, message, stage, level });
  state.events = state.events.slice(-100);
}

const candidates: BusinessCandidate[] = [
  { externalId: 'demo-makkah-1', name: 'Al-Haramain VIP Transport', website: 'https://al-haramain-transport.example', geography: 'Makkah', industry: 'transportation provider', sourceRefs: ['local-e2e'], discoveredAt: new Date().toISOString() },
  { externalId: 'demo-madinah-2', name: 'Rawdah Pilgrim Services', website: 'https://rawdah-pilgrims.example', geography: 'Madinah', industry: 'tour operator', sourceRefs: ['local-e2e'], discoveredAt: new Date().toISOString() },
  { externalId: 'demo-jeddah-3', name: 'Jeddah Executive Umrah Fleet', website: 'https://jeddah-luxury.example', geography: 'Jeddah', industry: 'transportation provider', sourceRefs: ['local-e2e'], discoveredAt: new Date().toISOString() },
  { externalId: 'demo-sa-4', name: 'Saudi Pilgrim Travel', website: 'https://saudi-pilgrim.example', geography: 'Saudi Arabia', industry: 'travel agency', sourceRefs: ['local-e2e'], discoveredAt: new Date().toISOString() },
];

const evidence: EvidenceRecord[] = [
  { id: 'demo-ev-1', type: 'website', title: 'Booking gap', sourceUrl: 'https://al-haramain-transport.example', observedAt: new Date().toISOString(), observation: 'Static website with phone contact only. No online booking, digital payment, or automated follow-up.', strength: 'verified', supports: ['digital presence'], contradicts: [] },
  { id: 'demo-ev-2', type: 'website', title: 'WhatsApp-only inquiries', sourceUrl: 'https://rawdah-pilgrims.example', observedAt: new Date().toISOString(), observation: 'Tour packages require WhatsApp inquiry. No automated booking or CRM workflow.', strength: 'verified', supports: ['digital presence'], contradicts: [] },
  { id: 'demo-ev-3', type: 'website', title: 'Mature digital operation', sourceUrl: 'https://jeddah-luxury.example', observedAt: new Date().toISOString(), observation: 'Online booking, payments, CRM follow-up, contact form and reviews are already present.', strength: 'verified', supports: ['booking', 'payments', 'automation', 'trust'], contradicts: [] },
  { id: 'demo-ev-4', type: 'directory', title: 'Travel listing', sourceUrl: 'https://saudi-pilgrim.example', observedAt: new Date().toISOString(), observation: 'Directory listing with basic contact information and limited digital evidence.', strength: 'moderate', supports: ['digital presence'], contradicts: [] },
];

export function getOpportunityStatus(): OpportunityRunStatus {
  state.mode = process.env.GOOGLE_MAPS_API_KEY ? 'LIVE_GOOGLE_PLACES' : 'DETERMINISTIC_FALLBACK';
  return JSON.parse(JSON.stringify(state)) as OpportunityRunStatus;
}

export function startOpportunityRun(): { runId: string } {
  if (state.running) return { runId: state.runId! };
  const runId = randomUUID();
  const live = Boolean(process.env.GOOGLE_MAPS_API_KEY);
  state.running = true;
  state.mode = live ? 'LIVE_GOOGLE_PLACES' : 'DETERMINISTIC_FALLBACK';
  state.runId = runId;
  state.progress = 5;
  state.stage = 'Discovery';
  state.completedStages = [];
  state.error = null;
  state.events = [];
  state.metrics = { businessesDiscovered: 0, businessesResearched: 0, problemsDetected: 0, opportunitiesFound: 0, highValueOpportunities: 0, estimatedPipeline: 0 };
  state.agents = [
    { name: 'Discovery Agent', status: 'RUNNING', task: live ? 'Scanning Google Places API' : 'Scanning deterministic fixtures' },
    { name: 'Research Agent', status: 'IDLE', task: 'Waiting for discovered businesses' },
    { name: 'Opportunity Agent', status: 'IDLE', task: 'Waiting for research' },
  ];
  event('Orchestrator', `Autonomous opportunity run started (${state.mode})`);
  void execute(runId, live);
  return { runId };
}

async function execute(runId: string, live: boolean) {
  try {
    const discoveryLimit = Math.max(1, Math.min(Number(process.env.OPPORTUNITY_DISCOVERY_LIMIT ?? 20) || 20, 20));
    const niche: NicheDefinition = {
      ...SAUDI_UMRAH_NICHE,
      id: `saudi-umrah-ui-${runId}`,
      name: 'Saudi Umrah Services',
      minimumOpportunityScore: 60,
      targetBusinessesPerRun: discoveryLimit,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const discoverySource = live
      ? new GooglePlacesDiscoverySource()
      : new StaticDiscoverySource(candidates);
    const researchSources = live
      ? [new WebsiteEvidenceSource()]
      : [new StaticEvidenceSource(evidence)];
    const discovery = new CompositeDiscoveryAdapter(new SourceDiscoveryProvider([discoverySource]));
    const research = new EvidenceResearchAdapter(researchSources, niche);

    const service = new OpportunityRunService({
      discovery,
      research,
      problemDetector: new EvidenceBasedProblemDetector(),
      opportunityBuilder: new DefaultOpportunityBuilder(),
      persistence: createMySqlOpportunityPersistence(),
      onEvent: (ev) => {
        event(ev.agentName, ev.message, ev.stage, ev.level);
        if (ev.stage === 'discovery') {
          state.stage = 'Discovery';
          state.progress = 15;
          state.agents[0] = { name: 'Discovery Agent', status: 'RUNNING', task: ev.message };
        } else if (ev.stage === 'deduplication') {
          state.stage = 'Deduplication';
          state.progress = 30;
          if (!state.completedStages.includes('Discovery')) state.completedStages.push('Discovery');
          state.agents[0] = { name: 'Discovery Agent', status: 'COMPLETED', task: 'Discovery completed' };
        } else if (ev.stage === 'research') {
          state.stage = 'Research';
          state.progress = 50;
          if (!state.completedStages.includes('Deduplication')) state.completedStages.push('Deduplication');
          state.agents[1] = { name: 'Research Agent', status: 'RUNNING', task: ev.message };
        } else if (ev.stage === 'audit') {
          state.stage = 'Audit';
          state.progress = 65;
          if (!state.completedStages.includes('Research')) state.completedStages.push('Research');
          state.agents[1] = { name: 'Research Agent', status: 'COMPLETED', task: 'Audit in progress' };
        } else if (ev.stage === 'problems') {
          state.stage = 'Problems';
          state.progress = 78;
          if (!state.completedStages.includes('Audit')) state.completedStages.push('Audit');
        } else if (ev.stage === 'scoring') {
          state.stage = 'Scoring';
          state.progress = 90;
          if (!state.completedStages.includes('Problems')) state.completedStages.push('Problems');
          state.agents[2] = { name: 'Opportunity Agent', status: 'RUNNING', task: ev.message };
        }
      },
    });

    const result = await service.execute(niche, runId);

    state.metrics = {
      businessesDiscovered: result.metrics.businessesDiscovered,
      businessesResearched: result.metrics.businessesResearched,
      problemsDetected: result.metrics.qualifiedBusinesses,
      opportunitiesFound: result.metrics.opportunitiesFound,
      highValueOpportunities: result.metrics.highValueOpportunities,
      estimatedPipeline: result.metrics.estimatedPipeline,
    };

    state.completedStages = ['Discovery', 'Deduplication', 'Research', 'Audit', 'Problems', 'Scoring', 'Opportunities'];
    state.agents[0] = { name: 'Discovery Agent', status: 'COMPLETED', task: `${result.metrics.businessesDiscovered} found` };
    state.agents[1] = { name: 'Research Agent', status: 'COMPLETED', task: `${result.metrics.businessesResearched} researched` };
    state.agents[2] = { name: 'Opportunity Agent', status: 'COMPLETED', task: `${result.metrics.opportunitiesFound} scored` };
    state.running = false;
    state.progress = 100;
    state.stage = 'Completed';
  } catch (err) {
    state.running = false;
    state.stage = 'Failed';
    state.error = err instanceof Error ? err.message : String(err);
    for (const agent of state.agents) {
      if (agent.status === 'RUNNING') agent.status = 'FAILED';
    }
    event('Orchestrator', `Run failed: ${state.error}`, 'error', 'error');
  }
}
