import { configDefaults, defineWorkspace } from 'vitest/config';

/**
 * Two projects, not one:
 *
 *  - "unit": every fast unit/integration test, full default parallelism.
 *  - "live-e2e": tests/e2e/live-*.test.ts — real NATS + real local LLM
 *    smoke tests. These share ONE real NATS server and ONE real local
 *    LM Studio model instance, neither of which tolerates concurrent
 *    load safely:
 *      - AgentWorker's command subscription filters on a fixed literal
 *        subject (SUBJECTS.CMD_AGENT_DISPATCH, see packages/agent-runtime/
 *        src/worker.ts) — legitimately shared in production, but it means
 *        two of these files running at the same time can each receive the
 *        OTHER's dispatched Work Package and fail it with "No mandate
 *        registered for specialist X".
 *      - LM Studio serves one model; several concurrent real generations
 *        queue and can exceed even a generous per-test timeout.
 *  `fileParallelism: false` on this project alone keeps these files
 *  running one at a time, without slowing down the hundreds of unit
 *  tests in the other project.
 */
export default defineWorkspace([
  {
    test: {
      name: 'unit',
      globals: false,
      environment: 'node',
      include: ['packages/**/src/**/*.test.ts', 'apps/**/src/**/*.test.ts', 'tests/**/*.test.ts'],
      exclude: [...configDefaults.exclude, 'tests/e2e/live-*.test.ts'],
      passWithNoTests: true,
    },
  },
  {
    test: {
      name: 'live-e2e',
      globals: false,
      environment: 'node',
      include: ['tests/e2e/live-*.test.ts'],
      fileParallelism: false,
      passWithNoTests: true,
    },
  },
]);
