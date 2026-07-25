import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { colors, fonts, radii, spacing } from './theme.js';

export type ButtonVariant = 'primary' | 'secondary' | 'danger';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  children: ReactNode;
};

const variantStyles: Record<ButtonVariant, CSSProperties> = {
  primary: {
    background: colors.accent,
    color: colors.accentText,
    border: `1px solid ${colors.accent}`,
  },
  secondary: {
    background: colors.surfaceRaised,
    color: colors.text,
    border: `1px solid ${colors.borderStrong}`,
  },
  danger: {
    background: 'transparent',
    color: colors.danger,
    border: `1px solid ${colors.danger}`,
  },
};

export function Button({ variant = 'primary', style, children, ...props }: ButtonProps) {
  return (
    <button
      type="button"
      style={{
        padding: `10px ${spacing.md}px`,
        borderRadius: radii.md,
        fontSize: 14,
        fontWeight: 600,
        fontFamily: fonts.sans,
        cursor: props.disabled ? 'not-allowed' : 'pointer',
        opacity: props.disabled ? 0.55 : 1,
        letterSpacing: '-0.01em',
        ...variantStyles[variant],
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  );
}
