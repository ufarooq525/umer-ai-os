'use client';

import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { colors, radii } from '@umer/ui';

export function OverlayDialog({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      style={{
        width: 'min(920px, calc(100vw - 32px))',
        maxHeight: 'calc(100vh - 48px)',
        padding: 0,
        border: `1px solid ${colors.borderStrong}`,
        borderRadius: radii.lg,
        background: colors.surface,
        color: colors.text,
        boxShadow: '0 24px 64px rgba(0,0,0,0.45)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          padding: '14px 18px',
          borderBottom: `1px solid ${colors.border}`,
          position: 'sticky',
          top: 0,
          background: colors.surface,
          zIndex: 1,
        }}
      >
        <strong style={{ fontSize: 13, letterSpacing: '0.06em', textTransform: 'uppercase', color: colors.muted }}>
          {title ?? 'Details'}
        </strong>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            border: `1px solid ${colors.border}`,
            background: 'transparent',
            color: colors.text,
            borderRadius: radii.sm,
            padding: '4px 10px',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          Close
        </button>
      </div>
      <div style={{ padding: 20, overflow: 'auto', maxHeight: 'calc(100vh - 120px)' }}>{children}</div>
      <style>{`dialog::backdrop { background: rgba(8, 9, 12, 0.72); }`}</style>
    </dialog>
  );
}
