'use client';

import { useState } from 'react';
import { Button, Card, colors, fonts, radii } from '@umer/ui';
import type { SendProposal } from '@/lib/send-proposal';

export function SendProposalCard({ proposal }: { proposal: SendProposal }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${proposal.subject}\n\n${proposal.body}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Card title="One-page proposal">
      <p style={{ margin: '0 0 12px', fontSize: 13, color: colors.muted, lineHeight: 1.5 }}>
        Built from the opportunity record only. Nothing is sent until you copy or open mail. No ranking or booking
        percentages.
      </p>
      {proposal.blockers.length > 0 ? (
        <ul style={{ margin: '0 0 12px', paddingLeft: 18, color: colors.warning, fontSize: 12 }}>
          {proposal.blockers.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      ) : null}
      <div style={{ fontSize: 12, color: colors.muted, marginBottom: 8 }}>Subject</div>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>{proposal.subject}</div>
      <pre
        style={{
          margin: 0,
          whiteSpace: 'pre-wrap',
          fontFamily: fonts.sans,
          fontSize: 13,
          lineHeight: 1.55,
          padding: 12,
          borderRadius: radii.md,
          border: `1px solid ${colors.border}`,
          background: colors.bg,
          maxHeight: 320,
          overflow: 'auto',
        }}
      >
        {proposal.body}
      </pre>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
        <Button type="button" onClick={() => void copy()}>
          {copied ? 'Copied' : 'Copy letter'}
        </Button>
        <a href={proposal.mailto} style={{ textDecoration: 'none' }}>
          <Button type="button" variant="secondary">
            {proposal.canSend ? 'Open in email' : 'Open blank email'}
          </Button>
        </a>
      </div>
    </Card>
  );
}
