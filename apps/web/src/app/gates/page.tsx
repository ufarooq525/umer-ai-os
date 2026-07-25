import { colors } from '@umer/ui';
import { getGateReview, getPendingGates } from '@/lib/control-api';
import { GateResolvePanel } from '@/components/GateResolvePanel';

export const dynamic = 'force-dynamic';

export default async function GatesPage() {
  const gates = await getPendingGates();
  const reviews = await Promise.all(gates.map((gate) => getGateReview(gate.waitId)));

  return (
    <>
      <header style={{ marginBottom: 28 }}>
        <p
          style={{
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: colors.muted,
            fontSize: 11,
            fontWeight: 600,
            margin: 0,
          }}
        >
          Your desk
        </p>
        <h1
          style={{
            fontSize: 'clamp(1.75rem, 3vw, 2.25rem)',
            fontWeight: 650,
            margin: '8px 0 0',
            letterSpacing: '-0.03em',
          }}
        >
          Review &amp; approve
        </h1>
        <p style={{ marginTop: 8, color: colors.muted, fontSize: 14 }}>
          Read what the team produced, then approve or reject. Approving a code gate writes
          files into the project; pushing to git is still yours.
        </p>
      </header>

      {gates.length === 0 ? (
        <p style={{ color: colors.muted }}>Nothing waiting on you.</p>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {gates.map((gate, index) => (
            <GateResolvePanel key={gate.waitId} gate={gate} review={reviews[index] ?? null} />
          ))}
        </div>
      )}
    </>
  );
}
