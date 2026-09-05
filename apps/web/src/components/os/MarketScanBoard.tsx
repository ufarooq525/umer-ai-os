'use client';

import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import { Badge, Button, Card, colors, fonts, radii } from '@umer/ui';
import { MARKET_PRESETS, type MarketPreset, type MarketScanResult } from '@/lib/market-scan';
import { Pager, paginate } from './Pager';

export function MarketScanBoard({ variant = 'full' }: { variant?: 'full' | 'compact' }) {
  const pageSize = variant === 'compact' ? 4 : 8;
  const [results, setResults] = useState<MarketScanResult[]>([]);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState<'scan' | 'hunt' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [customQuery, setCustomQuery] = useState('');
  const [customCity, setCustomCity] = useState('');
  const [customRegion, setCustomRegion] = useState<'SA' | 'PK'>('PK');

  const ranked = useMemo(() => results.filter((row) => !row.skipReason), [results]);
  const skipped = useMemo(() => results.filter((row) => row.skipReason), [results]);
  const visible = paginate(ranked, page, pageSize);
  const pageCount = Math.max(1, Math.ceil(ranked.length / pageSize));
  const mode = results[0]?.mode;

  async function scan(markets?: MarketPreset[]) {
    setBusy('scan');
    setError(null);
    setNote(null);
    try {
      const response = await fetch('/api/market-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(markets ? { markets } : {}),
      });
      const payload = (await response.json()) as { results?: MarketScanResult[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? `Scan failed (${response.status})`);
      setResults(payload.results ?? []);
      setPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setBusy(null);
    }
  }

  async function hunt(market: MarketPreset) {
    setBusy('hunt');
    setError(null);
    setNote(null);
    try {
      const response = await fetch('/api/opportunity/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ market }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? `Hunt failed (${response.status})`);
      setNote(`Hunting ${market.label} in ${market.geography}. Open Opportunities when the run finishes.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hunt failed');
    } finally {
      setBusy(null);
    }
  }

  function scanCustom() {
    void scan([
      {
        id: `custom-${customQuery}-${customCity}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        label: `${customQuery.trim()} · ${customCity.trim()}`,
        query: customQuery.trim(),
        geography: customCity.trim(),
        regionCode: customRegion,
      },
    ]);
  }

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: colors.muted }}>
            Market scan
          </div>
          <h2 style={{ margin: '6px 0 0', fontSize: variant === 'compact' ? 20 : 24, letterSpacing: '-0.03em' }}>
            Where listings exist and official sites do not
          </h2>
          <p style={{ margin: '8px 0 0', color: colors.muted, fontSize: 13, lineHeight: 1.5, maxWidth: 620 }}>
            Rank a city only from Google listings we can read. Vacuum means the listing has no official website. Thin markets
            (under five listings) are skipped — that is not “few solutions exist.”
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {variant === 'compact' ? (
            <Link href="/markets" style={{ alignSelf: 'center', fontSize: 13, color: colors.accent, textDecoration: 'none' }}>
              Open full board →
            </Link>
          ) : null}
          <Button onClick={() => void scan()} disabled={busy !== null}>
            {busy === 'scan' ? 'Reading listings…' : 'Scan preset markets'}
          </Button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 18 }}>
        {MARKET_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            disabled={busy !== null}
            onClick={() => void scan([preset])}
            style={{
              padding: '8px 12px',
              borderRadius: 999,
              border: `1px solid ${colors.border}`,
              background: colors.surfaceRaised,
              color: colors.text,
              fontSize: 12,
              cursor: busy ? 'default' : 'pointer',
            }}
          >
            {preset.label} · {preset.geography}
          </button>
        ))}
      </div>

      {variant === 'full' ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 10,
            marginTop: 16,
          }}
        >
          <Field label="Query">
            <input value={customQuery} onChange={(e) => setCustomQuery(e.target.value)} placeholder="ticket office" style={inputStyle} />
          </Field>
          <Field label="City">
            <input value={customCity} onChange={(e) => setCustomCity(e.target.value)} placeholder="Karachi" style={inputStyle} />
          </Field>
          <Field label="Region">
            <select value={customRegion} onChange={(e) => setCustomRegion(e.target.value === 'PK' ? 'PK' : 'SA')} style={inputStyle}>
              <option value="PK">Pakistan</option>
              <option value="SA">Saudi Arabia</option>
            </select>
          </Field>
          <div style={{ display: 'flex', alignItems: 'end' }}>
            <Button
              variant="secondary"
              onClick={scanCustom}
              disabled={busy !== null || !customQuery.trim() || !customCity.trim()}
            >
              Scan this city
            </Button>
          </div>
        </div>
      ) : (
        <details style={{ marginTop: 14 }}>
          <summary style={{ cursor: 'pointer', color: colors.muted, fontSize: 12 }}>Scan a city that is not in the presets</summary>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginTop: 12 }}>
            <input value={customQuery} onChange={(e) => setCustomQuery(e.target.value)} placeholder="travel agency" style={inputStyle} />
            <input value={customCity} onChange={(e) => setCustomCity(e.target.value)} placeholder="Lahore" style={inputStyle} />
            <select value={customRegion} onChange={(e) => setCustomRegion(e.target.value === 'PK' ? 'PK' : 'SA')} style={inputStyle}>
              <option value="PK">Pakistan</option>
              <option value="SA">Saudi Arabia</option>
            </select>
            <Button variant="secondary" onClick={scanCustom} disabled={busy !== null || !customQuery.trim() || !customCity.trim()}>
              Scan
            </Button>
          </div>
        </details>
      )}

      {mode === 'LOCAL_FALLBACK' ? (
        <p style={{ margin: '14px 0 0', fontSize: 12, color: colors.warning, lineHeight: 1.45 }}>
          No Maps key on this machine. Numbers below are local fixtures so you can learn the board — they are not a live market.
        </p>
      ) : null}

      {error ? <p style={{ margin: '14px 0 0', color: colors.danger, fontSize: 13 }}>{error}</p> : null}
      {note ? <p style={{ margin: '14px 0 0', color: colors.success, fontSize: 13 }}>{note}</p> : null}

      {results.length === 0 ? (
        <p style={{ margin: '18px 0 0', color: colors.muted, fontSize: 13 }}>
          Scan to rank cities. Then hunt operators in one approved market.
        </p>
      ) : (
        <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
          {visible.map((row, index) => {
            const rank = (page - 1) * pageSize + index + 1;
            return (
              <article
                key={`${row.id}-${row.geography}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) auto',
                  gap: 12,
                  alignItems: 'center',
                  padding: '14px 16px',
                  borderRadius: radii.md,
                  border: `1px solid ${colors.border}`,
                  background: colors.surfaceRaised,
                }}
              >
                <div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.accent }}>#{rank}</span>
                    <strong style={{ fontSize: 15 }}>{row.label}</strong>
                    <span style={{ color: colors.muted, fontSize: 13 }}>{row.geography}</span>
                    <Badge tone={row.vacuumPct >= 60 ? 'warning' : 'default'}>{row.vacuumPct}% vacuum</Badge>
                  </div>
                  <p style={{ margin: '6px 0 0', fontSize: 12, color: colors.muted, fontFamily: fonts.mono }}>
                    {row.listings} listings · {row.withoutWebsite} without a site · review mass {row.reviewMass} · score {row.rankScore}
                  </p>
                  {row.sampleNames.length ? (
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: colors.muted }}>e.g. {row.sampleNames.join(', ')}</p>
                  ) : null}
                </div>
                <Button onClick={() => void hunt(row)} disabled={busy !== null}>
                  {busy === 'hunt' ? 'Starting…' : 'Hunt operators'}
                </Button>
              </article>
            );
          })}
          <Pager page={page} pageCount={pageCount} total={ranked.length} pageSize={pageSize} onPage={setPage} />
          {skipped.length ? (
            <p style={{ margin: 0, fontSize: 12, color: colors.muted }}>
              Skipped as too thin: {skipped.map((row) => `${row.label} (${row.listings})`).join(' · ')}
            </p>
          ) : null}
        </div>
      )}
    </Card>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.muted }}>
        {label}
      </span>
      {children}
    </label>
  );
}

const inputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  borderRadius: radii.sm,
  border: `1px solid ${colors.border}`,
  background: colors.bg,
  color: colors.text,
  fontFamily: fonts.sans,
  fontSize: 14,
};
