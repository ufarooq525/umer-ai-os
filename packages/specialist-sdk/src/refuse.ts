import type { SpecialistMandate } from './types.js';

export type RefusalRequest = {
  action: string;
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
  const haystack = `${request.action} ${request.toolName ?? ''} ${request.capabilityId ?? ''}`
    .toLowerCase()
    .trim();

  for (const nonGoal of mandate.nonGoals) {
    const keywords = nonGoal
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length >= 5 && !['must', 'refuse', 'silent'].includes(word));

    const matched = keywords.find((keyword) => haystack.includes(keyword));
    if (matched) {
      return {
        refused: true,
        reason: `Action blocked by Non-Goal: ${nonGoal}`,
        matchedNonGoal: nonGoal,
      };
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
