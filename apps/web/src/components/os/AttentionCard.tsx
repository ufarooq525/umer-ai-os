import Link from 'next/link';
import { motion } from 'framer-motion';
import { colors, fonts, radii, spacing } from '@umer/ui';
import type { AttentionItem, AttentionSeverity } from '@/lib/company-derive';

const SEVERITY_META: Record<AttentionSeverity, { icon: string; label: string; color: string }> = {
  critical: { icon: '🔴', label: 'CRITICAL', color: colors.danger },
  decision: { icon: '🟡', label: 'DECISION REQUIRED', color: colors.warning },
  blocked: { icon: '🟡', label: 'BLOCKED', color: colors.warning },
};

export function AttentionCard({ item }: { item: AttentionItem }) {
  const meta = SEVERITY_META[item.severity];
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Link
        href={item.href}
        style={{
          display: 'block',
          padding: spacing.md,
          borderRadius: radii.lg,
          border: `1px solid ${meta.color}44`,
          background: colors.surface,
          textDecoration: 'none',
          color: colors.text,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontFamily: fonts.mono,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: meta.color,
            marginBottom: 6,
          }}
        >
          <span aria-hidden>{meta.icon}</span>
          {meta.label}
        </div>
        <strong style={{ fontSize: 14 }}>{item.title}</strong>
        <p style={{ margin: '4px 0 8px', fontSize: 12, color: colors.muted, lineHeight: 1.4 }}>{item.detail}</p>
        <span style={{ fontSize: 12, color: colors.accent }}>Review →</span>
      </Link>
    </motion.div>
  );
}
