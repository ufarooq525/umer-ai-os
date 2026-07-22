import { getPendingGates } from '@/lib/control-api';
import { GateResolvePanel } from '@/components/GateResolvePanel';

export const dynamic = 'force-dynamic';

export default async function GatesPage() {
  const gates = await getPendingGates();

  return (
    <>
      <header style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 500, margin: 0 }}>Gate approvals</h1>
        <p style={{ marginTop: 8, opacity: 0.8 }}>
          Human-in-the-loop review for stage transitions.
        </p>
      </header>

      {gates.length === 0 ? (
        <p style={{ opacity: 0.7 }}>No pending gate reviews.</p>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {gates.map((gate) => (
            <GateResolvePanel key={gate.waitId} gate={gate} />
          ))}
        </div>
      )}
    </>
  );
}
