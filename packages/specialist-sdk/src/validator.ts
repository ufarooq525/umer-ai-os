import { AGENT_SECTIONS, ENTERPRISE_SECTIONS, MIN_SECTION_LENGTH, VENDOR_ID_PATTERNS } from './constants.js';
import type { ParsedMarkdownSpec, ValidationIssue, ValidationResult } from './types.js';

function isNonVacuous(content?: string): boolean {
  if (!content) {
    return false;
  }
  return content.replace(/\s+/g, ' ').trim().length >= MIN_SECTION_LENGTH;
}

function hasWorkedExample(examples?: string): boolean {
  if (!isNonVacuous(examples)) {
    return false;
  }
  return /input|output|example/i.test(examples ?? '');
}

export function validateActivationGate(parsed: ParsedMarkdownSpec): ValidationResult {
  const issues: ValidationIssue[] = [];

  for (const section of AGENT_SECTIONS) {
    if (!isNonVacuous(parsed.agentSections[section])) {
      issues.push({
        code: 'AGENT_SECTION_MISSING',
        message: `Agent section "${section}" is missing or vacuous`,
        section,
      });
    }
  }

  if (!hasWorkedExample(parsed.agentSections.Examples ?? '')) {
    issues.push({
      code: 'EXAMPLE_MISSING',
      message: 'At least one worked Example is required',
      section: 'Examples',
    });
  }

  for (const enterprise of ENTERPRISE_SECTIONS) {
    if (!isNonVacuous(parsed.enterpriseSections[enterprise.id])) {
      issues.push({
        code: 'ENTERPRISE_SECTION_MISSING',
        message: `Enterprise section ${enterprise.id} (${enterprise.title}) is missing or vacuous`,
        section: enterprise.id,
      });
    }
  }

  const e5 = parsed.enterpriseSections.E5 ?? '';
  if (!/refuse|must not|non-goal|anti-mandate/i.test(e5)) {
    issues.push({
      code: 'NON_GOALS_WEAK',
      message: 'E5 Non-Goals / Anti-Mandate must declare explicit refusal boundaries',
      section: 'E5',
    });
  }

  const e18 = parsed.enterpriseSections.E18 ?? '';
  if (!isNonVacuous(e18)) {
    issues.push({
      code: 'HUMAN_ANCHOR_MISSING',
      message: 'E18 Human Accountability Anchor must name a human or role',
      section: 'E18',
    });
  }

  if (VENDOR_ID_PATTERNS.some((pattern) => pattern.test(parsed.rawContent))) {
    issues.push({
      code: 'VENDOR_ID_FORBIDDEN',
      message: 'Spec must not contain model vendor IDs',
    });
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
