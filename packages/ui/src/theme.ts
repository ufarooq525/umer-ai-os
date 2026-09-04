export const colors = {
  /** Page wash — cool graphite, not flat black */
  bg: '#0e1016',
  /** Raised panels */
  surface: '#171b24',
  /** Slightly higher panels / inputs */
  surfaceRaised: '#1f2430',
  border: '#2c3342',
  borderStrong: '#4a5368',
  text: '#f4f1ea',
  muted: '#8f98ab',
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
