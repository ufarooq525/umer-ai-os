'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Card, colors, fonts, radii, spacing } from '@umer/ui';

export type WorkGraphBoardItem = {
  workPackageId: string;
  stage: string;
  status: string;
  attempt: number;
};

const stageOrder = ['Requirements', 'Product', 'Architecture', 'UX', 'Implementation', 'QA', 'Security', 'Release', 'Operations'];

function tone(status: string) {
  if (status === 'Accepted') return colors.success;
  if (status === 'Failed' || status === 'Rejected') return colors.danger;
  if (status === 'Running' || status === 'Dispatched') return colors.accent;
  if (status === 'AwaitingReview') return colors.warning;
  return colors.muted;
}

export function WorkGraphBoard({ workPackages }: { workPackages: WorkGraphBoardItem[] }) {
  const reduce = useReducedMotion();
  const present = stageOrder.filter((stage) => workPackages.some((work) => work.stage === stage));
  const stages = present.length > 0 ? present : [...new Set(workPackages.map((work) => work.stage))];

  return (
    <Card>
      {workPackages.length === 0 ? (
        <div style={{ padding: spacing.lg, color: colors.muted, textAlign: 'center' }}>
          No executable work is recorded yet. The graph will appear as real Work Packages enter the delivery pipeline.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(stages.length, 1)}, minmax(150px, 1fr))`, gap: 10, minWidth: Math.max(stages.length, 1) * 150 }}>
            {stages.map((stage, index) => {
              const items = workPackages.filter((work) => work.stage === stage);
              return (
                <motion.div key={stage} initial={reduce ? false : { opacity: 0, x: 12 }} animate={reduce ? undefined : { opacity: 1, x: 0 }} transition={reduce ? undefined : { duration: 0.3, delay: index * 0.04 }} style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.09em', color: colors.muted, fontWeight: 700, marginBottom: 8 }}>{stage}</div>
                  <div style={{ display: 'grid', gap: 7 }}>
                    {items.map((work) => (
                      <div key={work.workPackageId} style={{ border: `1px solid ${colors.border}`, borderRadius: radii.md, background: colors.surface, padding: 10 }}>
                        <div style={{ fontSize: 12, fontWeight: 650, lineHeight: 1.35 }}>{work.workPackageId}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 7, fontFamily: fonts.mono, fontSize: 10 }}>
                          <span style={{ color: tone(work.status) }}>{work.status}</span>
                          <span style={{ color: colors.muted }}>A{work.attempt}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}
