import { Card, Badge, colors, fonts, radii } from '@umer/ui';
import type { CompanyOverview } from '@/lib/control-api';
import { StatusBadge } from './StatusBadge';
import { PulseDot } from './PulseDot';

export function CeoCompanyOperatingConsole({ overview }: { overview: CompanyOverview | null }) {
  if (!overview) {
    return (
      <Card title="CEO Operating Console (Live Record)">
        <div style={{ padding: 18, color: colors.muted, fontSize: 13 }}>
          <p style={{ margin: 0, lineHeight: 1.6 }}>
            Company overview is currently offline or unreachable at <code>/v1/company/overview</code>.
            Verify that <code>control-api</code> is running and that the company loop subsystem is initialized.
          </p>
        </div>
      </Card>
    );
  }

  const {
    whatCompanyIsDoing,
    opportunitiesPursued,
    prospectsThatMatter,
    agentsWorking,
    projectsByAgent,
    evidenceSummary,
    blockedItems,
    decisionsNeeded,
    nextActions,
    revenueAndOutcomes,
    generatedAt,
  } = overview;

  return (
    <section style={{ display: 'grid', gap: 20 }}>
      {/* 1. Header & Live Posture */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Badge tone="success">TRUTHFUL RECORD</Badge>
              <Badge tone="default">ZERO FABRICATION</Badge>
              <span style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.muted }}>
                Synced: {new Date(generatedAt).toLocaleTimeString()}
              </span>
            </div>
            <h2 style={{ fontSize: 'clamp(1.2rem, 2.2vw, 1.6rem)', fontWeight: 650, margin: '0 0 6px', letterSpacing: '-0.03em' }}>
              CEO Executive Operating Console
            </h2>
            <p style={{ margin: 0, color: colors.text, fontSize: 13.5, lineHeight: 1.6, maxWidth: 840 }}>
              {whatCompanyIsDoing.summary}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ padding: '10px 14px', borderRadius: radii.md, background: 'rgba(255,255,255,0.03)', border: `1px solid ${colors.border}`, textAlign: 'center' }}>
              <div style={{ fontFamily: fonts.mono, fontSize: 20, fontWeight: 700, color: colors.accent }}>
                {whatCompanyIsDoing.activeProjectsCount}
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: colors.muted, marginTop: 2 }}>
                Active Projects
              </div>
            </div>
            <div style={{ padding: '10px 14px', borderRadius: radii.md, background: 'rgba(255,255,255,0.03)', border: `1px solid ${colors.border}`, textAlign: 'center' }}>
              <div style={{ fontFamily: fonts.mono, fontSize: 20, fontWeight: 700, color: colors.accent }}>
                {whatCompanyIsDoing.activeWorkPackagesCount}
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: colors.muted, marginTop: 2 }}>
                Work Packages
              </div>
            </div>
            <div style={{ padding: '10px 14px', borderRadius: radii.md, background: 'rgba(255,255,255,0.03)', border: `1px solid ${colors.border}`, textAlign: 'center' }}>
              <div style={{ fontFamily: fonts.mono, fontSize: 20, fontWeight: 700, color: colors.accent }}>
                {whatCompanyIsDoing.activeLoopCyclesCount}
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: colors.muted, marginTop: 2 }}>
                Loop Cycles
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* 2. Top-Level Outcomes (Question 10: What money / outcome is being produced?) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <div style={{ padding: 14, borderRadius: radii.md, background: colors.surface, border: `1px solid ${colors.border}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: colors.muted, letterSpacing: '0.08em' }}>
            Recognized Revenue
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: fonts.mono, color: revenueAndOutcomes.recognizedRevenue > 0 ? colors.accent : colors.text, margin: '6px 0 2px' }}>
            ${revenueAndOutcomes.recognizedRevenue.toLocaleString()}
          </div>
          <div style={{ fontSize: 11, color: colors.muted }}>
            Won: ${revenueAndOutcomes.totalWonRevenue.toLocaleString()} · Pipeline: ${revenueAndOutcomes.pipelineValue.toLocaleString()}
          </div>
        </div>

        <div style={{ padding: 14, borderRadius: radii.md, background: colors.surface, border: `1px solid ${colors.border}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: colors.muted, letterSpacing: '0.08em' }}>
            Margin & Pricing
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: fonts.mono, color: colors.text, margin: '6px 0 2px' }}>
            {revenueAndOutcomes.averageMarginPercent}%
          </div>
          <div style={{ fontSize: 11, color: colors.muted }}>
            Multiplier: {revenueAndOutcomes.recommendedPriceMultiplier}x recommended
          </div>
        </div>

        <div style={{ padding: 14, borderRadius: radii.md, background: colors.surface, border: `1px solid ${colors.border}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: colors.muted, letterSpacing: '0.08em' }}>
            Customer Accounts
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: fonts.mono, color: colors.text, margin: '6px 0 2px' }}>
            {revenueAndOutcomes.activeCustomersCount} Active
          </div>
          <div style={{ fontSize: 11, color: colors.muted }}>
            Avg Health: {revenueAndOutcomes.averageCustomerHealthScore}/100 · Completed Deliveries: {revenueAndOutcomes.completedDeliveriesCount}
          </div>
        </div>

        <div style={{ padding: 14, borderRadius: radii.md, background: colors.surface, border: `1px solid ${colors.border}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: colors.muted, letterSpacing: '0.08em' }}>
            Evidence Engine
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: fonts.mono, color: evidenceSummary.totalSealedArtifacts > 0 ? colors.accent : colors.text, margin: '6px 0 2px' }}>
            {evidenceSummary.totalSealedArtifacts} Sealed
          </div>
          <div style={{ fontSize: 11, color: colors.muted }}>
            {evidenceSummary.testPlanResultsCount} Test Plans · {evidenceSummary.securityReportsCount} Security · {evidenceSummary.signedDeliveryOutcomesCount} Signoffs
          </div>
        </div>
      </div>

      {/* 3. Operational Matrix: Active Agents & Work (Questions 4 & 5) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 16 }}>
        <Card title={`Working Specialists (${agentsWorking.length}) — Question 4 & 5: Who is working and on what?`}>
          {agentsWorking.length === 0 ? (
            <p style={{ margin: 0, color: colors.muted, fontSize: 12.5, lineHeight: 1.6 }}>
              0 active agents currently executing. Specialists only report active status when a live Work Package is dispatched over NATS and being executed by an Agent Worker.
            </p>
          ) : (
            <div style={{ display: 'grid', gap: 10, maxHeight: 420, overflowY: 'auto', paddingRight: 4 }}>
              {agentsWorking.map((ag) => {
                const projLink = ag.currentProjectId ? projectsByAgent[ag.agentId] : undefined;
                return (
                  <div
                    key={ag.agentId}
                    style={{
                      padding: '10px 12px',
                      borderRadius: radii.sm,
                      background: 'rgba(255,255,255,0.02)',
                      border: `1px solid ${colors.border}`,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <PulseDot tone="live" size={6} />
                        <strong style={{ fontSize: 13 }}>{ag.name ?? ag.specialistId}</strong>
                        <Badge tone="default">{ag.department}</Badge>
                      </div>
                      <div style={{ fontSize: 11.5, color: colors.muted, marginTop: 4 }}>
                        {projLink ? (
                          <span>
                            Project: <code style={{ color: colors.text }}>{projLink.projectId}</code>
                            {projLink.taskId ? ` · Task: ${projLink.taskId}` : ''}
                          </span>
                        ) : (
                          <span>Idle / Standing by</span>
                        )}
                      </div>
                    </div>
                    <StatusBadge tone="working" label={ag.status} />
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* 4. Blockers & Decisions (Questions 7 & 8: What is blocked? What needs decision?) */}
        <Card title="Blockers & Required Decisions (Questions 7 & 8)">
          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: colors.muted, marginBottom: 6 }}>
                Blocked Work Items ({blockedItems.length})
              </div>
              {blockedItems.length === 0 ? (
                <div style={{ fontSize: 12, color: colors.muted }}>
                  ✓ No work items are currently in a hard blocked state.
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 6, maxHeight: 240, overflowY: 'auto', paddingRight: 4 }}>
                  {blockedItems.map((b) => (
                    <div
                      key={`${b.type}-${b.id}`}
                      style={{
                        padding: '8px 10px',
                        borderRadius: radii.sm,
                        background: 'rgba(255,80,80,0.06)',
                        border: '1px solid rgba(255,80,80,0.2)',
                        fontSize: 12,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <strong style={{ color: colors.danger }}>{b.id} ({b.type})</strong>
                        <span style={{ color: colors.muted, fontSize: 10 }}>{b.blockedSince}</span>
                      </div>
                      <div style={{ color: colors.text, marginTop: 3 }}>{b.reason}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: colors.muted, marginBottom: 6 }}>
                Decisions Awaiting CEO ({decisionsNeeded.length})
              </div>
              {decisionsNeeded.length === 0 ? (
                <div style={{ fontSize: 12, color: colors.muted }}>
                  ✓ No pending approvals require CEO intervention at this time.
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 6, maxHeight: 240, overflowY: 'auto', paddingRight: 4 }}>
                  {decisionsNeeded.map((d) => (
                    <div
                      key={d.id}
                      style={{
                        padding: '8px 10px',
                        borderRadius: radii.sm,
                        background: 'rgba(255,190,40,0.06)',
                        border: '1px solid rgba(255,190,40,0.25)',
                        fontSize: 12,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <strong>{d.title}</strong>
                        <div style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>
                          Type: {d.type} · Approvers: {d.requiredApprovers.join(', ')}
                        </div>
                      </div>
                      <Badge tone={d.urgency === 'critical' ? 'danger' : 'warning'}>
                        {d.urgency.toUpperCase()}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* 5. Pipeline & Commercial Focus (Questions 2 & 3: Opportunities & Prospects) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 16 }}>
        <Card title="Opportunities Pursued (Question 2)">
          {opportunitiesPursued.length === 0 ? (
            <p style={{ margin: 0, color: colors.muted, fontSize: 12.5 }}>
              No commercial opportunities currently active. Opportunities appear here when discovered and qualified with evidence.
            </p>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {opportunitiesPursued.map((opp) => (
                <div
                  key={opp.id}
                  style={{
                    padding: '8px 12px',
                    borderRadius: radii.sm,
                    background: 'rgba(255,255,255,0.02)',
                    border: `1px solid ${colors.border}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{opp.title}</div>
                    <div style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>
                      Score: {opp.overallScore} · Recommendation: {opp.recommendation}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {opp.estimatedValue ? (
                      <div style={{ fontFamily: fonts.mono, fontSize: 12, fontWeight: 700 }}>
                        ${opp.estimatedValue.toLocaleString()}
                      </div>
                    ) : null}
                    <Badge tone="default">{opp.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Key Commercial Prospects (Question 3)">
          {prospectsThatMatter.length === 0 ? (
            <p style={{ margin: 0, color: colors.muted, fontSize: 12.5 }}>
              No prioritized prospects in the active commercial pipeline. Prospects advance here once real contact provenance and discovery evidence exist.
            </p>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {prospectsThatMatter.map((p) => (
                <div
                  key={p.prospectId}
                  style={{
                    padding: '8px 12px',
                    borderRadius: radii.sm,
                    background: 'rgba(255,255,255,0.02)',
                    border: `1px solid ${colors.border}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{p.companyName}</div>
                    <div style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>
                      ID: <code style={{ fontSize: 10 }}>{p.prospectId}</code>
                      {p.dealId ? ` · Deal: ${p.dealId}` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {p.estimatedValue ? (
                      <div style={{ fontFamily: fonts.mono, fontSize: 12, fontWeight: 700 }}>
                        ${p.estimatedValue.toLocaleString()}
                      </div>
                    ) : null}
                    {p.stage ? <Badge tone="default">{p.stage}</Badge> : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* 6. What Happens Next (Question 9) */}
      <Card title="Next Prescribed Actions (Question 9: What happens next?)">
        {nextActions.length === 0 ? (
          <p style={{ margin: 0, color: colors.muted, fontSize: 12.5 }}>
            No immediate next actions queued. The system is awaiting new market triggers or operator instructions.
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
            {nextActions.map((na, idx) => (
              <div
                key={`${na.targetId}-${idx}`}
                style={{
                  padding: '10px 12px',
                  borderRadius: radii.sm,
                  background: 'rgba(255,255,255,0.02)',
                  border: `1px solid ${colors.border}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <Badge tone={na.priority === 'high' ? 'warning' : 'default'}>
                    {na.priority.toUpperCase()} PRIORITY
                  </Badge>
                  <span style={{ fontSize: 10, color: colors.muted }}>{na.targetType}</span>
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: colors.text }}>{na.action}</div>
                <div style={{ fontSize: 10.5, color: colors.muted, marginTop: 4, fontFamily: fonts.mono }}>
                  Target: {na.targetId}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </section>
  );
}
