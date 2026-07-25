export const colors = {
  /** Page wash — cool graphite, not flat black */
  bg: '#12141a',
  /** Raised panels */
  surface: '#1c1f28',
  /** Slightly higher panels / inputs */
  surfaceRaised: '#242833',
  border: '#323846',
  borderStrong: '#454d5e',
  text: '#f2f0eb',
  muted: '#9aa3b5',
  /** Copper accent — distinct from default blue SaaS */
  accent: '#e8a054',
  accentSoft: 'rgba(232, 160, 84, 0.14)',
  accentText: '#1a1208',
  success: '#5dcea0',
  warning: '#e8b84a',
  danger: '#f07178',
  focus: '#e8a054',
} as const;

export const fonts = {
  sans: '"Sora", "Segoe UI", system-ui, sans-serif',
  mono: '"IBM Plex Mono", "Consolas", ui-monospace, monospace',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radii = {
  sm: 6,
  md: 10,
  lg: 14,
} as const;
