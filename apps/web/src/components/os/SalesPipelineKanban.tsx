'use client';

import { useState } from 'react';
import Link from 'next/link';
import { TrendingUp, Building, ArrowRight } from 'lucide-react';
import { colors, fonts, radii } from '@umer/ui';
import type { OpportunityRecord } from '@/lib/control-api';
import { formatRelativeTime } from './format';
import { EntityDrawer } from './EntityDrawer';
import { OutreachIntelPanel } from './OutreachIntelPanel';

export type PipelineStage =
  | 'Discovery'
  | 'Qualified'
  | 'Contacted'
  | 'Engaged'
  | 'Proposal'
  | 'Negotiation'
  | 'Won'
  | 'Lost';

export const CRM_STAGES: PipelineStage[] = [
  'Discovery',
  'Qualified',
  'Contacted',
  'Engaged',
  'Proposal',
  'Negotiation',
  'Won',
  'Lost',
];

function mapOpportunityToCrmStage(status?: string): PipelineStage {
  if (!status) return 'Discovery';
  const s = status.toLowerCase();
  if (s.includes('won')) return 'Won';
  if (s.includes('lost') || s.includes('rejected')) return 'Lost';
  if (s.includes('negotiat') || s.includes('selected')) return 'Negotiation';
  if (s.includes('proposal') || s.includes('pitch')) return 'Proposal';
  if (s.includes('engaged') || s.includes('meeting') || s.includes('call')) return 'Engaged';
  if (s.includes('contact') || s.includes('outreach') || s.includes('sent')) return 'Contacted';
  if (s.includes('qualif') || s.includes('promising') || s.includes('review')) return 'Qualified';
  return 'Discovery';
}

