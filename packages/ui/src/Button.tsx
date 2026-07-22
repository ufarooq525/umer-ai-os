import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { colors, spacing } from './theme.js';

export type ButtonVariant = 'primary' | 'secondary' | 'danger';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  children: ReactNode;
};

const variantStyles: Record<ButtonVariant, CSSProperties> = {
  primary: {
    background: colors.accent,
    color: colors.bg,
    border: `1px solid ${colors.accent}`,
  },
  secondary: {
    background: 'transparent',
    color: colors.text,
    border: `1px solid ${colors.border}`,
  },
  danger: {
    background: colors.danger,
    color: '#fff',
    border: `1px solid ${colors.danger}`,
  },
};

export function Button({ variant = 'primary', style, children, ...props }: ButtonProps) {
  return (
    <button
      type="button"
      style={{
        padding: `${spacing.sm}px ${spacing.md}px`,
        borderRadius: 6,
        fontSize: 14,
        fontWeight: 500,
        cursor: props.disabled ? 'not-allowed' : 'pointer',
        opacity: props.disabled ? 0.6 : 1,
        ...variantStyles[variant],
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  );
}
