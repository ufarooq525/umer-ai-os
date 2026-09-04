import { colors } from '@umer/ui';
import { getPendingGates, getProjects } from '@/lib/control-api';
import { deriveSeoOwnerBoard, explainSeoItem } from '@/lib/seo-owner';
import { probePublicSeo, type SeoLiveSignals } from '@/lib/seo-live';
import { SeoOwnerBoard } from '@/components/os/SeoOwnerBoard';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function SeoOwnerPage() {
  const [catalog, gates] = await Promise.all([getProjects(), getPendingGates()]);
  const board = deriveSeoOwnerBoard({ projects: catalog.projects, gates });
  const liveEntries = await Promise.all(
    board.sites.filter((s) => s.publicUrl).map(async (s) => [s.projectId, await probePublicSeo(s.publicUrl!)] as const),
  );
  const liveByProjectId: Record<string, SeoLiveSignals> = Object.fromEntries(liveEntries);

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <header>
        <p style={{ letterSpacing: '0.14em', textTransform: 'uppercase', color: colors.muted, fontSize: 11, fontWeight: 600, margin: 0 }}>
          Owner board
        </p>
        <h1 style={{ fontSize: 'clamp(1.5rem, 2.6vw, 2rem)', fontWeight: 650, margin: '8px 0 0', letterSpacing: '-0.03em' }}>
          SEO
        </h1>
        <p style={{ margin: '8px 0 0', color: colors.muted, fontSize: 14, maxWidth: 680, lineHeight: 1.5 }}>
          Cursive Generator, Flow Tool Works, then your live portfolio at umerfarooqtech.com. Approve safe fixes on
          Gates. Start a new audit from{' '}
          <Link href="/projects" style={{ color: colors.accent }}>
            Codebases
          </Link>
          . Traffic stays unknown until Search Console is connected.
        </p>
      </header>

      <SeoOwnerBoard board={board} liveByProjectId={liveByProjectId} />

      <section>
        <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.muted, margin: '0 0 12px' }}>
          If a specialist mentions this
        </h2>
        <div style={{ display: 'grid', gap: 8 }}>
          {['tech-canonical', 'onpage-meta', 'onpage-title', 'sd-jsonld', 'content-intent', 'perf-lcp'].map((id) => {
            const explained = explainSeoItem(id);
            return (
              <div key={id} style={{ padding: '10px 0', borderBottom: `1px solid ${colors.border}` }}>
                <div style={{ fontSize: 12, color: colors.muted }}>{id.replace(/-/g, ' ')}</div>
                <div style={{ fontSize: 14, marginTop: 2 }}>{explained.owner}</div>
                <div style={{ fontSize: 11, color: colors.muted, marginTop: 4 }}>
                  {explained.risk === 'safe_mechanical'
                    ? 'Safe to approve if the gate offers it'
                    : explained.risk === 'needs_your_words'
                      ? 'Needs your copy — do not auto-apply'
                      : 'Cannot prove this without Search Console / Lighthouse'}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
