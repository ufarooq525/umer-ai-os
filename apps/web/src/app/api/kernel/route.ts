import { NextResponse } from 'next/server';
import { createMySqlExecutor } from '@umer/db';
import { getKernelQueueSnapshot } from '@/lib/ai-kernel-runtime';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = createMySqlExecutor();
    const [snapshot, usage, tools, evaluations] = await Promise.all([
      getKernelQueueSnapshot(),
      db.execute<Array<{ input_tokens: number; output_tokens: number; cached_tokens: number; cost: number }>>(
        `SELECT COALESCE(SUM(input_tokens),0) input_tokens, COALESCE(SUM(output_tokens),0) output_tokens,
                COALESCE(SUM(cached_tokens),0) cached_tokens, COALESCE(SUM(estimated_cost),0) cost
         FROM ai_model_usage WHERE created_at >= UTC_TIMESTAMP() - INTERVAL 24 HOUR`,
      ),
      db.execute<Array<{ total: number; cache_hits: number; failures: number }>>(
        `SELECT COUNT(*) total, COALESCE(SUM(cache_hit),0) cache_hits,
                COALESCE(SUM(CASE WHEN success=0 THEN 1 ELSE 0 END),0) failures
         FROM ai_tool_usage WHERE created_at >= UTC_TIMESTAMP() - INTERVAL 24 HOUR`,
      ),
      db.execute<Array<{ evaluations: number; passed: number; avg_score: number }>>(
        `SELECT COUNT(*) evaluations, COALESCE(SUM(CASE WHEN outcome='PASSED' THEN 1 ELSE 0 END),0) passed, COALESCE(AVG(score),0) avg_score
         FROM ai_evaluations WHERE created_at >= UTC_TIMESTAMP() - INTERVAL 24 HOUR`,
      ),
    ]);

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      ...snapshot,
      modelUsage24h: usage[0] ?? { input_tokens: 0, output_tokens: 0, cached_tokens: 0, cost: 0 },
      toolUsage24h: tools[0] ?? { total: 0, cache_hits: 0, failures: 0 },
      evaluations24h: evaluations[0] ?? { evaluations: 0, passed: 0, avg_score: 0 },
    }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, {
      status: 503,
      headers: { 'cache-control': 'no-store' },
    });
  }
}
