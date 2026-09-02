'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge, Card, colors, radii } from '@umer/ui';

export type IntelligenceDetails = {
  runId: string;
  nicheId: string | null;
  businesses: Array<{
    id: string;
    name: string;
    websiteUrl?: string;
    phone?: string;
    address?: string;
    geography: string;
    industry?: string;
    business: { id: string; website?: string; lastResearchedAt?: string } | null;
    problems: Array<{ id: string; statement: string; severity: number; frequency: number; financialImpact: number; evidenceConfidence: number; evidenceRefs: string[] }>;
    opportunities: Array<{ id: string; title: string; type: string; score: { overall: number; recommendation: string; problemSeverity: number; demandEvidence: number; abilityToPay: number; reachability: number; solutionFit: number; competitiveGap: number; deliveryFeasibility: number; evidenceConfidence: number }; estimatedValueMin?: number; estimatedValueMax?: number; currency?: string; timeToRevenueDays?: number; evidenceRefs: string[]; status: string }>;
    outreach: Array<{ id: string; channel: string; recipient?: string; subject?: string; body: string; valueProposition: string; status: string }>;
    evidence: Array<{ id: string; type: string; title: string; sourceUrl: string; observation: string; strength: string; excerpt?: string; supports: string[] }>;
  }>;
  problems: Array<{ id: string; businessId: string; statement: string; severity: number; evidenceConfidence: number }>;
  evidence: Array<{ id: string; type: string; title: string; sourceUrl: string; observation: string; strength: string }>;
  opportunities: Array<{ id: string; businessId?: string; title: string; score: { overall: number; recommendation: string }; estimatedValueMin?: number; estimatedValueMax?: number; currency?: string; status: string }>;
  outreach: Array<{ id: string; businessId: string; opportunityId: string; channel: string; body: string; status: string }>;
  events: Array<{ id: string; agentName: string; stage: string; level: string; message: string; occurredAt: string }>;
};

async function loadDetails(runId: string): Promise<IntelligenceDetails> {
  const response = await fetch(`/api/opportunity/details?runId=${encodeURIComponent(runId)}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Details request failed: ${response.status}`);
  return response.json() as Promise<IntelligenceDetails>;
}

const workflow = [
  ['Orchestrator', 'Owns the run, coordinates every agent, records decisions and failures.'],
  ['Discovery Agent', 'Finds candidate businesses across target geographies and sources.'],
  ['Identity Agent', 'Normalizes and deduplicates businesses so the company is not researched twice.'],
  ['Research Agent', 'Visits public sources and collects evidence about the business.'],
  ['Audit Agent', 'Evaluates commercial/digital signals against the niche hypotheses.'],
  ['Analysis Agent', 'Turns evidence into explicit, evidence-backed business problems.'],
  ['Opportunity Agent', 'Scores problems for commercial value, feasibility and outreach readiness.'],
  ['Outreach Agent', 'Creates personalized WhatsApp/email drafts using the evidence and opportunity.'],
];

