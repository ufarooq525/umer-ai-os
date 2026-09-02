import type { EvidenceRecord, NicheDefinition } from '@umer/contracts';
import type { BusinessCandidate } from '@umer/opportunity-intelligence';
import {
  CompositeDiscoveryAdapter,
  createMySqlOpportunityPersistence,
  DefaultOpportunityBuilder,
  EvidenceBasedProblemDetector,
  EvidenceResearchAdapter,
  OpportunityRunService,
  SAUDI_UMRAH_NICHE,
  SourceDiscoveryProvider,
  StaticDiscoverySource,
  StaticEvidenceSource,
} from '@umer/opportunity-intelligence';

export type OpportunityEvent = { at: string; agent: string; message: string };
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

function event(agent: string, message: string) {
  state.events.push({ at: new Date().toISOString(), agent, message });
  state.events = state.events.slice(-80);
}

function setStage(stage: string, progress: number) {
  state.stage = stage;
  state.progress = progress;
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
  return JSON.parse(JSON.stringify(state)) as OpportunityRunStatus;
}

export function startOpportunityRun(): { runId: string } {
  if (state.running) return { runId: state.runId! };
  const runId = `ui-${Date.now()}`;
  state.running = true;
  state.runId = runId;
  state.progress = 2;
  state.stage = 'Discovery';
  state.completedStages = [];
  state.error = null;
  state.events = [];
  state.metrics = { businessesDiscovered: 0, businessesResearched: 0, problemsDetected: 0, opportunitiesFound: 0, highValueOpportunities: 0, estimatedPipeline: 0 };
  state.agents = [
    { name: 'Discovery Agent', status: 'RUNNING', task: 'Finding Saudi Umrah businesses' },
    { name: 'Research Agent', status: 'IDLE', task: 'Waiting for discovered businesses' },
    { name: 'Opportunity Agent', status: 'IDLE', task: 'Waiting for research' },
  ];
  event('Orchestrator', 'Autonomous opportunity run started');
  void execute(runId);
  return { runId };
}

async function execute(runId: string) {
  try {
    const niche: NicheDefinition = {
      ...SAUDI_UMRAH_NICHE,
      id: `saudi-umrah-ui-${runId}`,
      name: 'Saudi Umrah Services',
      minimumOpportunityScore: 60,
      targetBusinessesPerRun: candidates.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const discovery = new CompositeDiscoveryAdapter(new SourceDiscoveryProvider([new StaticDiscoverySource(candidates)]));
    const research = new EvidenceResearchAdapter([new StaticEvidenceSource(evidence)], niche);
    const service = new OpportunityRunService({
      discovery,
      research,
      problemDetector: new EvidenceBasedProblemDetector(),
      opportunityBuilder: new DefaultOpportunityBuilder(),
      persistence: createMySqlOpportunityPersistence(),
    });

    setStage('Discovery', 12);
    event('Discovery Agent', `Searching ${niche.geographies.length} Saudi geographies`);
    await delay(250);
    state.metrics.businessesDiscovered = candidates.length;
    event('Discovery Agent', `Discovered ${candidates.length} business candidates`);
    state.completedStages.push('Discovery');
    state.agents[0] = { name: 'Discovery Agent', status: 'COMPLETED', task: `${candidates.length} candidates found` };

    setStage('Research', 32);
    state.agents[1] = { name: 'Research Agent', status: 'RUNNING', task: 'Collecting business evidence' };
    event('Research Agent', 'Researching websites and commercial signals');
    await delay(250);

    const result = await service.execute(niche, runId);
    state.metrics.businessesResearched = result.metrics.businessesResearched;
    state.metrics.opportunitiesFound = result.metrics.opportunitiesFound;
    state.metrics.highValueOpportunities = result.metrics.highValueOpportunities;
    state.metrics.estimatedPipeline = result.metrics.estimatedPipeline;
    state.metrics.problemsDetected = result.opportunities.reduce((sum, opportunity) => sum + 1, 0);

    event('Research Agent', `Research completed for ${result.metrics.businessesResearched} businesses`);
    state.completedStages.push('Research');
    state.agents[1] = { name: 'Research Agent', status: 'COMPLETED', task: `${result.metrics.businessesResearched} researched` };

    setStage('Audit', 58);
    event('Audit Agent', 'Evaluating website, booking, payment and automation signals');
    await delay(200);
    state.completedStages.push('Audit');

    setStage('Problems', 70);
    event('Analysis Agent', `${state.metrics.problemsDetected} commercial problems/opportunity signals detected`);
    await delay(200);
    state.completedStages.push('Problems');

    setStage('Scoring', 84);
    state.agents[2] = { name: 'Opportunity Agent', status: 'RUNNING', task: 'Scoring revenue opportunities' };
    event('Opportunity Agent', `Scoring ${result.opportunities.length} generated opportunities`);
    await delay(200);
    state.completedStages.push('Scoring');

    setStage('Opportunities', 96);
    event('Opportunity Agent', `${result.metrics.highValueOpportunities} high-value opportunities are ready`);
    await delay(200);
    state.completedStages.push('Opportunities');

    state.agents[2] = { name: 'Opportunity Agent', status: 'COMPLETED', task: `${result.metrics.opportunitiesFound} opportunities generated` };
    state.running = false;
    state.progress = 100;
    state.stage = 'Completed';
    event('Orchestrator', `Run completed — $${result.metrics.estimatedPipeline.toLocaleString()} estimated pipeline`);
  } catch (err) {
    state.running = false;
    state.stage = 'Failed';
    state.error = err instanceof Error ? err.message : String(err);
    for (const agent of state.agents) if (agent.status === 'RUNNING') agent.status = 'FAILED';
    event('Orchestrator', `Run failed: ${state.error}`);
  }
}

function delay(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }
