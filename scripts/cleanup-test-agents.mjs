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
 * - agent_id or correlation_id contains 'smoke', 'test', 'demo', 'e2e', or 'fixture'
 * - status is 'idle', 'completed', or 'failed' (case-insensitive)
 * - For 'active'/'working'/'running': only if matches smoke pattern AND old AND no in-flight work
 * - last_seen_at or updated_at is older than 7 days (configurable)
 * 
 * Never deletes:
 * - Pre-seeded workforce agents (orchestrator, discovery, etc.)
 * - Agents with in-flight work (current_work_package_id / current_agent_run_id not null)
 * - Agents active within the last 7 days
 * 
 * Handles dependencies: Also deletes associated observability_agent_runs for smoke agents
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

// Patterns that identify test/smoke agents in agent_id or correlation_id
const SMOKE_PATTERNS = [
  /smoke/i,
  /test/i,
  /demo/i,
  /e2e/i,
  /fixture/i,
  /example/i,
];

// Safe to delete immediately (no in-flight work check needed)
const SAFE_STATUSES = ['idle', 'completed', 'failed'];

// Potentially in-flight, need extra checks
const INFLIGHT_STATUSES = ['active', 'working', 'running'];

/**
 * Check if agent_id or correlation_id matches smoke/test patterns
 */
export function isSmokeAgent(agentId, correlationId) {
  if (!agentId) return false;
  
  const idMatch = SMOKE_PATTERNS.some(p => p.test(agentId));
  const corrMatch = correlationId ? SMOKE_PATTERNS.some(p => p.test(correlationId)) : false;
  
  return idMatch || corrMatch;
}

/**
 * Check if agent can be safely deleted
 */
