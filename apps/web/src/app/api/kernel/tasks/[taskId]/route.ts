import { NextResponse } from 'next/server';
import { createMySqlExecutor } from '@umer/db';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await context.params;
  try {
    const db = createMySqlExecutor();
    const [tasks, attempts, events, modelUsage, toolUsage, evaluations, costs, children] = await Promise.all([
      db.execute<Array<Record<string, unknown>>>(
        `SELECT task_id, objective_id, project_id, entity_type, entity_id, parent_task_id, run_id, task_type, title,
                instructions, why_json, status, priority, assigned_agent_id, required_capability, token_budget, cost_budget,
                max_attempts, attempts, scheduled_at, deadline_at, created_at, claimed_at, started_at, completed_at,
                updated_at, result_json, error_message
           FROM ai_tasks WHERE task_id=? LIMIT 1`, [taskId],
      ),
      db.execute<Array<Record<string, unknown>>>(
        `SELECT attempt_id, task_id, agent_id, attempt_number, status, started_at, completed_at,
                input_tokens, output_tokens, cached_tokens, estimated_cost, error_message, result_json
           FROM ai_task_attempts WHERE task_id=? ORDER BY attempt_number DESC`, [taskId],
      ),
      db.execute<Array<Record<string, unknown>>>(
        `SELECT event_id, event_type, agent_id, objective_id, project_id, run_id, entity_type, entity_id,
                message, metadata_json, occurred_at
           FROM ai_workflow_events WHERE task_id=? ORDER BY occurred_at ASC`, [taskId],
      ),
      db.execute<Array<Record<string, unknown>>>(
        `SELECT usage_id, provider, model, input_tokens, output_tokens, cached_tokens, estimated_cost, latency_ms, created_at
           FROM ai_model_usage WHERE task_id=? ORDER BY created_at ASC`, [taskId],
      ),
      db.execute<Array<Record<string, unknown>>>(
        `SELECT usage_id, agent_id, tool_id, tool_name, input_hash, cache_hit, latency_ms, estimated_cost, success, error_message, created_at
           FROM ai_tool_usage WHERE task_id=? ORDER BY created_at ASC`, [taskId],
      ),
      db.execute<Array<Record<string, unknown>>>(
        `SELECT evaluation_id, agent_id, evaluator_agent_id, score, confidence, outcome, criteria_json, feedback, created_at
           FROM ai_evaluations WHERE task_id=? ORDER BY created_at DESC`, [taskId],
      ),
      db.execute<Array<Record<string, unknown>>>(
        `SELECT cost_event_id, agent_id, project_id, category, provider, amount, currency, metadata_json, occurred_at
           FROM ai_cost_events WHERE task_id=? ORDER BY occurred_at ASC`, [taskId],
      ),
      db.execute<Array<Record<string, unknown>>>(
        `SELECT task_id, title, task_type, status, assigned_agent_id, created_at, completed_at
           FROM ai_tasks WHERE parent_task_id=? ORDER BY created_at ASC`, [taskId],
      ),
    ]);

    if (!tasks.length) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      task: tasks[0],
      attempts,
      events,
      modelUsage,
      toolUsage,
      evaluations,
      costs,
      children,
      explainability: {
        why: tasks[0].why_json ?? null,
        chain: [
          { label: 'Objective', value: tasks[0].objective_id ?? null },
          { label: 'Project', value: tasks[0].project_id ?? null },
          { label: 'Run', value: tasks[0].run_id ?? null },
          { label: 'Parent task', value: tasks[0].parent_task_id ?? null },
          { label: 'Agent', value: tasks[0].assigned_agent_id ?? null },
          { label: 'Capability', value: tasks[0].required_capability ?? null },
          { label: 'Entity', value: tasks[0].entity_id ?? null },
        ],
      },
    }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, {
      status: 503,
      headers: { 'cache-control': 'no-store' },
    });
  }
}
