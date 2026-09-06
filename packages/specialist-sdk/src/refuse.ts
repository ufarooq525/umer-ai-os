import type { SpecialistMandate } from './types.js';

export type RefusalRequest = {
  /**
   * Free-text description of what's being requested, checked against the
   * mandate's own non-goals by crude keyword substring matching. Omit this
   * when there is no real, meaningful description to check — a synthetic
   * placeholder (e.g. one built from a Work Package's own id) risks a false
   * refusal purely from incidental vocabulary overlap with the mandate's own
   * non-goal text (confirmed live: every `security.review` Work Package's id
   * contains "security" because that is the node type's own name, which is
   * also a keyword extracted from that mandate's own non-goals — an
   * unconditional, permanent false refusal that had nothing to do with what
   * was actually being asked). The toolName-vs-allowlist check below still
   * runs regardless.
   */
  action?: string;
  toolName?: string;
  capabilityId?: string;
};

export type RefusalDecision = {
  refused: boolean;
  reason?: string;
  matchedNonGoal?: string;
};

export function evaluateRefusal(
  mandate: SpecialistMandate,
  request: RefusalRequest,
): RefusalDecision {
  // toolName/capabilityId are identifiers, not a description of what's being
  // requested — deliberately excluded from this haystack (unlike an earlier
  // version of this function). A real tool name can itself contain a
  // mandate's own non-goal keyword (e.g. security.review's real, load-bearing
  // `process_run_audit` tool contains "audit", which is also a keyword
  // extracted from its own non-goal text) without that meaning anything
  // about what the caller is actually asking for.
  if (request.action) {
    const haystack = request.action.toLowerCase().trim();

    const STOP_WORDS = new Set([
      'must',
      'refuse',
      'silent',
      'under',
      'single',
      'package',
      'project',
      'without',
      'apply',
      'applying',
      'explicit',
    ]);

    for (const nonGoal of mandate.nonGoals) {
      const keywords = nonGoal
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((word) => word.length >= 5 && !STOP_WORDS.has(word));

      const matched = keywords.find((keyword) => haystack.includes(keyword));
      if (matched) {
        return {
          refused: true,
          reason: `Action blocked by Non-Goal: ${nonGoal}`,
          matchedNonGoal: nonGoal,
        };
      }
    }
  }

  if (request.toolName && mandate.contract.toolAllowlist.length > 0) {
    if (!mandate.contract.toolAllowlist.includes(request.toolName)) {
      return {
        refused: true,
        reason: `Tool "${request.toolName}" is not on the specialist allowlist`,
      };
    }
  }

  return { refused: false };
}

export function getRefusalSurface(mandate: SpecialistMandate): {
  nonGoals: string[];
  toolAllowlist: string[];
  authorityClass: string;
} {
  return {
    nonGoals: [...mandate.nonGoals],
    toolAllowlist: [...mandate.contract.toolAllowlist],
    authorityClass: mandate.contract.authorityClass,
  };
}
