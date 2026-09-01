import { describe, expect, it, vi } from 'vitest';
import { MySqlOpportunityPersistence, type MySqlExecutor } from './persistence.js';

describe('MySqlOpportunityPersistence', () => {
  it('maps MySQL JSON and decimal fields back to domain types', async () => {
    const execute = vi.fn<MySqlExecutor['execute']>();
    execute.mockResolvedValueOnce([
      {
        id: 'opp_1',
        type: 'service',
        title: 'Quote workflow',
        geography: 'Saudi Arabia',
        market: 'Transport',
        niche_id: 'saudi-umrah-transport',
        business_id: 'biz_1',
        problem_ids_json: '["problem_1"]',
        score_json: JSON.stringify({
          problemSeverity: 80,
          demandEvidence: 70,
          abilityToPay: 75,
          reachability: 90,
          solutionFit: 85,
          competitiveGap: 65,
          deliveryFeasibility: 90,
          evidenceConfidence: 80,
          overall: 79,
          recommendation: 'outreach_ready',
        }),
        estimated_value_min: '1000.00',
        estimated_value_max: '2500.00',
        currency: 'USD',
        time_to_revenue_days: '14',
        evidence_refs_json: '["evidence_1"]',
        status: 'outreach_ready',
        created_at: '2026-09-02T00:00:00.000Z',
        updated_at: '2026-09-02T00:00:00.000Z',
      },
    ]);

    const persistence = new MySqlOpportunityPersistence({ db: { execute } });
    const result = await persistence.getOpportunity('opp_1');

    expect(result).toMatchObject({
      id: 'opp_1',
      estimatedValueMin: 1000,
      estimatedValueMax: 2500,
      timeToRevenueDays: 14,
      problemIds: ['problem_1'],
      evidenceRefs: ['evidence_1'],
    });
    expect(execute).toHaveBeenCalledWith('SELECT * FROM opportunity_opportunities WHERE id = ?', ['opp_1']);
  });
});
