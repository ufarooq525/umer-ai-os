import { randomUUID } from 'node:crypto';
import type { EvidenceRecord, NicheDefinition } from '@umer/contracts';
import type { BusinessCandidate, EvidenceSource } from '@umer/opportunity-intelligence';
import { createRedisClient } from '@umer/db';
import { persistWorkforceState } from './workforce-runtime';
import { claimNextKernelTask, completeKernelTask, createKernelTask, recoverExpiredKernelTasks } from './ai-kernel-runtime';
import {
  CompositeDiscoveryAdapter,
  createMySqlOpportunityPersistence,
  DailySearchBudget,
  DefaultOpportunityBuilder,
  EvidenceBasedProblemDetector,
  EvidenceResearchAdapter,
  GooglePlacesDiscoverySource,
  OpportunityRunService,
  SocialSearchEvidenceSource,
  SourceDiscoveryProvider,
  StaticDiscoverySource,
  StaticEvidenceSource,
  WebsiteEvidenceSource,
} from '@umer/opportunity-intelligence';
import { MARKET_PRESETS, normalizeMarket, type MarketPreset } from './market-scan';

/**
 * Social-search fallback is entirely optional: it only activates once
 * GOOGLE_CSE_API_KEY and GOOGLE_CSE_CX are set. Until then
 * SocialSearchEvidenceSource silently no-ops, so this function is always
 * safe to call. GOOGLE_CSE_DAILY_CAP overrides the default 60/day budget —
 * see DailySearchBudget's guardrail comment before raising it.
 */
function buildResearchSources(): EvidenceSource[] {
  const sources: EvidenceSource[] = [new WebsiteEvidenceSource()];
  if (process.env.GOOGLE_CSE_API_KEY && process.env.GOOGLE_CSE_CX) {
    const cap = Number(process.env.GOOGLE_CSE_DAILY_CAP ?? 60);
    const budget = new DailySearchBudget(createRedisClient(), cap);
    sources.push(new SocialSearchEvidenceSource(undefined, undefined, budget));
  }
  return sources;
}

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
  market: MarketPreset;
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
  market: MARKET_PRESETS[0]!,
};

let activeMarket: MarketPreset = MARKET_PRESETS[0]!;

export function getActiveMarket(): MarketPreset {
  return { ...activeMarket };
}

export function setActiveMarket(input: Parameters<typeof normalizeMarket>[0]): MarketPreset {
  activeMarket = normalizeMarket(input);
  state.market = { ...activeMarket };
  return getActiveMarket();
}

function event(agent: string, message: string, stage?: string, level?: string) {
  state.events.push({ at: new Date().toISOString(), agent, message, stage, level });
  state.events = state.events.slice(-100);
  persistWorkforceState({
    agentName: agent,
    status: 'RUNNING',
    task: message,
    runId: state.runId,
    eventType: 'pipeline_event',
    stage,
    message,
  });
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
  state.market = { ...activeMarket };
  return JSON.parse(JSON.stringify(state)) as OpportunityRunStatus;
}

export function startOpportunityRun(market?: Parameters<typeof normalizeMarket>[0]): { runId: string } {
  if (market) setActiveMarket(market);
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
  event('Orchestrator', `Autonomous opportunity run started (${state.mode}) — ${activeMarket.label} in ${activeMarket.geography}`);
  persistWorkforceState({ agentName: 'Discovery Agent', status: 'RUNNING', task: live ? 'Scanning Google Places API' : 'Scanning deterministic fixtures', runId, eventType: 'assignment', stage: 'discovery', message: 'Discovery assignment started' });
  persistWorkforceState({ agentName: 'Research Agent', status: 'WAITING', task: 'Waiting for discovered businesses', runId, eventType: 'assignment', stage: 'research', message: 'Research agent waiting for discovery output' });
  persistWorkforceState({ agentName: 'Opportunity Agent', status: 'WAITING', task: 'Waiting for research', runId, eventType: 'assignment', stage: 'scoring', message: 'Opportunity agent waiting for research output' });
  void execute(runId, live);
  return { runId };
}