function isTestAgent(row) {
  const { agent_id, correlation_id, status, current_work_package_id, current_agent_run_id } = row;
  
  // Never delete seeded agents
  if (SEEDED_AGENTS.includes(agent_id)) return false;
  
  // Must match smoke pattern
  if (!isSmokeAgent(agent_id, correlation_id)) return false;
  
  const statusLower = (status || '').toLowerCase();
  
  // Safe statuses: delete immediately
  if (SAFE_STATUSES.includes(statusLower)) {
    return { deletable: true, reason: 'safe_status' };
  }
  
  // Potentially in-flight: check for active work
  if (INFLIGHT_STATUSES.includes(statusLower)) {
    const hasWork = current_work_package_id || current_agent_run_id;
    if (hasWork) {
      return { deletable: false, reason: 'has_active_work' };
    }
    // Stale heartbeat: smoke agent marked active but no work and old
    return { deletable: true, reason: 'stale_heartbeat' };
  }
  
  return false;
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
      WHERE updated_at < DATE_SUB(UTC_TIMESTAMP(3), INTERVAL ? DAY)
      ORDER BY updated_at ASC
    `;
    
    const [workforceRows] = await connection.execute(workforceQuery, [daysOld]);
    const workforceAgents = Array.isArray(workforceRows) ? workforceRows : [];
    const workforceCandidates = workforceAgents.filter(row => {
      const result = isTestAgent(row);
      return result && result.deletable;
    });
    
    // Find candidates in observability_agents
    const obsQuery = `
      SELECT 
        agent_id, 
        specialist_id, 
        name, 
        department, 
        status, 
        last_seen_at,
        current_work_package_id,
        current_agent_run_id,
        correlation_id
      FROM observability_agents
      WHERE last_seen_at < DATE_SUB(UTC_TIMESTAMP(3), INTERVAL ? DAY)
      ORDER BY last_seen_at ASC
    `;
    
    const [obsRows] = await connection.execute(obsQuery, [daysOld]);
    const obsAgents = Array.isArray(obsRows) ? obsRows : [];
    
    // Separate by status and deletability
    const obsSafe = [];
    const obsStale = [];
    const obsSkipped = [];
    
    for (const row of obsAgents) {
      const result = isTestAgent(row);
      if (!result) {
        continue; // Not a smoke agent
      }
      if (!result.deletable) {
        obsSkipped.push({ ...row, reason: result.reason });
        continue;
      }
      if (result.reason === 'stale_heartbeat') {
        obsStale.push(row);
      } else {
        obsSafe.push(row);
      }
    }
    
    const obsCandidates = [...obsSafe, ...obsStale];
    
    // Count associated runs
    let runCount = 0;
    if (obsCandidates.length > 0) {
      const agentIds = obsCandidates.map(r => r.agent_id);
      const placeholders = agentIds.map(() => '?').join(',');
      const [runRows] = await connection.execute(
        `SELECT COUNT(*) as count FROM observability_agent_runs WHERE agent_id IN (${placeholders})`,
        agentIds
      );
      runCount = runRows[0]?.count || 0;
    }
    
    console.log(`Found ${workforceCandidates.length} test agents in ai_agents (workforce)`);
    console.log(`Found ${obsCandidates.length} test agents in observability_agents:`);
    console.log(`  - ${obsSafe.length} with safe status (idle/completed/failed)`);
    console.log(`  - ${obsStale.length} with stale heartbeat (active but no work, old)`);
    if (obsSkipped.length > 0) {
      console.log(`  - ${obsSkipped.length} skipped (active with in-flight work)`);
    }
    if (runCount > 0) {
      console.log(`Found ${runCount} associated observability_agent_runs (will be deleted with agents)`);
    }
    console.log();
    
    if (workforceCandidates.length === 0 && obsCandidates.length === 0) {
      console.log('✅ No test agents to clean up.');
      await connection.end();
      process.exit(0);
    }
    
    // Show samples (first 20)
    if (workforceCandidates.length > 0) {
      console.log('📋 ai_agents (workforce) to delete:');
      const sample = workforceCandidates.slice(0, 20);
      sample.forEach(row => {
        console.log(`  - ${row.agent_id} (${row.name}) [${row.status}] updated: ${row.updated_at}`);
      });
      if (workforceCandidates.length > 20) {
        console.log(`  ... and ${workforceCandidates.length - 20} more`);
      }
      console.log();
    }
    
    if (obsSafe.length > 0) {
      console.log('📋 observability_agents to delete (safe status):');
      const sample = obsSafe.slice(0, 20);
      sample.forEach(row => {
        console.log(`  - ${row.agent_id} [${row.status}] last seen: ${row.last_seen_at}`);
      });
      if (obsSafe.length > 20) {
        console.log(`  ... and ${obsSafe.length - 20} more`);
      }
      console.log();
    }
    
    if (obsStale.length > 0) {
      console.log('📋 observability_agents to delete (stale heartbeat):');
      const sample = obsStale.slice(0, 20);
      sample.forEach(row => {
        console.log(`  - ${row.agent_id} [${row.status}, no work] last seen: ${row.last_seen_at}`);
      });
      if (obsStale.length > 20) {
        console.log(`  ... and ${obsStale.length - 20} more`);
      }
      console.log();
    }
    
    if (obsSkipped.length > 0) {
      console.log('⚠️  observability_agents SKIPPED (active with work):');
      const sample = obsSkipped.slice(0, 20);
      sample.forEach(row => {
        console.log(`  - ${row.agent_id} [${row.status}] reason: ${row.reason}`);
      });
      if (obsSkipped.length > 20) {
        console.log(`  ... and ${obsSkipped.length - 20} more`);
      }
      console.log();
    }
    
    if (!apply) {
      console.log('🟢 DRY-RUN complete. No changes made.');
      console.log('   Run with --apply to actually delete these records.\n');
      await connection.end();
      process.exit(0);
    }
    
    // Apply deletions in a transaction
    console.log('🔴 APPLYING deletions...\n');
    
    await connection.beginTransaction();
    
    try {
      let deletedWorkforce = 0;
      let deletedObs = 0;
      let deletedRuns = 0;
      
      // Delete workforce agents
      for (const row of workforceCandidates) {
        await connection.execute('DELETE FROM ai_agents WHERE agent_id = ?', [row.agent_id]);
        deletedWorkforce++;
      }
      
      // Delete associated runs first (foreign key)
      if (obsCandidates.length > 0) {
        const agentIds = obsCandidates.map(r => r.agent_id);
        const placeholders = agentIds.map(() => '?').join(',');
        const [result] = await connection.execute(
          `DELETE FROM observability_agent_runs WHERE agent_id IN (${placeholders})`,
          agentIds
        );
        deletedRuns = result.affectedRows || 0;
      }
      
      // Delete observability agents
      for (const row of obsCandidates) {
        await connection.execute('DELETE FROM observability_agents WHERE agent_id = ?', [row.agent_id]);
        deletedObs++;
      }
      
      await connection.commit();
      
      console.log(`✅ Cleanup complete:`);
      console.log(`   - ${deletedWorkforce} records deleted from ai_agents`);
      console.log(`   - ${deletedObs} records deleted from observability_agents`);
      console.log(`   - ${deletedRuns} records deleted from observability_agent_runs`);
      
    } catch (error) {
      await connection.rollback();
      throw error;
    }
    
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
