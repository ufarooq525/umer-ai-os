import Link from 'next/link';
import { colors, radii } from '@umer/ui';
import {
  formatWatchdogBannerText,
  type WatchdogBannerFinding,
} from '@/lib/watchdog-banner';

/**
 * Single-line Dashboard notice for open watchdog-sourced gates.
 * Renders nothing when empty so the existing layout stays untouched.
 */
export function WatchdogFindingsBanner({
  findings,
}: {
  findings: WatchdogBannerFinding[];
}) {
  if (findings.length === 0) return null;

  const href =
    findings.length === 1
      ? `/gates#${findings[0]!.waitId}`
      : '/gates';

  return (
    <aside
      role="status"
      style={{
        marginBottom: 24,
        padding: '12px 16px',
        border: `1px solid ${colors.borderStrong}`,
        borderRadius: radii.md,
        background: colors.accentSoft,
        color: colors.text,
        fontSize: 14,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <span>
        <strong style={{ fontWeight: 600 }}>{formatWatchdogBannerText(findings.length)}</strong>
        {findings[0]?.gateId ? (
          <span style={{ color: colors.muted }}> · {findings[0].gateId}</span>
        ) : null}
      </span>
      <Link
        href={href}
        style={{
          color: colors.accent,
          textDecoration: 'underline',
          whiteSpace: 'nowrap',
          fontWeight: 600,
        }}
      >
        Review
      </Link>
    </aside>
  );
}
