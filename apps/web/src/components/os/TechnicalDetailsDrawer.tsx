'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { colors, fonts, radii } from '@umer/ui';

export function TechnicalDetailsDrawer({ data, label = 'Technical details' }: { data: Record<string, unknown>; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          background: 'transparent',
          border: 'none',
          color: colors.muted,
          fontSize: 11,
          fontFamily: fonts.mono,
          cursor: 'pointer',
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <span style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s ease', display: 'inline-block' }}>
          ▸
        </span>
        {label}
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{ overflow: 'hidden' }}
          >
            <pre
              style={{
                marginTop: 8,
                padding: 10,
                borderRadius: radii.sm,
                border: `1px solid ${colors.border}`,
                background: colors.bg,
                color: colors.muted,
                fontFamily: fonts.mono,
                fontSize: 11,
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {JSON.stringify(data, null, 2)}
            </pre>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
