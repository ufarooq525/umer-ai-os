'use client';

import Link from 'next/link';
import { Layers } from 'lucide-react';
import { colors, fonts, radii } from '@umer/ui';
import type { ArtifactRecord, WorkPackageSummary, WorkProjectRecord } from '@/lib/control-api';

type DeliveryStageDef = {
  id: string;
  name: string;
  specialistId: string;
  expectedArtifact: string;
  description: string;
};

const DELIVERY_STAGES: DeliveryStageDef[] = [
  { id: 'requirements', name: 'Requirements', specialistId: 'req.formalize', expectedArtifact: 'RequirementsBrief', description: 'Problem framing, acceptance criteria & scope decomposition' },
  { id: 'product', name: 'Product', specialistId: 'product.definition', expectedArtifact: 'ProductBrief', description: 'Product specification, user stories & capability map' },
  { id: 'architecture', name: 'Architecture', specialistId: 'arch.design', expectedArtifact: 'ArchitectureSpec', description: 'System design, domain boundaries & technical contracts' },
  { id: 'ux', name: 'UX & Interface', specialistId: 'ux.design', expectedArtifact: 'DesignArtifact', description: 'Information architecture, user journey & design system tokens' },
  { id: 'implementation', name: 'Implementation', specialistId: 'eng.app-delivery', expectedArtifact: 'CodeDelivery', description: 'High-assurance code implementation and component builds' },
  { id: 'qa', name: 'QA Verification', specialistId: 'qa.verify', expectedArtifact: 'TestPlanResults', description: 'Automated test suite execution and functional assertion' },
  { id: 'security', name: 'Security Audit', specialistId: 'security.audit', expectedArtifact: 'SecurityReport', description: 'Dependency audit, privilege separation & vulnerability check' },
  { id: 'release', name: 'Release Packaging', specialistId: 'release.package', expectedArtifact: 'ReleasePackage', description: 'Sealed build, distribution checksums & environment deploy' },
  { id: 'operations', name: 'Operations & SRE', specialistId: 'ops.verify', expectedArtifact: 'OperationalReport', description: 'Runtime health monitoring, telemetry verification & SLA checks' },
];

export function DeliveryStageView({
  workPackages,
  artifacts,
  projects,
}: {
  workPackages: WorkPackageSummary[];
  artifacts: ArtifactRecord[];
  projects: WorkProjectRecord[];
}) {
  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* Header Info */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          padding: '16px 20px',
          borderRadius: 14,
          background: 'linear-gradient(90deg, rgba(167, 139, 250, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%), #12151e',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: 'rgba(167, 139, 250, 0.15)',
              display: 'grid',
              placeItems: 'center',
              color: '#a78bfa',
            }}
          >
            <Layers size={18} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 650, color: colors.text }}>
              Autonomous Delivery Pipeline
            </div>
            <div style={{ fontSize: 11.5, color: colors.muted }}>
              Canonical 9-stage engineering execution from formal Requirements to Production SRE ({projects.length} codebases)
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <Link
            href="/delivery/requirements"
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              border: '1px solid rgba(255, 255, 255, 0.08)',
              background: 'rgba(255, 255, 255, 0.04)',
              color: colors.text,
              fontSize: 12,
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            Requirements Specification →
          </Link>
          <Link
            href="/projects"
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              border: '1px solid rgba(255, 255, 255, 0.08)',
              background: 'rgba(255, 255, 255, 0.04)',
              color: colors.text,
              fontSize: 12,
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            Codebase Repos →
          </Link>
        </div>
      </div>

      {/* Visual Pipeline Stages */}
      <div style={{ display: 'grid', gap: 12 }}>
        {DELIVERY_STAGES.map((stage, idx) => {
          const matchingWp = workPackages.find(
            (w) =>
              w.stage?.toLowerCase().includes(stage.id) ||
              w.specialistId?.toLowerCase().includes(stage.id)
          );
          const matchingArtifact = artifacts.find(
            (a) =>
              a.artifactType?.toLowerCase().includes(stage.id) ||
              a.artifactId?.toLowerCase().includes(stage.expectedArtifact.toLowerCase())
          );

          const status = matchingWp
            ? matchingWp.status
            : matchingArtifact
              ? 'Sealed'
              : 'Standby';
          const isRunning = status === 'Running' || status === 'Claimed' || status === 'InProgress';

          return (
            <div
              key={stage.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '40px 180px 1fr 180px 140px',
                alignItems: 'center',
                gap: 16,
                padding: '14px 18px',
                borderRadius: radii.md,
                background: isRunning
                  ? 'linear-gradient(90deg, rgba(232, 160, 84, 0.09) 0%, rgba(255, 255, 255, 0.02) 100%), #12151e'
                  : 'rgba(255, 255, 255, 0.02)',
                border: isRunning
                  ? '1px solid rgba(232, 160, 84, 0.35)'
                  : '1px solid rgba(255, 255, 255, 0.06)',
                transition: 'all 0.12s ease',
              }}
            >
              {/* Step number */}
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  background: isRunning
                    ? 'rgba(232, 160, 84, 0.2)'
                    : 'rgba(255, 255, 255, 0.04)',
                  display: 'grid',
                  placeItems: 'center',
                  fontFamily: fonts.mono,
                  fontSize: 11,
                  fontWeight: 700,
                  color: isRunning ? colors.accent : colors.muted,
                }}
              >
                0{idx + 1}
              </div>

              {/* Stage Name */}
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#ffffff' }}>
                  {stage.name}
                </div>
                <div style={{ fontSize: 11, color: colors.muted, fontFamily: fonts.mono }}>
                  {stage.specialistId}
                </div>
              </div>

              {/* Description / Scope */}
              <div style={{ fontSize: 12, color: colors.muted, lineHeight: 1.4 }}>
                {stage.description}
              </div>

              {/* Sealed Output / Artifact */}
              <div>
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: colors.muted }}>
                  Target Output
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: matchingArtifact ? colors.success : colors.text, marginTop: 2 }}>
                  {matchingArtifact ? matchingArtifact.artifactId : stage.expectedArtifact}
                </div>
              </div>

              {/* Status Badge */}
              <div style={{ textAlign: 'right' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '3px 8px',
                    borderRadius: 6,
                    fontSize: 10.5,
                    fontFamily: fonts.mono,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    background: isRunning
                      ? 'rgba(232, 160, 84, 0.15)'
                      : status === 'Sealed' || status === 'Completed'
                        ? 'rgba(93, 206, 160, 0.15)'
                        : 'rgba(255, 255, 255, 0.04)',
                    color: isRunning
                      ? colors.accent
                      : status === 'Sealed' || status === 'Completed'
                        ? colors.success
                        : colors.muted,
                  }}
                >
                  {status}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
