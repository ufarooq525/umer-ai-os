import Link from 'next/link';
import { Card, colors, fonts, radii } from '@umer/ui';
import type { SeoOwnerBoard as SeoOwnerBoardModel, SeoOwnerSite } from '@/lib/seo-owner';
import type { SeoLiveSignals } from '@/lib/seo-live';
import { liveSeoSentence } from '@/lib/seo-live';
import { StatusBadge } from './StatusBadge';
import type { StatusTone } from './status';

function siteTone(status: SeoOwnerSite['status']): StatusTone {
  if (status === 'needs_approval') return 'waiting';
  if (status === 'url_unknown') return 'blocked';
  return 'idle';
}

function siteLabel(status: SeoOwnerSite['status']): string {
  if (status === 'needs_approval') return 'APPROVE';
  if (status === 'url_unknown') return 'URL UNKNOWN';
  return 'IDLE';
}

export function SeoOwnerBoard({
  board,
  compact = false,
  liveByProjectId = {},
}: {
  board: SeoOwnerBoardModel;
  compact?: boolean;
  liveByProjectId?: Record<string, SeoLiveSignals>;
}) {
  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 12 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.muted, margin: 0 }}>
          SEO — what to do
        </h2>
        {compact ? (
          <Link href="/seo" style={{ fontSize: 12, color: colors.accent, textDecoration: 'none' }}>
            Open board
          </Link>
        ) : null}
      </div>

      <Card>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: colors.muted, lineHeight: 1.5, maxWidth: 720 }}>
          You do not need to know SEO. Approve safe technical fixes, write copy only when asked, and treat traffic as
          unknown until Search Console is connected. No ranking promises.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          <RiskChip label="Safe mechanical — one-click Pass" />
          <RiskChip label="Needs your words" />
          <RiskChip label="Needs Search Console — unknown today" />
        </div>

        {board.sites.length === 0 ? (
          <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>No SEO sites in the project catalog.</p>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {board.sites.map((site) => (
              <SeoSiteRow key={site.projectId} site={site} live={liveByProjectId[site.projectId]} />
            ))}
          </div>
        )}
      </Card>
    </section>
  );
}

function RiskChip({ label }: { label: string }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontFamily: fonts.mono,
        color: colors.muted,
        border: `1px solid ${colors.border}`,
        borderRadius: 999,
        padding: '3px 8px',
      }}
    >
      {label}
    </span>
  );
}

function SeoSiteRow({ site, live }: { site: SeoOwnerSite; live?: SeoLiveSignals }) {
  const href = site.pendingGateWaitId ? `/gates#${site.pendingGateWaitId}` : site.publicUrl ?? '/projects';
  const sentence = live ? `${site.sentence} ${liveSeoSentence(live)}` : site.sentence;
  const external = href.startsWith('http');
  const style = {
    display: 'block',
    padding: 14,
    borderRadius: radii.md,
    border: `1px solid ${site.status === 'needs_approval' ? colors.warning : colors.border}`,
    background: colors.surface,
    textDecoration: 'none',
    color: colors.text,
  } as const;
  const inner = (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 14 }}>{site.name}</strong>
        <StatusBadge tone={siteTone(site.status)} label={siteLabel(site.status)} />
      </div>
      <p style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.5, color: colors.text }}>{sentence}</p>
      <div style={{ marginTop: 8, fontSize: 12, color: colors.muted, fontFamily: fonts.mono }}>
        {site.publicUrl ?? 'public URL unknown'} · {site.traffic.label}
      </div>
    </>
  );
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" style={style}>
        {inner}
      </a>
    );
  }
  return (
    <Link href={href} style={style}>
      {inner}
    </Link>
  );
}
