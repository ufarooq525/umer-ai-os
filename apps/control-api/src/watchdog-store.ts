import type {
  WatchdogFinding,
  WatchRun,
  WatchdogSchedule,
  FindingStatus,
  FindingSeverityTier,
  WatchdogId,
} from '@umer/contracts';

export interface WatchdogStore {
  recordRun(run: WatchRun): void;
  listRuns(filter?: { projectId?: string; watchdogId?: WatchdogId; outcome?: string; limit?: number }): WatchRun[];
  getRun(runId: string): WatchRun | undefined;
  listFindings(filter?: {
    projectId?: string;
    watchdogId?: WatchdogId;
    status?: FindingStatus;
    severityTier?: FindingSeverityTier;
  }): WatchdogFinding[];
  getFinding(findingId: string): WatchdogFinding | undefined;
  getFindingByFingerprint(fingerprint: string): WatchdogFinding | undefined;
  ackFinding(findingId: string, actor: string): WatchdogFinding;
  clearFinding(findingId: string, reason: string, actor: string): WatchdogFinding;
  listSchedules(projectId?: string): WatchdogSchedule[];
  getSchedule(id: string): WatchdogSchedule | undefined;
  addSchedule(schedule: WatchdogSchedule): void;
  updateSchedule(id: string, patch: Partial<WatchdogSchedule>): WatchdogSchedule;
}

export class InMemoryWatchdogStore implements WatchdogStore {
  private runs: WatchRun[] = [];
  private findingsById = new Map<string, WatchdogFinding>();
  private findingsByFingerprint = new Map<string, WatchdogFinding>();
  private schedulesById = new Map<string, WatchdogSchedule>();

  recordRun(run: WatchRun): void {
    this.runs.unshift(run);

    for (const f of run.findings) {
      const existing = this.findingsByFingerprint.get(f.fingerprint);
      if (existing && existing.status !== 'cleared') {
        // Coalesce into existing open/acked finding
        existing.lastSeenAt = f.lastSeenAt;
        existing.severity = f.severity;
        existing.summary = f.summary;
        existing.evidence = f.evidence;
        existing.details = f.details;
      } else {
        this.findingsById.set(f.findingId, { ...f });
        this.findingsByFingerprint.set(f.fingerprint, { ...f });
      }
    }
  }

  listRuns(filter?: { projectId?: string; watchdogId?: WatchdogId; outcome?: string; limit?: number }): WatchRun[] {
    let result = [...this.runs];
    if (filter?.projectId) {
      result = result.filter((r) => r.projectId === filter.projectId);
    }
    if (filter?.watchdogId) {
      result = result.filter((r) => r.watchdogId === filter.watchdogId);
    }
    if (filter?.outcome) {
      result = result.filter((r) => r.outcome === filter.outcome);
    }
    if (filter?.limit && filter.limit > 0) {
      result = result.slice(0, filter.limit);
    }
    return result;
  }

  getRun(runId: string): WatchRun | undefined {
    return this.runs.find((r) => r.runId === runId);
  }

  listFindings(filter?: {
    projectId?: string;
    watchdogId?: WatchdogId;
    status?: FindingStatus;
    severityTier?: FindingSeverityTier;
  }): WatchdogFinding[] {
    let list = Array.from(this.findingsById.values());

    if (filter?.projectId) {
      list = list.filter((f) => f.projectId === filter.projectId);
    }
    if (filter?.watchdogId) {
      list = list.filter((f) => f.watchdogId === filter.watchdogId);
    }
    if (filter?.status) {
      list = list.filter((f) => f.status === filter.status);
    }
    if (filter?.severityTier) {
      list = list.filter((f) => f.severity.tier === filter.severityTier);
    }

    // Sort: critical first, then high, then warning, then info; newest lastSeenAt first
    const tierWeight: Record<FindingSeverityTier, number> = {
      critical: 4,
      high: 3,
      warning: 2,
      info: 1,
    };

    return list.sort((a, b) => {
      const diff = tierWeight[b.severity.tier] - tierWeight[a.severity.tier];
      if (diff !== 0) return diff;
      return new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime();
    });
  }

  getFinding(findingId: string): WatchdogFinding | undefined {
    return this.findingsById.get(findingId);
  }

  getFindingByFingerprint(fingerprint: string): WatchdogFinding | undefined {
    return this.findingsByFingerprint.get(fingerprint);
  }

  ackFinding(findingId: string, actor: string): WatchdogFinding {
    const finding = this.findingsById.get(findingId);
    if (!finding) {
      throw new Error(`Finding not found: ${findingId}`);
    }
    finding.status = 'acked';
    finding.ackedBy = actor;
    finding.ackedAt = new Date().toISOString();
    return finding;
  }

  clearFinding(findingId: string, reason: string, actor: string): WatchdogFinding {
    const finding = this.findingsById.get(findingId);
    if (!finding) {
      throw new Error(`Finding not found: ${findingId}`);
    }
    finding.status = 'cleared';
    finding.clearedBy = actor;
    finding.clearedAt = new Date().toISOString();
    finding.clearanceReason = reason;
    return finding;
  }

  listSchedules(projectId?: string): WatchdogSchedule[] {
    const list = Array.from(this.schedulesById.values());
    if (projectId) {
      return list.filter((s) => s.projectId === projectId);
    }
    return list;
  }

  getSchedule(id: string): WatchdogSchedule | undefined {
    return this.schedulesById.get(id);
  }

  addSchedule(schedule: WatchdogSchedule): void {
    this.schedulesById.set(schedule.id, schedule);
  }

  updateSchedule(id: string, patch: Partial<WatchdogSchedule>): WatchdogSchedule {
    const existing = this.schedulesById.get(id);
    if (!existing) {
      throw new Error(`Watchdog schedule not found: ${id}`);
    }
    const updated = { ...existing, ...patch, id: existing.id };
    this.schedulesById.set(id, updated);
    return updated;
  }
}
