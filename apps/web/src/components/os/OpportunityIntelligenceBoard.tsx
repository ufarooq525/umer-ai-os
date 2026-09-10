'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Filter } from 'lucide-react';
import { colors, fonts, radii } from '@umer/ui';
import type { OpportunityRecord } from '@/lib/control-api';
import { OpportunityJourney } from './OpportunityJourney';

export function OpportunityIntelligenceBoard({ opportunities }: { opportunities: OpportunityRecord[] }) {
  const [filter, setFilter] = useState<'all' | 'high_value' | 'promising'>('all');

  const filtered = opportunities.filter((o) => {
    if (filter === 'high_value') return (o.estimatedValueMax ?? 0) >= 15000 || (o.score?.overall ?? 0) >= 75;
    if (filter === 'promising') return (o.score?.overall ?? 0) >= 70;
    return true;
  });

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* Controls / Filter Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 14,
          padding: '12px 18px',
          borderRadius: 12,
          background: 'rgba(255, 255, 255, 0.025)',
          border: '1px solid rgba(255, 255, 255, 0.07)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Filter size={14} style={{ color: colors.accent }} />
          <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: colors.muted }}>
            Filter Conviction:
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['all', 'high_value', 'promising'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 6,
                  border: filter === f ? '1px solid rgba(232, 160, 84, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                  background: filter === f ? 'rgba(232, 160, 84, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                  color: filter === f ? colors.accent : colors.muted,
                  fontSize: 12,
                  fontWeight: filter === f ? 700 : 500,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {f.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        <div style={{ fontSize: 12, color: colors.muted, fontFamily: fonts.mono }}>
          Showing {filtered.length} of {opportunities.length} opportunities
        </div>
      </div>

      {/* Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
        {filtered.map((opp) => {
          const score = opp.score?.overall ?? 0;
          const isTopTier = score >= 75 || (opp.estimatedValueMax ?? 0) >= 20000;
          const val = opp.estimatedValueMax ?? 0;
          const evidenceCount = opp.evidenceRefs?.length ?? 0;

          return (
            <div
              key={opp.id}
              style={{
                borderRadius: 16,
                border: isTopTier ? '1px solid rgba(232, 160, 84, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                background: isTopTier
                  ? 'linear-gradient(180deg, rgba(232, 160, 84, 0.07) 0%, rgba(255, 255, 255, 0.015) 100%), #12151e'
                  : 'linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%), #12151e',
                padding: '20px 22px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 16,
                boxShadow: isTopTier ? '0 12px 35px rgba(232, 160, 84, 0.09)' : '0 8px 30px rgba(0, 0, 0, 0.2)',
                position: 'relative',
              }}
            >
              {isTopTier && (
                <div
                  style={{
                    position: 'absolute',
                    top: 12,
                    right: 14,
                    fontSize: 9,
                    fontFamily: fonts.mono,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: 'linear-gradient(90deg, #e8a054 0%, #c07d34 100%)',
                    color: '#1a1208',
                  }}
                >
                  HIGH VALUE
                </div>
              )}

              <div>
                {/* Header: Market & Score */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 10.5, fontFamily: fonts.mono, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: colors.muted }}>
                    {opp.market} · {opp.geography}
                  </span>
                </div>

                <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 10px', color: '#ffffff', letterSpacing: '-0.02em', lineHeight: 1.3 }}>
                  {opp.title}
                </h3>

                {/* Metrics Bar */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, margin: '12px 0' }}>
                  <div style={{ padding: '10px 12px', borderRadius: radii.sm, background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                    <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: colors.muted }}>Estimated Value</div>
                    <div style={{ fontFamily: fonts.mono, fontSize: 16, fontWeight: 700, color: val > 0 ? colors.accent : colors.muted, marginTop: 2 }}>
                      {val > 0 ? `$${val.toLocaleString()}` : 'Unpriced'}
                    </div>
                  </div>

                  <div style={{ padding: '10px 12px', borderRadius: radii.sm, background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                    <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: colors.muted }}>Opportunity Score</div>
                    <div style={{ fontFamily: fonts.mono, fontSize: 16, fontWeight: 700, color: score >= 70 ? colors.success : colors.text, marginTop: 2 }}>
                      {score > 0 ? `${score}/100` : 'Evaluating'}
                    </div>
                  </div>
                </div>

                {/* Evidence & Confidence */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11.5, color: colors.muted, margin: '8px 0' }}>
                  <span>Evidence: <strong style={{ color: colors.text }}>{evidenceCount} signals</strong></span>
                  <span>Confidence: <strong style={{ color: colors.success }}>{opp.score?.evidenceConfidence ?? 80}%</strong></span>
                </div>

                {/* Journey State */}
                <div style={{ marginTop: 12 }}>
                  <OpportunityJourney status={opp.status} />
                </div>
              </div>

              {/* Actions */}
              <div
                style={{
                  borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                  paddingTop: 12,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Link
                  href={`/company/opportunities/${opp.id}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    color: colors.accent,
                    fontSize: 12.5,
                    fontWeight: 700,
                    textDecoration: 'none',
                  }}
                >
                  Inspect Journey <ArrowRight size={13} />
                </Link>

                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <Link
                    href={`/company/graph?opportunityId=${encodeURIComponent(opp.id)}`}
                    title="View in Company Graph"
                    style={{ fontSize: 12, color: colors.muted, textDecoration: 'none' }}
                  >
                    ⬡ Graph
                  </Link>
                  <Link
                    href={`/decisions`}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: colors.text,
                      fontSize: 11.5,
                      fontWeight: 600,
                      textDecoration: 'none',
                    }}
                  >
                    Decide
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
