import { describe, expect, it } from 'vitest';
import {
  formatWatchdogBannerText,
  selectWatchdogBannerFindings,
} from './watchdog-banner.js';

describe('watchdog banner filter', () => {
  it('picks up only gates whose intake source.kind is watchdog', () => {
    const findings = selectWatchdogBannerFindings({
      pendingGates: [
        { waitId: 'w1', gateId: 'gate-qa-school-app', workPackageId: 'wp-intake-1' },
        { waitId: 'w2', gateId: 'gate-qa-school-app', workPackageId: 'wp-intake-2' },
      ],
      intakes: [
        {
          intakeId: 'intake-1',
          trigger: {
            source: {
              kind: 'watchdog',
              cadence: 'nightly',
              watchdogId: 'qa.watchdog',
            },
          },
        },
        {
          intakeId: 'intake-2',
          trigger: {
            source: {
              kind: 'human.intake',
            },
          },
        },
      ],
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]?.gateId).toBe('gate-qa-school-app');
    expect(findings[0]?.cadence).toBe('nightly');
    expect(formatWatchdogBannerText(findings.length)).toBe(
      '1 watchdog finding awaiting review',
    );
  });

  it('returns empty when no watchdog gates are open', () => {
    expect(
      selectWatchdogBannerFindings({
        pendingGates: [
          { waitId: 'w1', gateId: 'gate-qa-school-app', workPackageId: 'wp-intake-1' },
        ],
        intakes: [
          {
            intakeId: 'intake-1',
            trigger: { source: { kind: 'human.intake' } },
          },
        ],
      }),
    ).toEqual([]);
    expect(formatWatchdogBannerText(0)).toBe('');
  });
});
