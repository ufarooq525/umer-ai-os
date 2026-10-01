#!/usr/bin/env node
/**
 * cleanup-test-agents.mjs
 * 
 * Safely removes test/smoke-test agent records from the database.
 * 
 * Usage:
 *   node scripts/cleanup-test-agents.mjs                  # dry-run (show what would be deleted)
 *   node scripts/cleanup-test-agents.mjs --apply          # actually delete
 *   node scripts/cleanup-test-agents.mjs --apply --all    # delete all idle agents (use with caution)
 * 
 * Safety: Only deletes agents that are clearly test/smoke-test records:
 * - agent_id or name contains 'test', 'smoke', 'demo', 'e2e', or 'fixture'
 * - status is 'IDLE', 'COMPLETED', or 'FAILED'
 * - last_seen_at or updated_at is older than 7 days (configurable)
 * 
 * Never deletes:
 * - Agents with status 'RUNNING' or 'WORKING'
 * - Pre-seeded workforce agents (orchestrator, discovery, etc.)
 * - Agents active within the last 7 days
 */

import { createMySqlClient, createMySqlExecutor } from '@umer/db';
import { loadEnv } from '@umer/config';

const env = loadEnv();
const apply = process.argv.includes('--apply');
const all = process.argv.includes('--all');
const daysOld = parseInt(process.env.CLEANUP_MIN_DAYS_OLD ?? '7', 10);

console.log('=== Umer AI OS — Test Agent Cleanup ===\n');
console.log(`Mode: ${apply ? '🔴 APPLY (will delete)' : '🟢 DRY-RUN (preview only)'}`);
console.log(`Min age: ${daysOld} days`);
console.log(`Database: ${env.OPPORTUNITY_DATABASE_URL.replace(/:[^:]+@/, ':***@')}\n`);

const SEEDED_AGENTS = [
  'orchestrator',
  'discovery',
  'identity',
  'research',
  'audit',
  'analysis',
  'opportunity',
  'outreach',
];

const TEST_PATTERNS = [
  /test/i,
  /smoke/i,
  /demo/i,
  /e2e/i,
  /fixture/i,
  /example/i,
];

const SAFE_STATUSES = ['IDLE', 'COMPLETED', 'FAILED'];

function isTestAgent(agentId, name, status) {
  // Never delete seeded agents
  if (SEEDED_AGENTS.includes(agentId)) return false;
  
  // Must be in a safe status (not running)
  if (!SAFE_STATUSES.includes(status)) return false;
  
  // Must match a test pattern in agent_id or name
  const idMatch = TEST_PATTERNS.some(p => p.test(agentId));
  const nameMatch = name && TEST_PATTERNS.some(p => p.test(name));
  
  return idMatch || nameMatch;
}

async function main() {
  const client = createMySqlClient();
  const executor = createMySqlExecutor(client);
  
  try {
    // Find candidates in ai_agents (workforce)
    const workforceQuery = `
      SELECT agent_id, name, department, role, status, updated_at, last_heartbeat_at
      FROM ai_agents
      WHERE status IN (${SAFE_STATUSES.map(() => '?').join(',')})
        AND updated_at < DATE_SUB(UTC_TIMESTAMP(3), INTERVAL ? DAY)
      ORDER BY updated_at ASC
    `;
    
    const workforceAgents = await executor.query(workforceQuery, [...SAFE_STATUSES, daysOld]);
    const workforceCandidates = workforceAgents.filter(row => 
      all || isTestAgent(row.agent_id, row.name, row.status)
    );
    
    // Find candidates in observability_agents
    const obsQuery = `
      SELECT agent_id, specialist_id, name, department, status, last_seen_at
      FROM observability_agents
      WHERE status IN (${SAFE_STATUSES.map(() => '?').join(',')})
        AND last_seen_at < DATE_SUB(UTC_TIMESTAMP(3), INTERVAL ? DAY)
      ORDER BY last_seen_at ASC
    `;
    
    const obsAgents = await executor.query(obsQuery, [...SAFE_STATUSES, daysOld]);
    const obsCandidates = obsAgents.filter(row => 
      all || isTestAgent(row.agent_id, row.name, row.status)
    );
    
    console.log(`Found ${workforceCandidates.length} test agents in ai_agents (workforce)`);
    console.log(`Found ${obsCandidates.length} test agents in observability_agents\n`);
    
    if (workforceCandidates.length === 0 && obsCandidates.length === 0) {
      console.log('✅ No test agents to clean up.');
      process.exit(0);
    }
    
    // Show what would be deleted
    if (workforceCandidates.length > 0) {
      console.log('📋 ai_agents (workforce) to delete:');
      workforceCandidates.forEach(row => {
        console.log(`  - ${row.agent_id} (${row.name}) [${row.status}] updated: ${row.updated_at}`);
      });
      console.log();
    }
    
    if (obsCandidates.length > 0) {
      console.log('📋 observability_agents to delete:');
      obsCandidates.forEach(row => {
        console.log(`  - ${row.agent_id} (${row.name ?? 'N/A'}) [${row.status}] last seen: ${row.last_seen_at}`);
      });
      console.log();
    }
    
    if (!apply) {
      console.log('🟢 DRY-RUN complete. No changes made.');
      console.log('   Run with --apply to actually delete these records.\n');
      process.exit(0);
    }
    
    // Apply deletions
    console.log('🔴 APPLYING deletions...\n');
    
    let deletedWorkforce = 0;
    let deletedObs = 0;
    
    for (const row of workforceCandidates) {
      await executor.execute('DELETE FROM ai_agents WHERE agent_id = ?', [row.agent_id]);
      deletedWorkforce++;
      console.log(`  ✓ Deleted ai_agents: ${row.agent_id}`);
    }
    
    for (const row of obsCandidates) {
      await executor.execute('DELETE FROM observability_agents WHERE agent_id = ?', [row.agent_id]);
      deletedObs++;
      console.log(`  ✓ Deleted observability_agents: ${row.agent_id}`);
    }
    
    console.log(`\n✅ Cleanup complete:`);
    console.log(`   - ${deletedWorkforce} records deleted from ai_agents`);
    console.log(`   - ${deletedObs} records deleted from observability_agents`);
    
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
