import {
  ArtifactContractSchema,
  parseContract,
  type ArtifactContract,
} from '@umer/contracts';
import type { ValidationContext, ValidationIssue, ValidationResult } from './types.js';

export function validateArtifact(
  artifact: ArtifactContract,
  context: ValidationContext,
): ValidationResult {
  const issues: ValidationIssue[] = [];

  try {
    parseContract(ArtifactContractSchema, artifact);
  } catch (err) {
    issues.push({
      code: 'MALFORMED',
      message: err instanceof Error ? err.message : 'Artifact contract is malformed',
    });
    return { valid: false, issues };
  }

  const required = new Set(context.requiredCriteria.map((criterion) => criterion.trim()));
  const met = new Map(
    artifact.acceptanceCriteriaMet.map((entry) => [entry.criterion.trim(), entry]),
  );

  for (const criterion of required) {
    const evidence = met.get(criterion);
    if (!evidence) {
      issues.push({
        code: 'MISSING_CRITERION',
        message: `Missing acceptance criterion: ${criterion}`,
      });
      continue;
    }
    if (evidence.status === 'VERIFIED' && !evidence.evidenceRef) {
      issues.push({
        code: 'UNVERIFIED_CRITERION',
        message: `Criterion "${criterion}" is VERIFIED without evidence`,
      });
    }
  }

  for (const entry of artifact.acceptanceCriteriaMet) {
    if (!required.has(entry.criterion.trim())) {
      issues.push({
        code: 'INVENTED_CRITERION',
        message: `Criterion not in source Task/Brief: ${entry.criterion}`,
      });
    }
  }

  return { valid: issues.length === 0, issues };
}
