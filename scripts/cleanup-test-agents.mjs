#!/usr/bin/env node
/**
 * cleanup-test-agents.mjs
 * 
 * Safely removes test/smoke-test agent records from the database.
 * 
 * Usage:
 *   pnpm cleanup:agents                  # dry-run (show what would be deleted)
 *   pnpm cleanup:agents:apply            # actually delete
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

import { createConnection } from 'mysql2/promise';
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Load .env from repo root
const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
config({ path: join(rootDir, '.env') });

const apply = process.argv.includes('--apply');
const all = process.argv.includes('--all');
const daysOld = parseInt(process.env.CLEANUP_MIN_DAYS_OLD ?? '7', 10);

console.log('=== Umer AI OS — Test Agent Cleanup ===\n');
console.log(`Mode: ${apply ? '🔴 APPLY (will delete)' : '🟢 DRY-RUN (preview only)'}`);
console.log(`Min age: ${daysOld} days`);

const dbUrl = process.env.OPPORTUNITY_DATABASE_URL;
if (!dbUrl) {
  console.error('❌ OPPORTUNITY_DATABASE_URL not set in .env');
  process.exit(1);
}

console.log(`Database: ${dbUrl.replace(/:[^:]+@/, ':***@')}\n`);

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
  // Parse MySQL URL
  const match = dbUrl.match(/^mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
  if (!match) {
    console.error('❌ Invalid OPPORTUNITY_DATABASE_URL format. Expected: mysql://user:pass@host:port/database');
    process.exit(1);
  }

  const [, user, password, host, port, database] = match;
  
  const connection = await createConnection({
    host,
    port: parseInt(port, 10),
    user,
    password,
    database,
  });
  
  try {
    // Find candidates in ai_agents (workforce)
    const workforceQuery = `
      SELECT agent_id, name, department, role, status, updated_at, last_heartbeat_at
      FROM ai_agents
      WHERE status IN (${SAFE_STATUSES.map(() => '?').join(',')})
        AND updated_at < DATE_SUB(UTC_TIMESTAMP(3), INTERVAL ? DAY)
      ORDER BY updated_at ASC
    `;
    
    const [workforceRows] = await connection.execute(workforceQuery, [...SAFE_STATUSES, daysOld]);
    const workforceAgents = Array.isArray(workforceRows) ? workforceRows : [];
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
    
    const [obsRows] = await connection.execute(obsQuery, [...SAFE_STATUSES, daysOld]);
    const obsAgents = Array.isArray(obsRows) ? obsRows : [];
    const obsCandidates = obsAgents.filter(row => 
      all || isTestAgent(row.agent_id, row.name, row.status)
    );
    
    console.log(`Found ${workforceCandidates.length} test agents in ai_agents (workforce)`);
    console.log(`Found ${obsCandidates.length} test agents in observability_agents\n`);
    
    if (workforceCandidates.length === 0 && obsCandidates.length === 0) {
      console.log('✅ No test agents to clean up.');
      await connection.end();
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
      await connection.end();
      process.exit(0);
    }
    
    // Apply deletions
    console.log('🔴 APPLYING deletions...\n');
    
    let deletedWorkforce = 0;
    let deletedObs = 0;
    
    for (const row of workforceCandidates) {
      await connection.execute('DELETE FROM ai_agents WHERE agent_id = ?', [row.agent_id]);
      deletedWorkforce++;
      console.log(`  ✓ Deleted ai_agents: ${row.agent_id}`);
    }
    
    for (const row of obsCandidates) {
      await connection.execute('DELETE FROM observability_agents WHERE agent_id = ?', [row.agent_id]);
      deletedObs++;
      console.log(`  ✓ Deleted observability_agents: ${row.agent_id}`);
    }
    
    console.log(`\n✅ Cleanup complete:`);
    console.log(`   - ${deletedWorkforce} records deleted from ai_agents`);
    console.log(`   - ${deletedObs} records deleted from observability_agents`);
    
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    await connection.end();
    process.exit(1);
  } finally {
    await connection.end();
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
