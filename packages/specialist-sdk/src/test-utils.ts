import { AGENT_SECTIONS, ENTERPRISE_SECTIONS } from './constants.js';
import type { AgentSectionName } from './types.js';

const SECTION_BODY = 'This section contains enough substantive content to pass the activation gate review.';

function agentSection(name: AgentSectionName, body = SECTION_BODY): string {
  if (name === 'Examples') {
    return `## Examples\n\nInput: sample task brief.\nOutput: completed delivery artifact with acceptance evidence.`;
  }
  if (name === 'Metadata') {
    return `## Metadata\n\nversion: 1.0.0\ndepartment: Engineering\nstatus: Registered\nowner: Engineering Lead`;
  }
  if (name === 'Mission') {
    return `## Mission\n\nDeliver application changes safely under Engineering governance.`;
  }
  return `## ${name}\n\n${body}`;
}

function enterpriseSection(id: string, title: string, body: string): string {
  return `## ${id} — ${title}\n\n${body}`;
}

export function buildValidSpecialistSpec(overrides: { title?: string; omitSection?: string } = {}): string {
  const title = overrides.title ?? 'Application Delivery Specialist';
  const lines = [
    '---',
    'specialist_id: eng.app-delivery',
    'department: Engineering',
    'mandate_domain: Delivery',
    'authority_class: Produce',
    'interaction_mode: SoloProducer',
    'version: 1.0.0',
    '---',
    '',
    `# ${title}`,
    '',
  ];

  for (const section of AGENT_SECTIONS) {
    if (overrides.omitSection !== section) {
      lines.push(agentSection(section), '');
    }
  }

  const enterpriseBodies: Record<string, string> = {
    E1: 'department: Engineering\nReports to Engineering Lead on Org Chart.',
    E2: '- cap.app.delivery\n- cap.code.review',
    E3: 'authority_class: Produce',
    E4: 'mandate_domain: Delivery\ninteraction_mode: SoloProducer',
    E5: 'Must refuse Business portfolio decisions and silent mandate expansion.',
    E6: '- skill.git\n- skill.ci',
    E7: '- git.diff\n- tests.run',
    E8: 'Required context keys: brief, repository, acceptance_criteria.',
    E9: 'Read lessons learned; write run summaries only.',
    E10: 'Produces Code artifacts; consumes Design Handoff artifacts.',
    E11: 'sandbox_class: standard\nmax_duration_ms: 3600000',
    E12: 'Entry checklist: inputs present. Exit checklist: tests pass.',
    E13: 'Cannot auto-approve release gates.',
    E14: 'Allowed: delegate, handoff, review, pair, escalate.',
    E15: 'Escalate on ambiguity, constraint breach, quality fail.',
    E16: 'Retry transient tool failures; fatal on mandate violation.',
    E17: 'Emit agent.run.* and workpackage completion metrics.',
    E18: 'anchor: Engineering Lead',
    E19: 'Backup: Senior Engineer pairing class.',
    E20: 'Semver 1.x compatible with Development stage workflows.',
    E21: 'Trust class: internal-delivery; data sensitivity: internal.',
    E22: 'Budget class: standard; max_tools_per_run: 20; parallelism: 1',
  };

  for (const section of ENTERPRISE_SECTIONS) {
    if (overrides.omitSection !== section.id) {
      lines.push(
        enterpriseSection(section.id, section.title, enterpriseBodies[section.id] ?? SECTION_BODY),
        '',
      );
    }
  }

  return lines.join('\n');
}
