import type { ReactNode } from 'react';
import Link from 'next/link';
import { colors, fonts } from '@umer/ui';
import { Reveal } from './Reveal';

export function DashboardSection({
  title,
  href,
  hint,
  action,
  children,
}: {
  title: string;
  href?: string;
  hint?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const heading = (
    <h2
      style={{
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: colors.muted,
        margin: 0,
      }}
    >
      {title}
    </h2>
  );

  return (
    <section style={{ display: 'grid', gap: 12, minWidth: 0 }}>
      <Reveal>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', paddingLeft: 10 }}>
            <span aria-hidden="true" style={{ position: 'absolute', left: 0, top: 2, bottom: 2, width: 2, borderRadius: 99, background: colors.borderStrong }} />
            {href ? (
              <Link href={href} style={{ textDecoration: 'none' }}>
                {heading}
              </Link>
            ) : (
              heading
            )}
            {hint ? (
              <p style={{ margin: '4px 0 0', color: colors.muted, fontSize: 12, lineHeight: 1.45, maxWidth: 640, fontFamily: fonts.sans }}>
                {hint}
              </p>
            ) : null}
          </div>
          {action}
        </div>
      </Reveal>
      <Reveal delay={0.04}>
        <div className="os-dashboard-content">{children}</div>
      </Reveal>
      <style>{`
        .os-dashboard-content > * { transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease; }
        .os-dashboard-content > *:hover { transform: translateY(-2px); }
        @media (prefers-reduced-motion: reduce) {
          .os-dashboard-content > * { transition: none; }
          .os-dashboard-content > *:hover { transform: none; }
        }
      `}</style>
    </section>
  );
}

export const dashGrid = {
  twoCol: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
    gap: 16,
  } as const,
  metrics: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: 12,
  } as const,
  cards: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: 12,
  } as const,
};
