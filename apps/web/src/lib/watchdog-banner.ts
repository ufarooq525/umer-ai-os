/**
 * Pure helpers for the Dashboard watchdog banner.
 * Kept free of React so control-api and web can share the filter logic via tests
 * without mounting UI (apps/web has no component test harness today).
 */

export type WatchdogSourceLike = {
  kind?: string;
  cadence?: string;
  watchdogId?: string;
};

export type WatchdogBannerGate = {
  waitId: string;
  gateId: string;
  workPackageId: string;
};

export type WatchdogBannerIntake = {
  intakeId: string;
  trigger?: { source?: WatchdogSourceLike };
};

export type WatchdogBannerFinding = {
  waitId: string;
  gateId: string;
  workPackageId: string;
  cadence?: string;
  watchdogId?: string;
};

export function isWatchdogSourceKind(
  source: WatchdogSourceLike | undefined,
): boolean {
  return source?.kind === 'watchdog';
}

/** Same join/filter the Dashboard banner uses: pending gate + intake source.kind. */
export function selectWatchdogBannerFindings(input: {
  pendingGates: WatchdogBannerGate[];
  intakes: WatchdogBannerIntake[];
}): WatchdogBannerFinding[] {
  const byWp = new Map<string, WatchdogBannerIntake>(
    input.intakes.map((intake) => [`wp-${intake.intakeId}`, intake]),
  );
  const findings: WatchdogBannerFinding[] = [];
  for (const gate of input.pendingGates) {
    const intake = byWp.get(gate.workPackageId);
    const source = intake?.trigger?.source;
    if (!isWatchdogSourceKind(source)) continue;
    findings.push({
      waitId: gate.waitId,
      gateId: gate.gateId,
      workPackageId: gate.workPackageId,
      cadence: source?.cadence,
      watchdogId: source?.watchdogId,
    });
  }
  return findings;
}

export function formatWatchdogBannerText(count: number): string {
  if (count <= 0) return '';
  if (count === 1) return '1 watchdog finding awaiting review';
  return `${count} watchdog findings awaiting review`;
}