export function OpportunityIntelligenceDetails({ runId }: { runId: string | null }) {
  const [data, setData] = useState<IntelligenceDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!runId) return;
    let alive = true;
    const refresh = async () => {
      try {
        const next = await loadDetails(runId);
        if (alive) { setData(next); setError(null); }
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : String(err));
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 2000);
    return () => { alive = false; clearInterval(timer); };
  }, [runId]);

  const activeAgents = useMemo(() => {
    const map = new Map<string, IntelligenceDetails['events'][number]>();
    for (const item of data?.events ?? []) map.set(item.agentName, item);
    return workflow.map(([name, description]) => {
      const last = map.get(name);
      return { name, description, last };
    });
  }, [data]);

  if (!runId) return null;

  return (
    <section style={{ display: 'grid', gap: 14, marginTop: 14 }}>
      {error ? <Card title="Intelligence data"><p style={{ color: colors.danger, margin: 0 }}>{error}</p></Card> : null}

      <Card title="CEO view · agent organization">
        <p style={{ color: colors.muted, fontSize: 13, margin: '0 0 14px' }}>
          This is the operational view: every agent has a defined responsibility, and the latest persisted event shows what it last worked on.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 10 }}>
          {activeAgents.map((agent) => (
            <div key={agent.name} style={{ border: `1px solid ${colors.border}`, borderRadius: radii.md, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <strong style={{ fontSize: 13 }}>{agent.name}</strong>
                <Badge tone={agent.last ? (agent.last.level === 'error' ? 'danger' : 'success') : 'default'}>{agent.last ? agent.last.stage.toUpperCase() : 'IDLE'}</Badge>
              </div>
              <p style={{ margin: '6px 0 0', color: colors.muted, fontSize: 12 }}>{agent.description}</p>
              {agent.last ? <p style={{ margin: '8px 0 0', fontSize: 12 }}><strong>Working on:</strong> {agent.last.message}</p> : null}
            </div>
          ))}
        </div>
      </Card>

      <Card title="Complete operating workflow">
        <div style={{ display: 'grid', gap: 0 }}>
          {workflow.map(([name, description], index) => (
            <div key={name} style={{ display: 'grid', gridTemplateColumns: '34px 170px 1fr', gap: 10, padding: '11px 0', borderBottom: index === workflow.length - 1 ? undefined : `1px solid ${colors.border}`, alignItems: 'center' }}>
              <span style={{ color: colors.accent, fontWeight: 700 }}>{index + 1}</span>
              <strong style={{ fontSize: 13 }}>{name}</strong>
              <span style={{ color: colors.muted, fontSize: 12 }}>{description}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card title={`Discovered businesses · ${data?.businesses.length ?? 0}`}>
        {!data?.businesses.length ? <p style={{ color: colors.muted, margin: 0 }}>Waiting for persisted discovery results…</p> : (
          <div style={{ display: 'grid', gap: 10 }}>
            {data.businesses.map((business) => (
              <details key={business.id} style={{ border: `1px solid ${colors.border}`, borderRadius: radii.md, padding: '10px 12px' }}>
                <summary style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span><strong>{business.name}</strong><span style={{ color: colors.muted, marginLeft: 8, fontSize: 12 }}>{business.geography} · {business.industry ?? 'business'}</span></span>
                  <span style={{ color: colors.muted, fontSize: 12 }}>{business.problems.length} problems · {business.opportunities.length} opportunities</span>
                </summary>
                <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
                  <div style={{ fontSize: 12, color: colors.muted }}>
                    <strong style={{ color: colors.text }}>Contact:</strong> {business.phone ?? 'not found'} · {business.address ?? 'address not found'}
                    {business.websiteUrl ? <> · <a href={business.websiteUrl} target="_blank" rel="noreferrer">website</a></> : null}
                  </div>

                  <div><strong style={{ fontSize: 13 }}>Evidence ({business.evidence.length})</strong><div style={{ display: 'grid', gap: 7, marginTop: 7 }}>{business.evidence.map((item) => <div key={item.id} style={{ padding: 9, borderRadius: radii.md, background: colors.surface, border: `1px solid ${colors.border}` }}><div style={{ fontSize: 12 }}><Badge tone="default">{item.strength}</Badge> <strong>{item.title}</strong></div><p style={{ margin: '5px 0', fontSize: 12 }}>{item.observation}</p><a href={item.sourceUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11 }}>{item.sourceUrl}</a></div>)}</div></div>

                  <div><strong style={{ fontSize: 13 }}>Problems ({business.problems.length})</strong><div style={{ display: 'grid', gap: 7, marginTop: 7 }}>{business.problems.map((item) => <div key={item.id} style={{ padding: 9, border: `1px solid ${colors.border}`, borderRadius: radii.md }}><strong style={{ fontSize: 12 }}>{item.statement}</strong><div style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>Severity {item.severity}/100 · Frequency {item.frequency}/100 · Financial impact {item.financialImpact}/100 · Evidence confidence {item.evidenceConfidence}/100</div></div>)}</div></div>

                  <div><strong style={{ fontSize: 13 }}>Opportunities ({business.opportunities.length})</strong><div style={{ display: 'grid', gap: 7, marginTop: 7 }}>{business.opportunities.map((item) => <div key={item.id} style={{ padding: 10, border: `1px solid ${colors.border}`, borderRadius: radii.md }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><strong style={{ fontSize: 12 }}>{item.title}</strong><Badge tone={item.score.overall >= 70 ? 'success' : 'default'}>{item.score.overall}/100 · {item.score.recommendation}</Badge></div><div style={{ color: colors.muted, fontSize: 11, marginTop: 5 }}>Severity {item.score.problemSeverity} · Demand {item.score.demandEvidence} · Ability to pay {item.score.abilityToPay} · Reachability {item.score.reachability} · Fit {item.score.solutionFit} · Competitive gap {item.score.competitiveGap} · Feasibility {item.score.deliveryFeasibility} · Evidence {item.score.evidenceConfidence}</div><div style={{ fontSize: 12, marginTop: 5 }}>Estimated value: {item.currency ?? 'USD'} {item.estimatedValueMin ?? 0}–{item.estimatedValueMax ?? 0}{item.timeToRevenueDays ? ` · ${item.timeToRevenueDays} days to revenue` : ''}</div></div>)}</div></div>

                  {business.outreach.length ? <div><strong style={{ fontSize: 13 }}>Outreach drafts ({business.outreach.length})</strong><div style={{ display: 'grid', gap: 7, marginTop: 7 }}>{business.outreach.map((draft) => <details key={draft.id} style={{ border: `1px solid ${colors.border}`, borderRadius: radii.md, padding: 9 }}><summary style={{ cursor: 'pointer', fontSize: 12 }}><strong>{draft.channel.toUpperCase()}</strong> · {draft.status} {draft.recipient ? `· ${draft.recipient}` : ''}</summary><p style={{ whiteSpace: 'pre-wrap', fontSize: 12, lineHeight: 1.5, marginBottom: 0 }}>{draft.body}</p></details>)}</div></div> : null}
                </div>
              </details>
            ))}
          </div>
        )}
      </Card>

      <Card title={`Agent event log · ${data?.events.length ?? 0} events`}>
        <div style={{ maxHeight: 520, overflow: 'auto', display: 'grid', gap: 0 }}>
          {(data?.events ?? []).slice().reverse().map((item) => (
            <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '78px 125px 95px 1fr', gap: 8, padding: '9px 0', borderBottom: `1px solid ${colors.border}`, fontSize: 11 }}>
              <span style={{ color: colors.muted }}>{new Date(item.occurredAt).toLocaleTimeString()}</span>
              <strong>{item.agentName}</strong>
              <span style={{ color: colors.muted }}>{item.stage}</span>
              <span>{item.message}</span>
            </div>
          ))}
        </div>
      </Card>
    </section>
  );
}
