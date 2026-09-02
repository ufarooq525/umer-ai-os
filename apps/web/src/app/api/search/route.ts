import { NextRequest, NextResponse } from 'next/server';
import { createMySqlExecutor } from '@umer/db';

export const dynamic = 'force-dynamic';

const MAX_RESULTS = 50;

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')?.trim() ?? '';

  if (query.length < 2) {
    return NextResponse.json({ query, results: [] }, { headers: { 'cache-control': 'no-store' } });
  }

  const term = `%${query}%`;
  const db = createMySqlExecutor();

  try {
    const results = await db.execute<Array<Record<string, unknown>>>(
      `SELECT entity_type AS entityType, entity_id AS entityId, title, summary, status, occurred_at AS occurredAt
         FROM (
           SELECT 'agent' entity_type, id entity_id, CONCAT(name, ' · ', role) title,
                  CONCAT('Agent ', id, ' is ', status) summary, status, updated_at occurred_at
             FROM ai_agents
            WHERE id LIKE ? OR name LIKE ? OR role LIKE ? OR status LIKE ?
           UNION ALL
           SELECT 'task', task_id, title,
                  CONCAT(task_type, ' · ', COALESCE(status, 'UNKNOWN'), ' · agent=', COALESCE(assigned_agent_id, 'unassigned')),
                  status, COALESCE(updated_at, created_at)
             FROM ai_tasks
            WHERE task_id LIKE ? OR title LIKE ? OR task_type LIKE ? OR status LIKE ? OR assigned_agent_id LIKE ? OR run_id LIKE ?
           UNION ALL
           SELECT 'run', run_id, CONCAT('Run ', run_id),
                  CONCAT('Niche=', niche_id, ' · opportunities=', opportunities_found, ' · businesses=', businesses_discovered),
                  CASE WHEN completed_at IS NULL THEN 'RUNNING' ELSE 'COMPLETED' END, COALESCE(completed_at, started_at)
             FROM opportunity_niche_runs
            WHERE run_id LIKE ? OR niche_id LIKE ?
           UNION ALL
           SELECT 'niche', id, name, description, status, updated_at
             FROM opportunity_niches
            WHERE id LIKE ? OR name LIKE ? OR description LIKE ? OR priority LIKE ?
           UNION ALL
           SELECT 'business', id, name,
                  CONCAT(COALESCE(industry, 'unknown industry'), ' · ', geography, ' · ', COALESCE(website, 'no website')),
                  'DISCOVERED', COALESCE(last_researched_at, discovered_at)
             FROM opportunity_businesses
            WHERE id LIKE ? OR name LIKE ? OR website LIKE ? OR geography LIKE ? OR industry LIKE ?
           UNION ALL
           SELECT 'opportunity', id, title,
                  CONCAT(type, ' · ', market, ' · ', status, ' · score=', JSON_UNQUOTE(JSON_EXTRACT(score_json, '$.overall'))),
                  status, updated_at
             FROM opportunity_opportunities
            WHERE id LIKE ? OR title LIKE ? OR type LIKE ? OR geography LIKE ? OR market LIKE ? OR status LIKE ?
           UNION ALL
           SELECT 'evidence', id, title,
                  CONCAT(type, ' · ', strength, ' · ', source_url),
                  strength, observed_at
             FROM opportunity_evidence
            WHERE id LIKE ? OR title LIKE ? OR type LIKE ? OR source_url LIKE ? OR excerpt LIKE ? OR observation LIKE ?
           UNION ALL
           SELECT 'problem', id, LEFT(statement, 240),
                  CONCAT('business=', business_id, ' · niche=', niche_id, ' · severity=', severity),
                  'IDENTIFIED', created_at
             FROM opportunity_problems
            WHERE id LIKE ? OR business_id LIKE ? OR niche_id LIKE ? OR statement LIKE ?
           UNION ALL
           SELECT 'outreach', id, COALESCE(subject, CONCAT('Outreach ', id)),
                  CONCAT(channel, ' · opportunity=', opportunity_id, ' · business=', business_id),
                  status, updated_at
             FROM opportunity_outreach_drafts
            WHERE id LIKE ? OR opportunity_id LIKE ? OR business_id LIKE ? OR subject LIKE ? OR body LIKE ?
           UNION ALL
           SELECT 'workflow_event', event_id, CONCAT(event_type, ' · ', COALESCE(message, '')),
                  CONCAT('task=', COALESCE(task_id, '-'), ' · agent=', COALESCE(agent_id, '-'), ' · run=', COALESCE(run_id, '-')),
                  event_type, occurred_at
             FROM ai_workflow_events
            WHERE event_id LIKE ? OR event_type LIKE ? OR message LIKE ? OR task_id LIKE ? OR agent_id LIKE ? OR run_id LIKE ?
           UNION ALL
           SELECT 'run_event', id, CONCAT(stage, ' · ', agent_name),
                  message, level, occurred_at
             FROM opportunity_run_events
            WHERE id LIKE ? OR run_id LIKE ? OR niche_id LIKE ? OR stage LIKE ? OR agent_name LIKE ? OR message LIKE ?
         ) search_results
        ORDER BY CASE WHEN entity_id = ? THEN 0 WHEN title LIKE ? THEN 1 ELSE 2 END, occurred_at DESC
        LIMIT ${MAX_RESULTS}`,
      [
        term, term, term, term,
        term, term, term, term, term, term,
        term, term,
        term, term, term, term,
        term, term, term, term, term,
        term, term, term, term, term, term,
        term, term, term, term, term,
        term, term, term, term,
        term, term, term, term,
        term, term, term, term, term,
        term, term, term, term, term, term,
        query, term,
      ],
    );

    return NextResponse.json({ query, results }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, {
      status: 503,
      headers: { 'cache-control': 'no-store' },
    });
  }
}
