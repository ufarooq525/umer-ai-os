'use client';

import { Children, useState, type ReactNode } from 'react';
import { Pager, paginate } from './Pager';

export function PagedChildren({
  children,
  pageSize = 12,
  minItemWidth = 0,
}: {
  children: ReactNode;
  pageSize?: number;
  minItemWidth?: number;
}) {
  const items = Children.toArray(children);
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const slice = paginate(items, page, pageSize);
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div
        style={
          minItemWidth > 0
            ? { display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${minItemWidth}px, 1fr))`, gap: 12 }
            : { display: 'grid', gap: 10 }
        }
      >
        {slice}
      </div>
      <Pager page={page} pageCount={pageCount} total={items.length} pageSize={pageSize} onPage={setPage} />
    </div>
  );
}
