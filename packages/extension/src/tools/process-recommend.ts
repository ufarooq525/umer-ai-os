import type { ToolDefinition } from '../types.js';

export type ProcessRecommendInput = {
  command: string;
  rationale: string;
};

export type ProcessRecommendOutput = {
  command: string;
  rationale: string;
  allowlisted: boolean;
  note: string;
};

/**
 * Fixed, read-only verification command prefixes this tool recognizes. Not a
 * list of commands this tool can run — it runs nothing — just what it will
 * vouch for as a known test-runner invocation versus something a human must
 * look at before anyone executes it.
 */
const KNOWN_VERIFICATION_COMMAND_PREFIXES = [
  './vendor/bin/phpunit',
  './vendor/bin/pest',
  'npx playwright test',
  'npx vitest',
  'npm test',
  'npm run test',
  'pnpm test',
  'pnpm run test',
  'pnpm --filter',
  'composer test',
];

function isProcessRecommendInput(value: unknown): value is ProcessRecommendInput {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { command?: unknown }).command === 'string' &&
    (value as { command: string }).command.trim().length > 0 &&
    typeof (value as { rationale?: unknown }).rationale === 'string' &&
    (value as { rationale: string }).rationale.trim().length > 0
  );
}

function isKnownVerificationCommand(command: string): boolean {
  return KNOWN_VERIFICATION_COMMAND_PREFIXES.some(
    (prefix) => command === prefix || command.startsWith(`${prefix} `),
  );
}

/**
 * process_recommend — records a recommended verification command without
 * ever running it. This tool has no subprocess-execution capability at all:
 * it only classifies the command against a fixed allowlist of known-safe,
 * read-only test-runner invocations, so a Specialist under an Advise
 * authority class (e.g. qa.verify) can surface "run this" findings for a
 * human or a separately-audited runner to act on, without this run ever
 * being able to execute anything itself.
 */
export function createProcessRecommendTool(): ToolDefinition<ProcessRecommendOutput> {
  return {
    name: 'process_recommend',
    description:
      'Record a recommended verification command (e.g. a test-runner invocation) along with why it verifies ' +
      'the goal at hand. This tool NEVER executes the command — it only classifies it against a fixed allowlist ' +
      'of known read-only verification commands so a human or a separately-audited runner can act on it.',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The exact command line you recommend running.' },
        rationale: { type: 'string', description: 'Why this command verifies the goal at hand.' },
      },
      required: ['command', 'rationale'],
      additionalProperties: false,
    },
    async handler(input: unknown): Promise<ProcessRecommendOutput> {
      if (!isProcessRecommendInput(input)) {
        throw new Error('process_recommend requires a non-empty string "command" and "rationale"');
      }
      const command = input.command.trim();
      const allowlisted = isKnownVerificationCommand(command);
      return {
        command,
        rationale: input.rationale.trim(),
        allowlisted,
        note: allowlisted
          ? 'Recognized as a known read-only verification command. This tool did not execute it — a human or a separately-audited runner must.'
          : 'Not on the known verification-command allowlist. This tool did not execute it and does not vouch for its safety — flag for human review before anyone runs it.',
      };
    },
  };
}
