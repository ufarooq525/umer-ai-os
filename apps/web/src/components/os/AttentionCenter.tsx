'use client';

import { useState } from 'react';
import { colors } from '@umer/ui';
import type { AttentionCase } from '@/lib/company-derive';
import { AttentionCard } from './AttentionCard';
import { AttentionCaseDetail } from './AttentionCaseDetail';
import { CeoAttentionSummary } from './CeoAttentionSummary';

export function AttentionCenter({ cases }: { cases: AttentionCase[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(cases[0]?.id ?? null);
  const selected = cases.find((c) => c.id === selectedId) ?? null;

  if (cases.length === 0) {
    return <CeoAttentionSummary cases={cases} />;
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <CeoAttentionSummary cases={cases} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
        <div
          style={{
            flex: '1 1 320px',
            maxWidth: 440,
            minWidth: 0,
            display: 'grid',
            gap: 8,
            maxHeight: '70vh',
            overflowY: 'auto',
            paddingRight: 4,
          }}
        >
          {cases.map((c) => (
            <AttentionCard key={c.id} attentionCase={c} active={c.id === selectedId} onSelect={() => setSelectedId(c.id)} />
          ))}
        </div>
        <div style={{ flex: '1 1 380px', maxWidth: 560, minWidth: 0, position: 'sticky', top: 20, maxHeight: '80vh', overflowY: 'auto' }}>
          {selected ? (
            <AttentionCaseDetail attentionCase={selected} />
          ) : (
            <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>Select an item to investigate.</p>
          )}
        </div>
      </div>
    </div>
  );
}
