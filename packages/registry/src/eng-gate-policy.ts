import type { ProjectCategory } from './types.js';
import type { EngDeliveryReport } from './eng-delivery.js';
import { ENG_MAX_FILES_DEFAULT } from './eng-scope.js';
import { ProjectRegistryError } from './errors.js';

/** @deprecated Prefer EngApplyApproval — kept for narrow mode checks in eligibility. */
export type EngGateMode = 'human' | 'auto';

export type EngApplyApproval =
  | {
      kind: 'human-gate';
      gateId: string;
      approver: string;
      rationale: string;
    }
  | {
      kind: 'auto';
      reason: string;
    };

export type EngAutoEligibility = {
  eligible: boolean;
  reason: string;
};

export type EngGateDecision = {
  /** Always true for client-task; false only when digital-product auto mode fires. */
  humanRequired: boolean;
  /** True only when apply may proceed without a human gate. */
  autoApply: boolean;
  reason: string;
};

type EngPackageGateView = Pick<
  EngDeliveryReport,
  'status' | 'editStats' | 'testsPassed' | 'testsRan' | 'runs'
>;

function allDiscoveredRunsGreen(runs: EngPackageGateView['runs']): boolean {
  if (runs.length === 0) return false;
  // Mixed pass + skipped must NOT auto-apply — every discovered record must have run.
  return runs.every((r) => r.ran && !r.skipped && r.exitCode === 0);
}

/**
 * Digital-product auto-apply requires every condition below.
 * Fail closed when any signal is missing.
 */
export function evaluateEngAutoEligibility(input: {
  category: ProjectCategory | string;
  autoApplyEng: boolean;
  package: EngPackageGateView;
  maxFiles?: number;
}): EngAutoEligibility {
  const maxFiles = input.maxFiles ?? ENG_MAX_FILES_DEFAULT;

  if (input.category !== 'digital-product') {
    return {
      eligible: false,
      reason:
        input.category === 'client-task'
          ? 'client-task never auto-applies eng (always explicit human gate)'
          : input.category === 'seo-project'
            ? 'seo-project has no eng auto-apply behavior'
            : `unknown category "${input.category}" — fail closed`,
    };
  }

  if (!input.autoApplyEng) {
    return { eligible: false, reason: 'autoApplyEng is false (default off)' };
  }

  if (input.package.status !== 'ready') {
    return {
      eligible: false,
      reason: 'work package needs manual scoping — cannot auto-apply',
    };
  }

  if (input.package.editStats.filesChanged > maxFiles) {
    return {
      eligible: false,
      reason: `diff touches ${input.package.editStats.filesChanged} files (limit ${maxFiles})`,
    };
  }

  if (input.package.runs.length === 0) {
    return {
      eligible: false,
      reason: 'no suite ran — skipped/absent suites cannot unlock auto-apply',
    };
  }

  if (input.package.runs.some((r) => !r.ran || r.skipped)) {
    return {
      eligible: false,
      reason: 'every discovered suite must actually run — skipped mixes block auto-apply',
    };
  }

  if (!input.package.testsRan || !input.package.testsPassed || !allDiscoveredRunsGreen(input.package.runs)) {
    return {
      eligible: false,
      reason: 'staged suites must all run and exit 0 (testsPassed=false when any skip/fail)',
    };
  }

  return {
    eligible: true,
    reason: 'digital-product autoApplyEng with in-scope green staged suites',
  };
}

/**
 * Decide whether eng intake creates a human gate or auto-applies.
 *
 * client-task: always explicit human gate before apply — no auto ever, even if
 * `autoApplyEng` is true. Client work must stay human-supervised.
 */
export function decideEngGate(input: {
  category: ProjectCategory | string;
  autoApplyEng: boolean;
  package: EngPackageGateView;
  maxFiles?: number;
}): EngGateDecision {
  if (
    input.category !== 'client-task' &&
    input.category !== 'digital-product' &&
    input.category !== 'seo-project'
  ) {
    return {
      humanRequired: true,
      autoApply: false,
      reason: `unknown category "${input.category}" — fail closed to human gate`,
    };
  }

  if (input.category === 'client-task') {
    return {
      humanRequired: true,
      autoApply: false,
      reason:
        'client-task always requires an explicit human gate before eng apply (autoApplyEng ignored)',
    };
  }

  if (input.category === 'seo-project') {
    return {
      humanRequired: true,
      autoApply: false,
      reason: 'seo-project never auto-applies eng',
    };
  }

  const eligibility = evaluateEngAutoEligibility(input);
  if (eligibility.eligible) {
    return {
      humanRequired: false,
      autoApply: true,
      reason: eligibility.reason,
    };
  }

  return {
    humanRequired: true,
    autoApply: false,
    reason: eligibility.reason,
  };
}

function assertHumanGateFields(approval: Extract<EngApplyApproval, { kind: 'human-gate' }>): void {
  if (!approval.gateId.trim()) {
    throw new ProjectRegistryError(
      'ENG_APPLY_BLOCKED',
      'human-gate apply requires a nonempty gateId',
    );
  }
  if (!approval.approver.trim()) {
    throw new ProjectRegistryError(
      'ENG_APPLY_BLOCKED',
      'human-gate apply requires a nonempty approver',
    );
  }
  if (!approval.rationale.trim()) {
    throw new ProjectRegistryError(
      'ENG_APPLY_BLOCKED',
      'human-gate apply requires a nonempty rationale',
    );
  }
}

/**
 * Mutation-boundary enforcement for applyEngToProject.
 * Human apply must carry explicit gateId + approver; auto re-checks category eligibility.
 */
export function assertEngApplyAllowed(input: {
  category: ProjectCategory | string;
  autoApplyEng: boolean;
  approval: EngApplyApproval;
  package: EngPackageGateView;
  maxFiles?: number;
}): void {
  if (input.package.status !== 'ready') {
    throw new ProjectRegistryError(
      'ENG_APPLY_BLOCKED',
      'Manual-scoping eng packages cannot be applied',
    );
  }

  if (
    input.category !== 'client-task' &&
    input.category !== 'digital-product' &&
    input.category !== 'seo-project'
  ) {
    throw new ProjectRegistryError(
      'ENG_APPLY_BLOCKED',
      `Unknown project category "${input.category}" — eng apply fail-closed`,
    );
  }

  if (input.approval.kind === 'human-gate') {
    // Explicit human approval is required at the mutation boundary (especially client-task).
    assertHumanGateFields(input.approval);
    return;
  }

  // auto
  if (input.category === 'client-task') {
    throw new ProjectRegistryError(
      'ENG_APPLY_BLOCKED',
      'client-task rejects auto eng apply at the mutation boundary (human gate required)',
    );
  }
  if (!input.approval.reason.trim()) {
    throw new ProjectRegistryError(
      'ENG_APPLY_BLOCKED',
      'auto eng apply requires a nonempty reason',
    );
  }
  const eligibility = evaluateEngAutoEligibility({
    category: input.category,
    autoApplyEng: input.autoApplyEng,
    package: input.package,
    maxFiles: input.maxFiles,
  });
  if (!eligibility.eligible) {
    throw new ProjectRegistryError(
      'ENG_APPLY_BLOCKED',
      `Auto eng apply rejected: ${eligibility.reason}`,
    );
  }
}

export function engApprovalMode(approval: EngApplyApproval): EngGateMode {
  return approval.kind === 'auto' ? 'auto' : 'human';
}

export function engApprovalRationale(approval: EngApplyApproval): string {
  return approval.kind === 'auto' ? approval.reason : approval.rationale;
}
