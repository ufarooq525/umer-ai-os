'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { colors, radii } from '@umer/ui';

export function FirstRunGuide() {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('umer.firstRunGuide.dismissed');
      setDismissed(stored === '1');
    }
  }, []);

  const handleDismiss = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('umer.firstRunGuide.dismissed', '1');
      setDismissed(true);
    }
  };

  if (dismissed) {
    return null;
  }

  return (
    <section
      style={{
        padding: '20px 24px',
        borderRadius: 14,
        background: 'linear-gradient(135deg, rgba(232, 160, 84, 0.12) 0%, rgba(232, 160, 84, 0.04) 100%)',
        border: '1px solid rgba(232, 160, 84, 0.3)',
        position: 'relative',
      }}
    >
      <button
        type="button"
        onClick={handleDismiss}
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          width: 28,
          height: 28,
          borderRadius: 7,
          border: '1px solid rgba(255, 255, 255, 0.1)',
          background: 'rgba(0, 0, 0, 0.2)',
          color: colors.muted,
          cursor: 'pointer',
          display: 'grid',
          placeItems: 'center',
        }}
        aria-label="Dismiss guide"
      >
        <X size={14} />
      </button>
      <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: colors.accent }}>
        How to use this system
      </h2>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: colors.text, lineHeight: 1.6 }}>
        Your AI business OS runs on a simple loop:
      </p>
      <ol style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 10, fontSize: 13, lineHeight: 1.6 }}>
        <li>
          <strong>Find leads:</strong> Run{' '}
          <Link href="/markets" style={{ color: colors.accent, textDecoration: 'none', fontWeight: 600 }}>
            discovery for a niche + city
          </Link>{' '}
          (e.g. &quot;Umrah travel agencies in Makkah&quot;)
        </li>
        <li>
          <strong>Review & approve opportunities:</strong> Check{' '}
          <Link href="/company/opportunities" style={{ color: colors.accent, textDecoration: 'none', fontWeight: 600 }}>
            ranked opportunities
          </Link>{' '}
          and approve the ones worth pursuing
        </li>
        <li>
          <strong>Review outreach drafts:</strong> All outreach is{' '}
          <Link href="/sales/proposals" style={{ color: colors.accent, textDecoration: 'none', fontWeight: 600 }}>
            draft-only
          </Link>
          {' '}— you decide when to send
        </li>
        <li>
          <strong>Track deals:</strong> Follow{' '}
          <Link href="/sales" style={{ color: colors.accent, textDecoration: 'none', fontWeight: 600 }}>
            your sales pipeline
          </Link>{' '}
          as leads become customers
        </li>
      </ol>
    </section>
  );
}
