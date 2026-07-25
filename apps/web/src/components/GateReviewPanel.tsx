'use client';

import { useState, type CSSProperties } from 'react';
import { Badge, colors, fonts, radii } from '@umer/ui';
import type { GateReview, ReviewFileChange } from '@/lib/control-api';

/**
 * "What am I approving?" — shown above the approve/reject controls.
 *
 * For code gates this is the diff review: one card per file, who authored the change,
 * and whether the staged suite actually ran. For audit desks it lists the findings and
 * says plainly that nothing will be written to product code.
 */
export function GateReviewPanel({ review }: { review: GateReview }) {
  return (
    <section style={{ display: 'grid', gap: 14, marginBottom: 18 }}>
      <div style={{ display: 'grid', gap: 6 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Badge tone={review.kind === 'code' ? 'warning' : 'default'}>
            {review.kind === 'code' ? 'Code change' : 'Findings only'}
          </Badge>
          <Badge>{review.requestedType}</Badge>
          <span style={{ fontSize: 13, color: colors.muted }}>{review.projectName}</span>
        </div>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{review.headline}</p>
        <p style={{ margin: 0, fontSize: 13, color: colors.muted }}>{review.onApprove}</p>
      </div>

      <div style={{ fontSize: 13, color: colors.muted }}>
        <strong style={{ color: colors.text, fontWeight: 600 }}>You asked for:</strong>{' '}
        {review.goal}
      </div>

      {review.routing && !review.routing.agreed ? (
        <p
          style={{
            margin: 0,
            padding: '8px 12px',
            borderRadius: radii.sm,
            background: colors.accentSoft,
            border: `1px solid ${colors.borderStrong}`,
            fontSize: 13,
          }}
        >
          {review.routing.note}
        </p>
      ) : null}

      {review.code ? <CodeReview code={review.code} /> : null}
      {review.findings ? <FindingsReview findings={review.findings} /> : null}
    </section>
  );
}

function CodeReview({ code }: { code: NonNullable<GateReview['code']> }) {
  const testTone = code.testsPassed ? 'success' : code.testsRan ? 'danger' : 'warning';
  const testLabel = code.testsPassed
    ? 'Staged tests passed'
    : code.testsRan
      ? 'Staged tests did not all pass'
      : 'No staged test ran';

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Badge tone={code.status === 'ready' ? 'success' : 'danger'}>{code.status}</Badge>
        <Badge tone={testTone}>{testLabel}</Badge>
        <span style={{ fontSize: 13, color: colors.muted }}>
          {code.filesChanged} file(s) · +{code.linesAdded}/−{code.linesRemoved} · authored by{' '}
          <code>{code.author}</code>
        </span>
      </div>

      <p style={{ margin: 0, fontSize: 13, color: colors.text }}>{code.rationale}</p>

      {code.blockers.length > 0 ? (
        <div style={{ display: 'grid', gap: 4 }}>
          <strong style={{ fontSize: 13, color: colors.danger }}>
            Blockers — nothing will be written:
          </strong>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: colors.muted }}>
            {code.blockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {code.files.map((file) => (
        <FileDiff key={file.path} file={file} />
      ))}

      {code.runs.length > 0 ? (
        <div style={{ display: 'grid', gap: 4 }}>
          <strong style={{ fontSize: 13 }}>Staged test runs</strong>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: colors.muted }}>
            {code.runs.map((run) => (
              <li key={`${run.kind}-${run.command}`}>
                <Badge
                  tone={
                    run.outcome === 'passed'
                      ? 'success'
                      : run.outcome === 'failed'
                        ? 'danger'
                        : 'warning'
                  }
                >
                  {run.outcome}
                </Badge>{' '}
                <code>{run.kind}</code> — {run.summary}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function FileDiff({ file }: { file: ReviewFileChange }) {
  const [open, setOpen] = useState(true);

  return (
    <div
      style={{
        border: `1px solid ${colors.border}`,
        borderRadius: radii.md,
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '10px 12px',
          background: colors.surfaceRaised,
          border: 'none',
          color: colors.text,
          font: 'inherit',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ display: 'grid', gap: 2, minWidth: 0 }}>
          <code style={{ fontSize: 13, wordBreak: 'break-all' }}>{file.path}</code>
          <span style={{ fontSize: 12, color: colors.muted }}>{file.note}</span>
        </span>
        <span style={{ fontSize: 12, whiteSpace: 'nowrap', color: colors.muted }}>
          {file.action} · <span style={{ color: colors.success }}>+{file.linesAdded}</span>{' '}
          <span style={{ color: colors.danger }}>−{file.linesRemoved}</span> {open ? '▾' : '▸'}
        </span>
      </button>
      {open ? <pre style={diffStyle}>{renderDiff(file.diff)}</pre> : null}
    </div>
  );
}

function renderDiff(diff: string) {
  if (!diff.trim()) {
    return <span style={{ color: colors.muted }}>No diff recorded for this file.</span>;
  }
  return diff.split(/\r?\n/).map((line, index) => (
    <span
      key={`${index}-${line}`}
      style={{
        display: 'block',
        color: lineColor(line),
        background: lineBackground(line),
      }}
    >
      {line === '' ? ' ' : line}
    </span>
  ));
}

function lineColor(line: string): string {
  if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('diff --git')) {
    return colors.muted;
  }
  if (line.startsWith('@@')) return colors.accent;
  if (line.startsWith('+')) return colors.success;
  if (line.startsWith('-')) return colors.danger;
  return colors.text;
}

function lineBackground(line: string): string {
  if (line.startsWith('+++') || line.startsWith('---')) return 'transparent';
  if (line.startsWith('+')) return 'rgba(93, 206, 160, 0.08)';
  if (line.startsWith('-')) return 'rgba(240, 113, 120, 0.08)';
  return 'transparent';
}

function FindingsReview({ findings }: { findings: NonNullable<GateReview['findings']> }) {
  const counted = Object.entries(findings.counts).filter(([, n]) => n > 0);

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {counted.map(([label, count]) => (
          <Badge key={label} tone={severityTone(label)}>
            {count} {label}
          </Badge>
        ))}
        {findings.runId ? (
          <span style={{ fontSize: 12, color: colors.muted }}>
            run <code>{findings.runId}</code>
          </span>
        ) : null}
      </div>
      <p style={{ margin: 0, fontSize: 13, color: colors.muted }}>{findings.summary}</p>
      <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6, fontSize: 13 }}>
        {findings.items.slice(0, 12).map((item) => (
          <li key={item.id}>
            <strong style={{ fontWeight: 600 }}>{item.title}</strong>{' '}
            <Badge tone={severityTone(item.severity)}>{item.severity}</Badge>
            <span style={{ display: 'block', color: colors.muted }}>{item.detail}</span>
            {item.path ? (
              <code style={{ fontSize: 12, color: colors.muted }}>{item.path}</code>
            ) : null}
          </li>
        ))}
      </ul>
      {findings.items.length > 12 ? (
        <p style={{ margin: 0, fontSize: 12, color: colors.muted }}>
          +{findings.items.length - 12} more in the sealed package after approval.
        </p>
      ) : null}
    </div>
  );
}

function severityTone(severity: string): 'danger' | 'warning' | 'success' | 'default' {
  const s = severity.toLowerCase();
  if (s === 'critical' || s === 'high' || s === 'p0') return 'danger';
  if (s === 'medium' || s === 'p1') return 'warning';
  if (s === 'low' || s === 'p2') return 'default';
  return 'default';
}

const diffStyle: CSSProperties = {
  margin: 0,
  padding: 12,
  background: colors.bg,
  fontSize: 12.5,
  lineHeight: 1.55,
  overflowX: 'auto',
  fontFamily: fonts.mono,
};
