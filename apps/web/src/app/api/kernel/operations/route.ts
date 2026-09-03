import { NextResponse } from 'next/server';
import { createMySqlExecutor } from '@umer/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const db = createMySqlExecutor();
    const [taskCounts, tasks, events, usage, tools, evaluations, costs] = await Promise.all([
      db.execute<Array<{ status: string; count: number }>>(
        `SELECT status, COUNT(*) AS count FROM ai_tasks GROUP BY status`,
      ),
      db.execute<Array<Record<string, unknown>>>(
        `SELECT t.task_id, t.title, t.task_type, t.status, t.priority, t.assigned_agent_id,
                t.run_id, t.project_id, t.attempts, t.max_attempts, t.token_budget, t.cost_budget,
                t.created_at, t.started_at, t.completed_at, t.error_message,
                l.lease_until, l.heartbeat_at
           FROM ai_tasks t
           LEFT JOIN ai_task_leases l ON l.task_id=t.task_id AND l.status='ACTIVE'
          ORDER BY COALESCE(t.started_at, t.created_at) DESC LIMIT 50`,
      ),
      db.execute<Array<Record<string, unknown>>>(
        `SELECT event_id, event_type, task_id, agent_id, project_id, run_id, message, metadata_json, occurred_at
           FROM ai_workflow_events ORDER BY occurred_at DESC LIMIT 75`,
      ),
      db.execute<Array<{ input_tokens: number; output_tokens: number; cached_tokens: number; cost: number }>>(
        `SELECT COALESCE(SUM(input_tokens),0) input_tokens, COALESCE(SUM(output_tokens),0) output_tokens,
                COALESCE(SUM(cached_tokens),0) cached_tokens, COALESCE(SUM(estimated_cost),0) cost
           FROM ai_model_usage WHERE created_at >= UTC_TIMESTAMP(3) - INTERVAL 24 HOUR`,
      ),
      db.execute<Array<{ total: number; cache_hits: number; failures: number; estimated_cost: number }>>(
        `SELECT COUNT(*) total, COALESCE(SUM(cache_hit),0) cache_hits,
                COALESCE(SUM(CASE WHEN success=0 THEN 1 ELSE 0 END),0) failures,
                COALESCE(SUM(estimated_cost),0) estimated_cost
           FROM ai_tool_usage WHERE created_at >= UTC_TIMESTAMP(3) - INTERVAL 24 HOUR`,
      ),
      db.execute<Array<{ evaluations: number; passed: number; avg_score: number; avg_confidence: number }>>(
        `SELECT COUNT(*) evaluations,
                COALESCE(SUM(CASE WHEN outcome='PASSED' THEN 1 ELSE 0 END),0) passed,
                COALESCE(AVG(score),0) avg_score, COALESCE(AVG(confidence),0) avg_confidence
           FROM ai_evaluations WHERE created_at >= UTC_TIMESTAMP(3) - INTERVAL 24 HOUR`,
      ),
      db.execute<Array<{ total: number; category: string; amount: number }>>(
        `SELECT COALESCE(SUM(amount),0) total, category, COALESCE(SUM(amount),0) amount
           FROM ai_cost_events WHERE occurred_at >= UTC_TIMESTAMP(3) - INTERVAL 24 HOUR GROUP BY category ORDER BY amount DESC`,
      ),
    ]);

    const model = usage[0] ?? { input_tokens: 0, output_tokens: 0, cached_tokens: 0, cost: 0 };
    const tool = tools[0] ?? { total: 0, cache_hits: 0, failures: 0, estimated_cost: 0 };
    const evaluation = evaluations[0] ?? { evaluations: 0, passed: 0, avg_score: 0, avg_confidence: 0 };
    const totalTokens = Number(model.input_tokens) + Number(model.output_tokens);

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      taskCounts: Object.fromEntries(taskCounts.map((row) => [row.status, Number(row.count)])),
      tasks,
      events,
      economics24h: {
        inputTokens: Number(model.input_tokens),
        outputTokens: Number(model.output_tokens),
        cachedTokens: Number(model.cached_tokens),
        totalTokens,
        cacheRate: totalTokens ? Number(model.cached_tokens) / totalTokens : 0,
        modelCost: Number(model.cost),
        toolCalls: Number(tool.total),
        toolCacheHits: Number(tool.cache_hits),
        toolCacheRate: Number(tool.total) ? Number(tool.cache_hits) / Number(tool.total) : 0,
        toolFailures: Number(tool.failures),
        toolCost: Number(tool.estimated_cost),
        evaluations: Number(evaluation.evaluations),
        passedEvaluations: Number(evaluation.passed),
        averageScore: Number(evaluation.avg_score),
        averageConfidence: Number(evaluation.avg_confidence),
        totalTrackedCost: Number(model.cost) + Number(tool.estimated_cost),
      },
      costsByCategory: costs.map((row) => ({ category: row.category, amount: Number(row.amount) })),
    }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, {
      status: 503,
      headers: { 'cache-control': 'no-store' },
    });
  }
}
