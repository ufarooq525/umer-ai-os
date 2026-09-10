'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Bot, AlertCircle, Clock } from 'lucide-react';
import { colors, fonts, radii } from '@umer/ui';
import type { AgentRecord, AgentRunRecord } from '@/lib/control-api';
import { StatusBadge } from './StatusBadge';
import { agentTone, runActionTone } from './status';
import { formatRelativeTime, humanizeSpecialistId } from './format';


export type AgentCardProps = {
  agent: AgentRecord;
  run?: AgentRunRecord;
  currentTaskTitle?: string;
  projectName?: string;
  compact?: boolean;
};

export function AgentCard({ agent, run, currentTaskTitle, projectName, compact }: AgentCardProps) {
  const tone = run && run.status === 'running' ? runActionTone(run.status, run.currentAction) : agentTone(agent.status, agent.controlState);
  const isWorking = agent.status === 'active' && agent.controlState === 'active';
  const role = agent.department ?? humanizeSpecialistId(agent.specialistId);
  const name = agent.name ?? humanizeSpecialistId(agent.specialistId) ?? agent.agentId;

  const currentTask = currentTaskTitle || (run?.currentTool ? `Using ${run.currentTool}` : agent.currentWorkPackageId ? `Package ${agent.currentWorkPackageId}` : 'Standby for work');
  const latestOutput = run?.summary || (run?.artifactId ? `Artifact ${run.artifactId}` : 'Standard specialist telemetry');
  const blocker = run && run.failures.length > 0 ? run.failures[run.failures.length - 1]!.message : null;
  const nextAction = isWorking ? 'Produce verified stage artifact' : agent.controlState === 'paused' ? 'Awaiting CEO resume' : 'Waiting for task dispatch';
  const reduce = useReducedMotion();

  return (
    <Link href={`/company/agents/${agent.agentId}`} style={{ textDecoration: 'none', color: colors.text, display: 'block' }}>
      <motion.div
        whileHover={reduce ? undefined : { y: -3 }}
        transition={{ duration: 0.15 }}
        style={{
          borderRadius: 16,
          border: isWorking ? '1px solid rgba(167, 139, 250, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
          background: isWorking
            ? 'linear-gradient(180deg, rgba(167, 139, 250, 0.07) 0%, rgba(255, 255, 255, 0.015) 100%), #12151e'
            : 'linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%), #12151e',
          padding: '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.25)',
          transition: 'border-color 0.15s ease',
        }}
      >
        {/* Header: Name, Role, Status Pulse */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: isWorking ? 'rgba(167, 139, 250, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                color: isWorking ? '#a78bfa' : colors.muted,
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              <Bot size={18} />
            </div>
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: '#ffffff', letterSpacing: '-0.02em' }}>
                {name}
              </div>
              <div style={{ fontSize: 11, color: colors.muted, marginTop: 1, fontFamily: fonts.mono }}>
                {role}
              </div>
            </div>
          </div>
          <StatusBadge tone={tone} />
        </div>

        {!compact ? (
          <div style={{ display: 'grid', gap: 10, fontSize: 12 }}>
            {/* Project */}
            <div>
              <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: colors.muted }}>
                Project / Scope
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: projectName ? colors.text : colors.muted, marginTop: 2 }}>
                {projectName ?? 'Across Portfolio'}
              </div>
            </div>

            {/* Current Task */}
            <div>
              <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: colors.muted }}>
                Current Task / Objective
              </div>
              <div style={{ fontSize: 12.5, color: colors.text, marginTop: 2, lineHeight: 1.4 }}>
                {currentTask}
              </div>
            </div>

            {/* Latest Output */}
            {run?.summary || run?.artifactId ? (
              <div>
                <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: colors.accent }}>
                  Latest Output
                </div>
                <div style={{ fontSize: 12, color: colors.text, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {latestOutput}
                </div>
              </div>
            ) : null}

            {/* Next Action */}
            <div>
              <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: colors.muted }}>
                Next Action
              </div>
              <div style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
                {nextAction}
              </div>
            </div>


            {/* Blocker if any */}
            {blocker && (
              <div style={{ padding: '8px 10px', borderRadius: radii.sm, background: 'rgba(240, 113, 120, 0.1)', border: '1px solid rgba(240, 113, 120, 0.25)' }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: colors.danger, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <AlertCircle size={12} /> Blocker
                </div>
                <div style={{ fontSize: 11.5, color: colors.text, marginTop: 2, lineHeight: 1.3 }}>
                  {blocker}
                </div>
              </div>
            )}
          </div>
        ) : null}

        {/* Footer: Elapsed time & Open Work action */}
        <div
          style={{
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            paddingTop: 10,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 11,
            color: colors.muted,
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: fonts.mono }}>
            <Clock size={11} /> {formatRelativeTime(agent.lastSeenAt)}
          </span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              color: colors.accent,
              fontWeight: 650,
            }}
          >
            Open Work <ArrowRight size={12} />
          </span>
        </div>
      </motion.div>
    </Link>
  );
}
