'use client';

import { useMemo, useState } from 'react';
import { colors, fonts } from '@umer/ui';
import type { AttentionCase } from '@/lib/company-derive';
import { AttentionCard } from './AttentionCard';
import { AttentionCaseDetail } from './AttentionCaseDetail';
import { CeoAttentionSummary } from './CeoAttentionSummary';
type PriorityTier = 'ALL' | 'URGENT' | 'IMPORTANT' | 'WAITING' | 'BLOCKED';

function classifyTier(c: AttentionCase): 'URGENT' | 'IMPORTANT' | 'WAITING' | 'BLOCKED' {
  if (c.severity === 'critical' || c.category === 'repeated_failure') return 'URGENT';
  if (c.category === 'waiting_too_long') return 'BLOCKED';
  if (c.severity === 'high' || c.category === 'decision_required') return 'IMPORTANT';
  return 'WAITING';
}


export function AttentionCenter({ cases }: { cases: AttentionCase[] }) {
  const [activeTier, setActiveTier] = useState<PriorityTier>('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(cases[0]?.id ?? null);

  const categorized = useMemo(() => {
    const map: Record<PriorityTier, AttentionCase[]> = {
      ALL: cases,
      URGENT: [],
      IMPORTANT: [],
      WAITING: [],
      BLOCKED: [],
    };
    for (const c of cases) {
      const tier = classifyTier(c);
      map[tier].push(c);
    }
    return map;
  }, [cases]);

  const displayedCases = categorized[activeTier];
  const selected = cases.find((c) => c.id === selectedId) ?? displayedCases[0] ?? null;

  if (cases.length === 0) {
    return <CeoAttentionSummary cases={cases} />;
  }

  const tabs: Array<{ id: PriorityTier; label: string; count: number; color: string }> = [
    { id: 'ALL', label: 'All Items', count: cases.length, color: colors.accent },
    { id: 'URGENT', label: 'Urgent', count: categorized.URGENT.length, color: colors.danger },
    { id: 'IMPORTANT', label: 'Important', count: categorized.IMPORTANT.length, color: colors.warning },
    { id: 'WAITING', label: 'Waiting', count: categorized.WAITING.length, color: '#60a5fa' },
    { id: 'BLOCKED', label: 'Blocked', count: categorized.BLOCKED.length, color: '#f87171' },
  ];

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* Priority Classification Filter Tabs */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          overflowX: 'auto',
          paddingBottom: 4,
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        {tabs.map((tab) => {
          const isActive = activeTier === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTier(tab.id);
                const first = categorized[tab.id][0];
                if (first) setSelectedId(first.id);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                borderRadius: 8,
                border: `1px solid ${isActive ? tab.color : 'transparent'}`,
                background: isActive ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                color: isActive ? colors.text : colors.muted,
                fontFamily: fonts.sans,
                fontSize: 13,
                fontWeight: isActive ? 650 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <span>{tab.label}</span>
              <span
                style={{
                  fontFamily: fonts.mono,
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: 999,
                  background: isActive ? tab.color : 'rgba(255, 255, 255, 0.06)',
                  color: isActive ? '#0d0f14' : colors.muted,
                }}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
        {/* Left column: Case Cards */}
        <div
          style={{
            flex: '1 1 360px',
            maxWidth: 480,
            minWidth: 0,
            display: 'grid',
            gap: 10,
            maxHeight: '75vh',
            overflowY: 'auto',
            paddingRight: 4,
          }}
        >
          {displayedCases.length === 0 ? (
            <div
              style={{
                padding: 32,
                borderRadius: 10,
                border: `1px dashed ${colors.border}`,
                textAlign: 'center',
                color: colors.muted,
                fontSize: 13,
              }}
            >
              No cases currently in the {activeTier.toLowerCase()} priority bucket.
            </div>
          ) : (
            displayedCases.map((c) => (
              <AttentionCard
                key={c.id}
                attentionCase={c}
                active={c.id === (selected?.id ?? selectedId)}
                onSelect={() => setSelectedId(c.id)}
              />
            ))
          )}
        </div>

        {/* Right column: Triage Inspection & Direct Action */}
        <div style={{ flex: '1 1 480px', minWidth: 0, position: 'sticky', top: 20, maxHeight: '82vh', overflowY: 'auto' }}>
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