export function SalesPipelineKanban({ opportunities }: { opportunities: OpportunityRecord[] }) {
  const [selectedOpp, setSelectedOpp] = useState<OpportunityRecord | null>(null);

  // Group opportunities by stage
  const stageGroups: Record<PipelineStage, OpportunityRecord[]> = {
    Discovery: [],
    Qualified: [],
    Contacted: [],
    Engaged: [],
    Proposal: [],
    Negotiation: [],
    Won: [],
    Lost: [],
  };

  for (const opp of opportunities) {
    const stage = mapOpportunityToCrmStage(opp.status);
    stageGroups[stage].push(opp);
  }

  // Calculate total pipeline value
  const totalPipelineValue = opportunities.reduce((acc, o) => {
    const val = typeof o.estimatedValueMax === 'number' ? o.estimatedValueMax : 0;
    return acc + val;
  }, 0);

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* Executive Summary Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          padding: '16px 20px',
          borderRadius: 14,
          background: 'linear-gradient(90deg, rgba(232, 160, 84, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%), #12151e',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: 'rgba(232, 160, 84, 0.15)',
              display: 'grid',
              placeItems: 'center',
              color: colors.accent,
            }}
          >
            <TrendingUp size={18} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 650, color: colors.text }}>
              Live Commercial Pipeline
            </div>
            <div style={{ fontSize: 11.5, color: colors.muted }}>
              {opportunities.length} active opportunities tracked across 8 qualification stages
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: colors.muted }}>
              Total Pipeline Value
            </div>
            <div style={{ fontFamily: fonts.mono, fontSize: 18, fontWeight: 700, color: colors.accent }}>
              ${totalPipelineValue > 0 ? totalPipelineValue.toLocaleString() : '0'}
            </div>
          </div>
          <div style={{ width: 1, height: 28, background: 'rgba(255, 255, 255, 0.08)' }} />
          <div>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: colors.muted }}>
              Active Won
            </div>
            <div style={{ fontFamily: fonts.mono, fontSize: 18, fontWeight: 700, color: colors.success }}>
              {stageGroups.Won.length} Deals
            </div>
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <div
        style={{
          display: 'grid',
          gridAutoFlow: 'column',
          gridAutoColumns: 'minmax(260px, 1fr)',
          gap: 12,
          overflowX: 'auto',
          paddingBottom: 16,
          scrollbarWidth: 'thin',
        }}
      >
        {CRM_STAGES.map((stage) => {
          const items = stageGroups[stage];
          const stageValue = items.reduce((acc, o) => acc + (typeof o.estimatedValueMax === 'number' ? o.estimatedValueMax : 0), 0);

          return (
            <div
              key={stage}
              style={{
                borderRadius: 14,
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                display: 'flex',
                flexDirection: 'column',
                minHeight: 480,
                maxHeight: '72vh',
              }}
            >
              {/* Column Header */}
              <div
                style={{
                  padding: '12px 14px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: colors.text }}>
                    {stage}
                  </div>
                  {stageValue > 0 && (
                    <div style={{ fontFamily: fonts.mono, fontSize: 10.5, color: colors.accent, marginTop: 2 }}>
                      ${stageValue.toLocaleString()}
                    </div>
                  )}
                </div>
                <span
                  style={{
                    fontFamily: fonts.mono,
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 999,
                    background: items.length > 0 ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                    color: items.length > 0 ? colors.text : colors.muted,
                  }}
                >
                  {items.length}
                </span>
              </div>

              {/* Deals in Stage */}
              <div style={{ padding: '10px', display: 'grid', gap: 8, overflowY: 'auto', flex: 1 }}>
                {items.length === 0 ? (
                  <div style={{ padding: '24px 8px', textAlign: 'center', color: colors.muted, fontSize: 11.5 }}>
                    No deals in {stage}
                  </div>
                ) : (
                  items.map((deal) => {
                    const value = typeof deal.estimatedValueMax === 'number' ? deal.estimatedValueMax : 0;
                    const businessName = deal.market || deal.geography || deal.title;
                    const scoreVal = deal.score?.overall;

                    return (
                      <div
                        key={deal.id}
                        onClick={() => setSelectedOpp(deal)}
                        style={{
                          padding: '12px 14px',
                          borderRadius: radii.sm,
                          background: 'rgba(255, 255, 255, 0.035)',
                          border: '1px solid rgba(255, 255, 255, 0.07)',
                          cursor: 'pointer',
                          display: 'grid',
                          gap: 8,
                          transition: 'all 0.12s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = 'rgba(232, 160, 84, 0.35)';
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.055)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.07)';
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.035)';
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 650, color: '#ffffff', lineHeight: 1.3 }}>
                            {deal.title}
                          </span>
                          {scoreVal !== undefined && (
                            <span
                              style={{
                                fontSize: 9.5,
                                fontFamily: fonts.mono,
                                fontWeight: 700,
                                padding: '1px 4px',
                                borderRadius: 3,
                                background: 'rgba(93, 206, 160, 0.15)',
                                color: colors.success,
                                flexShrink: 0,
                              }}
                            >
                              SCORE {scoreVal}
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: colors.muted }}>
                          <Building size={11} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {businessName}
                          </span>
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                            paddingTop: 6,
                            marginTop: 2,
                          }}
                        >
                          <span style={{ fontFamily: fonts.mono, fontSize: 12, fontWeight: 700, color: value > 0 ? colors.accent : colors.muted }}>
                            {value > 0 ? `$${value.toLocaleString()}` : 'Unpriced'}
                          </span>
                          <span style={{ fontSize: 10, color: colors.muted, fontFamily: fonts.mono }}>
                            {formatRelativeTime(deal.updatedAt)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Slide-over inspection drawer for selected deal */}
      <EntityDrawer
        open={!!selectedOpp}
        title={selectedOpp?.title ?? 'Opportunity Deal'}
        subtitle={selectedOpp?.market ? `Market: ${selectedOpp.market}` : 'Commercial Intelligence Deal'}
        onClose={() => setSelectedOpp(null)}
        footer={
          selectedOpp && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Link
                href={`/company/opportunities/${selectedOpp.id}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                  borderRadius: 8,
                  background: colors.accent,
                  color: '#1a1208',
                  fontWeight: 700,
                  fontSize: 12.5,
                  textDecoration: 'none',
                }}
              >
                Open Full Opportunity Journey <ArrowRight size={14} />
              </Link>
              <Link
                href={`/company/graph?opportunityId=${selectedOpp.id}`}
                style={{ fontSize: 12, color: colors.accent, textDecoration: 'none' }}
              >
                Inspect in Graph ⬡
              </Link>
            </div>
          )
        }
      >
        {selectedOpp && (
          <div style={{ display: 'grid', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              <div style={{ padding: 12, borderRadius: radii.sm, background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.07)' }}>
                <div style={{ fontSize: 10, color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Estimated Value</div>
                <div style={{ fontFamily: fonts.mono, fontSize: 18, fontWeight: 700, color: colors.accent, marginTop: 4 }}>
                  ${selectedOpp.estimatedValueMax?.toLocaleString() ?? '—'}
                </div>
              </div>
              <div style={{ padding: 12, borderRadius: radii.sm, background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.07)' }}>
                <div style={{ fontSize: 10, color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Opportunity Score</div>
                <div style={{ fontFamily: fonts.mono, fontSize: 18, fontWeight: 700, color: colors.success, marginTop: 4 }}>
                  {selectedOpp.score?.overall ?? '—'}
                </div>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: colors.accent, letterSpacing: '0.08em', marginBottom: 6 }}>
                Business Problem / Core Scope
              </div>
              <div style={{ fontSize: 13, color: colors.text, lineHeight: 1.6, padding: 12, borderRadius: radii.sm, background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                {selectedOpp.title} · Market: {selectedOpp.market}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: colors.accent, letterSpacing: '0.08em', marginBottom: 6 }}>
                CRM Lifecycle Stage
              </div>
              <div style={{ fontSize: 13, color: colors.text }}>
                Currently in <strong>{mapOpportunityToCrmStage(selectedOpp.status)}</strong>.
              </div>
            </div>

            <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.07)', paddingTop: 16 }}>
              <OutreachIntelPanel opportunityId={selectedOpp.id} />
            </div>
          </div>
        )}
      </EntityDrawer>
    </div>
  );
}
