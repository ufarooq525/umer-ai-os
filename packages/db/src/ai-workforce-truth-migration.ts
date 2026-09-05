import type { MySqlMigration } from './migrations.js';

/**
 * Remove legacy demo workforce rows that were inserted by the initial
 * workforce migration. CEO-facing workforce state must come only from real
 * registered/runtime-backed agents; an empty workforce is a valid state.
 */
export const AI_WORKFORCE_TRUTH_MIGRATIONS: readonly MySqlMigration[] = [
  {
    id: '011_ai_workforce_truth',
    checksum: '3b8d4c1e7a2f9d6b5c0e4a8f1d3b7c9e2f6a0d5c8b1e4f7a9d2c6e0b3f8a1d5',
    statements: [
      `DELETE FROM ai_agents WHERE agent_id IN (
        'orchestrator', 'discovery', 'identity', 'research',
        'audit', 'analysis', 'opportunity', 'outreach'
      )`,
    ],
  },
];
