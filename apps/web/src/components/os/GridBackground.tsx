import { colors } from '@umer/ui';

/** Quiet grid + a single static copper wash. No looping motion. */
export function GridBackground() {
  return (
    <div aria-hidden style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(${colors.border}22 1px, transparent 1px),
            linear-gradient(90deg, ${colors.border}22 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          maskImage: 'radial-gradient(ellipse 85% 70% at 18% 0%, black 35%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 85% 70% at 18% 0%, black 35%, transparent 100%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 520,
          height: 340,
          top: -80,
          left: -40,
          borderRadius: '50%',
          background: colors.accentSoft,
          filter: 'blur(8px)',
          opacity: 0.45,
        }}
      />
    </div>
  );
}
