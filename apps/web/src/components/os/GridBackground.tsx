import { colors } from '@umer/ui';

/** Subtle technical grid, rendered once behind the whole shell. Purely decorative — no data, no animation. */
export function GridBackground() {
  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        backgroundImage: `
          linear-gradient(${colors.border}22 1px, transparent 1px),
          linear-gradient(90deg, ${colors.border}22 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px',
        maskImage: 'radial-gradient(ellipse 80% 60% at 20% 0%, black 40%, transparent 100%)',
        WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 20% 0%, black 40%, transparent 100%)',
      }}
    />
  );
}
