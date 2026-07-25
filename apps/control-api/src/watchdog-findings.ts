import type { BusEventSource } from '@umer/event-bus';
import type { GateWaitRecord } from '@umer/control-plane';
import type { IntakeRecord } from './state.js';

export type WatchdogPendingFinding = {
  waitId: string;
  gateId: string;
  workPackageId: string;
  projectId?: string;
  cadence?: string;
  watchdogId?: string;
  intakeId: string;
};

export function isWatchdogSource(
  source: BusEventSource | undefined,
): source is Extract<BusEventSource, { kind: 'watchdog' }> {
  return source?.kind === 'watchdog';
}

/**
 * Pending gates whose matching intake was published with source.kind === "watchdog".
 * Pure filter — safe to unit-test without UI rendering.
 */
export function filterWatchdogPendingFindings(input: {
  pendingGates: GateWaitRecord[];
  intakes: IntakeRecord[];
}): WatchdogPendingFinding[] {
  const intakeByWorkPackage = new Map<string, IntakeRecord>(
    input.intakes.map((intake) => [`wp-${intake.intakeId}`, intake]),
  );

  const findings: WatchdogPendingFinding[] = [];
  for (const gate of input.pendingGates) {
    if (gate.status !== 'waiting') continue;
    const intake = intakeByWorkPackage.get(gate.workPackageId);
    const source = intake?.trigger?.source;
    if (!isWatchdogSource(source)) continue;
    findings.push({
      waitId: gate.waitId,
      gateId: gate.gateId,
      workPackageId: gate.workPackageId,
      projectId: intake?.plan.projectId,
      cadence: source.cadence,
      watchdogId: source.watchdogId,
      intakeId: intake!.intakeId,
    });
  }
  return findings;
}
