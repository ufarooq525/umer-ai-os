import Link from 'next/link';
import { colors, fonts } from '@umer/ui';
import { getGateReview, getPendingGates } from '@/lib/control-api';
import { GateResolvePanel } from '@/components/GateResolvePanel';
import { ShieldCheck, ArrowRight } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function GatesPage() {
  const gates = await getPendingGates().catch(() => []);
  const reviews = await Promise.all(gates.map((gate) => getGateReview(gate.waitId).catch(() => null)));

  return (
    <div style={{ display: 'grid', gap: 24, maxWidth: 1400, margin: '0 auto' }}>
      {/* Executive Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span
              style={{
                fontFamily: fonts.mono,
                fontSize: 11,
                fontWeight: 700,
                color: colors.accent,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              Executive Quality Assurance
            </span>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: '-0.03em', color: colors.text }}>
            Quality Gates & Human Sign-Off {gates.length > 0 ? `(${gates.length})` : ''}
          </h1>
          <p style={{ marginTop: 6, color: colors.muted, fontSize: 13, maxWidth: 720 }}>
            Read deliverables produced by specialists, then approve or reject before code writes, deployments, or public commitments.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <Link
            href="/autonomy"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              fontWeight: 600,
              color: colors.text,
              textDecoration: 'none',
              padding: '8px 14px',
              borderRadius: 8,
              background: 'rgba(255, 255, 255, 0.05)',
              border: `1px solid ${colors.border}`,
            }}
          >
            <span>Autonomy Policies</span>
            <ArrowRight size={13} />
          </Link>
          <Link
            href="/audit"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              fontWeight: 600,
              color: colors.text,
              textDecoration: 'none',
              padding: '8px 14px',
              borderRadius: 8,
              background: 'rgba(255, 255, 255, 0.05)',
              border: `1px solid ${colors.border}`,
            }}
          >
            <span>Audit Trail</span>
            <ArrowRight size={13} />
          </Link>
        </div>
      </div>

      {gates.length === 0 ? (
        <div
          style={{
            background: colors.surface,
            border: `1px dashed ${colors.border}`,
            borderRadius: 14,
            padding: '48px 24px',
            textAlign: 'center',
          }}
        >
          <ShieldCheck size={40} style={{ color: colors.success, margin: '0 auto 12px', opacity: 0.8 }} />
          <h3 style={{ fontSize: 16, fontWeight: 650, color: colors.text, margin: 0 }}>All Quality Gates Cleared</h3>
          <p style={{ fontSize: 13, color: colors.muted, maxWidth: 460, margin: '8px auto 18px' }}>
            There are no pending gate reviews waiting on executive sign-off. All active work packages are either passing automated checks or within autonomous operational bounds.
          </p>
          <Link
            href="/command-center"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              fontWeight: 650,
              color: colors.accent,
              textDecoration: 'none',
              padding: '8px 16px',
              borderRadius: 6,
              background: colors.accentSoft,
              border: `1px solid rgba(255, 255, 255, 0.08)`,
            }}
          >
            Return to Command Center →
          </Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {gates.map((gate, index) => (
            <div key={gate.waitId} id={gate.waitId}>
              <GateResolvePanel gate={gate} review={reviews[index] ?? null} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

