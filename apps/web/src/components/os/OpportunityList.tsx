'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, colors, fonts, radii } from '@umer/ui';
import type { OpportunityRecord } from '@/lib/control-api';
import type { OpportunityDetailModel } from '@/lib/opportunity-detail';
import { OpportunityJourney } from './OpportunityJourney';
import { OpportunityDetailBody } from './OpportunityDetailBody';
import { OverlayDialog } from './OverlayDialog';
import { Pager, paginate } from './Pager';

const PAGE_SIZE = 12;

export function OpportunityList({ opportunities }: { opportunities: OpportunityRecord[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const openId = searchParams.get('open');
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<OpportunityDetailModel | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pageCount = Math.max(1, Math.ceil(opportunities.length / PAGE_SIZE));
  const slice = useMemo(() => paginate(opportunities, page, PAGE_SIZE), [opportunities, page]);

  useEffect(() => {
    if (!openId) {
      setDetail(null);
      setError(null);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    setError(null);
    void fetch(`/api/company/opportunities/${encodeURIComponent(openId)}`, { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error('Could not load this opportunity');
        return r.json() as Promise<OpportunityDetailModel>;
      })
      .then((model) => {
        if (!alive) return;
        setDetail(model);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : 'Load failed');
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [openId]);

  function open(id: string) {
    router.replace(`/company/opportunities?open=${encodeURIComponent(id)}`, { scroll: false });
  }

  function close() {
    router.replace('/company/opportunities', { scroll: false });
  }

  return (
    <>
      <div style={{ display: 'grid', gap: 10 }}>
        {slice.map((opp) => (
          <button
            key={opp.id}
            type="button"
            onClick={() => open(opp.id)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: 16,
              borderRadius: radii.lg,
              border: `1px solid ${openId === opp.id ? colors.accent : colors.border}`,
              background: colors.surface,
              color: colors.text,
              cursor: 'pointer',
              font: 'inherit',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <strong style={{ fontSize: 15 }}>{opp.title}</strong>
                <div style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
                  {opp.geography} · {opp.market}
                  {opp.estimatedValueMin != null ? ` · ${opp.currency ?? 'USD'} ${opp.estimatedValueMin}-${opp.estimatedValueMax}` : ''}
                </div>
              </div>
              {opp.score ? (
                <div style={{ fontFamily: fonts.mono, fontSize: 20, fontWeight: 700, color: colors.accent }}>
                  {opp.score.overall}
                  <span style={{ fontSize: 11, color: colors.muted }}>/100</span>
                </div>
              ) : null}
            </div>
            <div style={{ marginTop: 10 }}>
              <OpportunityJourney status={opp.status} />
            </div>
          </button>
        ))}
      </div>
      <Pager page={page} pageCount={pageCount} total={opportunities.length} pageSize={PAGE_SIZE} onPage={setPage} />

      <OverlayDialog open={Boolean(openId)} title="Opportunity" onClose={close}>
        {loading ? <p style={{ margin: 0, color: colors.muted }}>Loading…</p> : null}
        {error ? <p style={{ margin: 0, color: colors.danger }}>{error}</p> : null}
        {detail ? (
          <>
            <OpportunityDetailBody model={detail} compact />
            <p style={{ margin: '16px 0 0' }}>
              <a href={`/company/opportunities/${detail.opportunity.id}`} style={{ fontSize: 12, color: colors.accent }}>
                Open as a full page
              </a>
            </p>
          </>
        ) : null}
        {!loading && !detail && !error ? (
          <Card>
            <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>Select an opportunity.</p>
          </Card>
        ) : null}
      </OverlayDialog>
    </>
  );
}
