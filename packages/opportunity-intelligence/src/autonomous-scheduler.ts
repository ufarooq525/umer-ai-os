import { randomUUID } from 'node:crypto';
import type { OpportunityPersistence } from './persistence.js';
import { OpportunityRunService, type OpportunityRunResult } from './run-service.js';
import { SAUDI_UMRAH_NICHE } from './niche-profiles.js';

export type SchedulerConfig = {
  intervalMs?: number;
  autoStart?: boolean;
  minHoursBetweenRuns?: number;
};

export type AutonomousSchedulerState = {
  running: boolean;
  activeNicheId: string | null;
  currentRunId: string | null;
  lastRunAt: string | null;
  nextScheduledRunAt: string | null;
  totalCyclesCompleted: number;
  lastError: string | null;
};

/**
 * Autonomous Revenue & Opportunity Intelligence Scheduler.
 * Continuously discovers, researches, audits, and generates scored opportunities
 * across active global niches without requiring manual human triggers.
 */
export class OpportunityAutonomousScheduler {
  private timer: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private state: AutonomousSchedulerState = {
    running: false,
    activeNicheId: null,
    currentRunId: null,
    lastRunAt: null,
    nextScheduledRunAt: null,
    totalCyclesCompleted: 0,
    lastError: null,
  };

  constructor(
    private readonly service: OpportunityRunService,
    private readonly persistence: OpportunityPersistence,
    private readonly config: SchedulerConfig = {},
  ) {}

  getStatus(): AutonomousSchedulerState {
    return { ...this.state };
  }

  start(): void {
    if (this.state.running) return;
    this.state.running = true;
    const interval = this.config.intervalMs ?? 300_000; // 5 minutes default
    this.state.nextScheduledRunAt = new Date(Date.now() + 1000).toISOString();

    // Trigger initial tick immediately
    setTimeout(() => {
      void this.tick();
    }, 1000);

    this.timer = setInterval(() => {
      void this.tick();
    }, interval);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.state.running = false;
    this.state.nextScheduledRunAt = null;
  }

  async tick(): Promise<OpportunityRunResult | null> {
    if (this.isProcessing) return null;
    this.isProcessing = true;

    try {
      // 1. Discover target niche
      const niches = await this.persistence.listNiches();
      let targetNiche = niches.find((n) => ['active', 'testing', 'winning'].includes(n.status));

      if (!targetNiche) {
        // Default to Saudi Umrah canonical profile if no niches persisted yet
        targetNiche = SAUDI_UMRAH_NICHE;
        await this.persistence.saveNiche(targetNiche);
      }

      // 2. Check if run is due
      const minHours = this.config.minHoursBetweenRuns ?? 1;
      const latestRun = await this.persistence.getLatestRun(targetNiche.id);
      if (latestRun?.completedAt) {
        const elapsedMs = Date.now() - new Date(latestRun.completedAt).getTime();
        const minMs = minHours * 3600 * 1000;
        if (elapsedMs < minMs && this.state.totalCyclesCompleted > 0) {
          this.isProcessing = false;
          return null;
        }
      }

      // 3. Execute Autonomous Cycle
      const runId = randomUUID();
      this.state.activeNicheId = targetNiche.id;
      this.state.currentRunId = runId;
      this.state.lastError = null;

      const result = await this.service.execute(targetNiche, runId);

      this.state.lastRunAt = new Date().toISOString();
      this.state.totalCyclesCompleted += 1;
      this.state.currentRunId = null;
      this.state.activeNicheId = null;

      return result;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.state.lastError = msg;
      return null;
    } finally {
      this.isProcessing = false;
      const interval = this.config.intervalMs ?? 300_000;
      this.state.nextScheduledRunAt = new Date(Date.now() + interval).toISOString();
    }
  }
}