async function execute(runId: string, live: boolean) {
  if (!live && process.env.AUTONOMY_REQUIRE_DURABLE_STATE === 'true') {
    const errorMsg =
      'Market discovery blocked: GOOGLE_MAPS_API_KEY is not configured for live Google Places discovery. Synthetic candidates are prohibited when AUTONOMY_REQUIRE_DURABLE_STATE=true.';
    event('Orchestrator', errorMsg, 'discovery', 'error');
    state.running = false;
    state.error = errorMsg;
    state.stage = 'Blocked';
    return;
  }
  const taskIds: Record<string, string> = {};
  const taskLeases: Record<string, { token: string }> = {};
  try {
    await recoverExpiredKernelTasks();
    taskIds.discovery = await createKernelTask({
      runId, taskType: 'discovery', title: 'Discover businesses for opportunity run',
      instructions: 'Find candidate businesses matching the active niche.', priority: 90,
      requiredCapability: 'discovery', tokenBudget: 4000, costBudget: 0.25,
    });
    taskIds.research = await createKernelTask({
      runId, parentTaskId: taskIds.discovery, taskType: 'research', title: 'Research discovered businesses',
      instructions: 'Collect relevant evidence and identify operational problems.', priority: 80,
      requiredCapability: 'research', tokenBudget: 8000, costBudget: 0.50,
    });
    taskIds.opportunity = await createKernelTask({
      runId, parentTaskId: taskIds.research, taskType: 'opportunity_scoring', title: 'Score validated opportunities',
      instructions: 'Evaluate evidence and produce opportunity candidates with confidence.', priority: 70,
      requiredCapability: 'opportunity', tokenBudget: 6000, costBudget: 0.40,
    });

    const discoveryTask = await claimNextKernelTask('discovery', 'discovery', taskIds.discovery);
    if (!discoveryTask) throw new Error('Discovery worker could not claim its durable task');
    taskLeases.discovery = { token: discoveryTask.leaseToken };

    const discoveryLimit = Math.max(1, Math.min(Number(process.env.OPPORTUNITY_DISCOVERY_LIMIT ?? 20) || 20, 20));
    const now = new Date().toISOString();
    const niche: NicheDefinition = {
      id: `${activeMarket.id}-${runId}`,
      name: activeMarket.query,
      description: `Hunt ${activeMarket.label} in ${activeMarket.geography}. A vacuum is a Maps listing with no official website.`,
      geographies: [activeMarket.geography],
      status: 'testing',
      priority: 'high',
      targetBusinessesPerRun: discoveryLimit,
      minimumOpportunityScore: 60,
      researchDepth: 'standard',
      problemHypotheses: [
        'The listing has no official live website.',
        'Inquiries are handled only by phone or WhatsApp.',
        'No online booking or payment path is visible.',
      ],
      discoverySignals: [],
      allowedSolutionTypes: ['service', 'repeatable_service', 'product'],
      outreachMode: 'draft',
      createdAt: now,
      updatedAt: now,
    };

    const discoverySource = live ? new GooglePlacesDiscoverySource() : new StaticDiscoverySource(candidates);
    const researchSources = live ? buildResearchSources() : [new StaticEvidenceSource(evidence)];
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
          state.stage = 'Discovery'; state.progress = 15;
          state.agents[0] = { name: 'Discovery Agent', status: 'RUNNING', task: ev.message };
        } else if (ev.stage === 'deduplication') {
          state.stage = 'Deduplication'; state.progress = 30;
          if (!state.completedStages.includes('Discovery')) state.completedStages.push('Discovery');
          state.agents[0] = { name: 'Discovery Agent', status: 'COMPLETED', task: 'Discovery completed' };
        } else if (ev.stage === 'research') {
          state.stage = 'Research'; state.progress = 50;
          if (!state.completedStages.includes('Deduplication')) state.completedStages.push('Deduplication');
          state.agents[1] = { name: 'Research Agent', status: 'RUNNING', task: ev.message };
        } else if (ev.stage === 'audit') {
          state.stage = 'Audit'; state.progress = 65;
          if (!state.completedStages.includes('Research')) state.completedStages.push('Research');
          state.agents[1] = { name: 'Research Agent', status: 'COMPLETED', task: 'Audit in progress' };
        } else if (ev.stage === 'problems') {
          state.stage = 'Problems'; state.progress = 78;
          if (!state.completedStages.includes('Audit')) state.completedStages.push('Audit');
        } else if (ev.stage === 'scoring') {
          state.stage = 'Scoring'; state.progress = 90;
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

    await completeKernelTask(taskIds.discovery, 'discovery', taskLeases.discovery.token, { businesses: result.metrics.businessesDiscovered });
    const researchTask = await claimNextKernelTask('research', 'research', taskIds.research);
    if (researchTask) {
      taskLeases.research = { token: researchTask.leaseToken };
      await completeKernelTask(taskIds.research, 'research', taskLeases.research.token, { researched: result.metrics.businessesResearched, qualified: result.metrics.qualifiedBusinesses });
    }
    const opportunityTask = await claimNextKernelTask('opportunity', 'opportunity', taskIds.opportunity);
    if (opportunityTask) {
      taskLeases.opportunity = { token: opportunityTask.leaseToken };
      await completeKernelTask(taskIds.opportunity, 'opportunity', taskLeases.opportunity.token, { opportunities: result.metrics.opportunitiesFound, highValue: result.metrics.highValueOpportunities });
    }

    state.completedStages = ['Discovery', 'Deduplication', 'Research', 'Audit', 'Problems', 'Scoring', 'Opportunities'];
    state.agents[0] = { name: 'Discovery Agent', status: 'COMPLETED', task: `${result.metrics.businessesDiscovered} found` };
    state.agents[1] = { name: 'Research Agent', status: 'COMPLETED', task: `${result.metrics.businessesResearched} researched` };
    state.agents[2] = { name: 'Opportunity Agent', status: 'COMPLETED', task: `${result.metrics.opportunitiesFound} scored` };
    state.running = false; state.progress = 100; state.stage = 'Completed';
    persistWorkforceState({ agentName: 'Discovery Agent', status: 'COMPLETED', task: `${result.metrics.businessesDiscovered} found`, runId, eventType: 'completed', stage: 'discovery', message: `Discovery completed: ${result.metrics.businessesDiscovered} businesses found` });
    persistWorkforceState({ agentName: 'Research Agent', status: 'COMPLETED', task: `${result.metrics.businessesResearched} researched`, runId, eventType: 'completed', stage: 'research', message: `Research completed: ${result.metrics.businessesResearched} businesses researched` });
    persistWorkforceState({ agentName: 'Opportunity Agent', status: 'COMPLETED', task: `${result.metrics.opportunitiesFound} scored`, runId, eventType: 'completed', stage: 'scoring', message: `Opportunity scoring completed: ${result.metrics.opportunitiesFound} opportunities` });
    persistWorkforceState({ agentName: 'Orchestrator', status: 'COMPLETED', task: 'Run completed', runId, eventType: 'completed', stage: 'complete', message: 'Autonomous opportunity run completed' });
  } catch (err) {
    state.running = false;
    state.stage = 'Failed';
    state.error = err instanceof Error ? err.message : String(err);
    for (const agent of state.agents) if (agent.status === 'RUNNING') agent.status = 'FAILED';
    for (const [kind, lease] of Object.entries(taskLeases)) {
      const agentId = kind === 'discovery' ? 'discovery' : kind === 'research' ? 'research' : 'opportunity';
      const taskId = taskIds[kind];
      if (taskId) await completeKernelTask(taskId, agentId, lease.token, null, 'FAILED', state.error).catch(() => undefined);
    }
    event('Orchestrator', `Run failed: ${state.error}`, 'error', 'error');
    persistWorkforceState({ agentName: 'Orchestrator', status: 'FAILED', task: state.error, runId, eventType: 'failed', stage: 'error', message: `Run failed: ${state.error}` });
  }
}
