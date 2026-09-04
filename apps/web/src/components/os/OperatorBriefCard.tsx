import { Card, colors, fonts } from '@umer/ui';
import type { OperatorBrief } from '@/lib/operator-brief';

const STANCE: Record<OperatorBrief['stance'], { label: string; color: string }> = {
  decide: { label: 'DECIDE FIRST', color: colors.warning },
  call: { label: 'READY TO CALL', color: colors.success },
  wait: { label: 'NOT ENOUGH YET', color: colors.muted },
  pass: { label: 'WALK AWAY', color: colors.danger },
};

export function OperatorBriefCard({ brief }: { brief: OperatorBrief }) {
  const meta = STANCE[brief.stance];
  return (
    <Card title="Operator memo">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span
          style={{
            fontFamily: fonts.mono,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: meta.color,
          }}
        >
          {meta.label}
        </span>
        {brief.researchedAt ? (
          <span style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.muted }}>
            last researched {new Date(brief.researchedAt).toLocaleString()}
          </span>
        ) : null}
      </div>
      <p style={{ margin: '0 0 14px', fontSize: 15, lineHeight: 1.55 }}>{brief.verdict}</p>
      <MemoList title="On the record" items={brief.seen} tone={colors.text} />
      <MemoList title="Still missing" items={brief.missing} tone={colors.warning} />
      <div style={{ marginTop: 12, fontSize: 13, lineHeight: 1.5 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.muted, marginBottom: 4 }}>
          Do next
        </div>
        {brief.doNext}
      </div>
      <MemoList title="A seasoned closer does not" items={brief.doNot} tone={colors.muted} />
    </Card>
  );
}

function MemoList({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  if (items.length === 0) return null;
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.muted, marginBottom: 6 }}>
        {title}
      </div>
      <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>
        {items.map((item) => (
          <li key={item} style={{ fontSize: 13, color: tone, lineHeight: 1.45 }}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
