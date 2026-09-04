'use client';

import { colors, fonts, radii } from '@umer/ui';

export function Pager({
  page,
  pageCount,
  total,
  pageSize,
  onPage,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPage: (page: number) => void;
}) {
  if (total <= pageSize) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12, color: colors.muted, fontFamily: fonts.mono }}>
        {start}–{end} of {total}
      </span>
      <div style={{ display: 'flex', gap: 6 }}>
        <PagerButton disabled={page <= 1} onClick={() => onPage(page - 1)} label="Prev" />
        <span style={{ fontSize: 12, color: colors.muted, alignSelf: 'center', fontFamily: fonts.mono }}>
          {page} / {pageCount}
        </span>
        <PagerButton disabled={page >= pageCount} onClick={() => onPage(page + 1)} label="Next" />
      </div>
    </div>
  );
}

function PagerButton({ disabled, onClick, label }: { disabled: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        padding: '6px 12px',
        borderRadius: radii.sm,
        border: `1px solid ${colors.border}`,
        background: disabled ? 'transparent' : colors.surfaceRaised,
        color: disabled ? colors.muted : colors.text,
        cursor: disabled ? 'default' : 'pointer',
        fontSize: 12,
      }}
    >
      {label}
    </button>
  );
}

export function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  return items.slice((page - 1) * pageSize, page * pageSize);
}
