import { describe, expect, it, vi } from 'vitest';
import { MySqlProjectStore, type MySqlExecutor } from './project-store-mysql.js';

describe('MySqlProjectStore', () => {
  it('maps a row (JSON metadata as string) back to a valid project', async () => {
    const execute = vi.fn<MySqlExecutor['execute']>(async () => [] as never);
    execute.mockResolvedValueOnce([
      {
        project_id: 'proj-1',
        header_id: 'proj-1',
        name: 'Nitro Tickets',
        status: 'Active',
        owner: 'human.ceo',
        source_opportunity_id: 'opp-1',
        registry_project_id: 'nitrotickets-new',
        metadata_json: JSON.stringify({ labels: {}, annotations: {} }),
        created_at: '2026-09-06T00:00:00.000Z',
        updated_at: '2026-09-06T00:00:00.000Z',
      },
    ] as never);

    const store = new MySqlProjectStore({ db: { execute: execute as unknown as MySqlExecutor['execute'] } });
    const project = await store.get('proj-1');

    expect(project).toMatchObject({
      projectId: 'proj-1',
      name: 'Nitro Tickets',
      status: 'Active',
      owner: 'human.ceo',
      sourceOpportunityId: 'opp-1',
      registryProjectId: 'nitrotickets-new',
    });
  });

  it('leaves optional fields undefined when their columns are null', async () => {
    const execute = vi.fn<MySqlExecutor['execute']>(async () => [] as never);
    execute.mockResolvedValueOnce([
      {
        project_id: 'proj-2',
        header_id: 'proj-2',
        name: 'Bare Project',
        status: 'Forming',
        owner: null,
        source_opportunity_id: null,
        registry_project_id: null,
        metadata_json: { labels: {}, annotations: {} },
        created_at: '2026-09-06T00:00:00.000Z',
        updated_at: '2026-09-06T00:00:00.000Z',
      },
    ] as never);

    const store = new MySqlProjectStore({ db: { execute: execute as unknown as MySqlExecutor['execute'] } });
    const project = await store.get('proj-2');

    expect(project?.owner).toBeUndefined();
    expect(project?.sourceOpportunityId).toBeUndefined();
    expect(project?.registryProjectId).toBeUndefined();
  });

  it('returns undefined when no row matches', async () => {
    const execute = vi.fn<MySqlExecutor['execute']>(async () => [] as never);
    const store = new MySqlProjectStore({ db: { execute: execute as unknown as MySqlExecutor['execute'] } });
    expect(await store.get('missing')).toBeUndefined();
  });

  it('creates a real project with a generated id and publishes project.created', async () => {
    const execute = vi.fn<MySqlExecutor['execute']>(async () => undefined as never);
    const publish = vi.fn(async () => undefined);
    const store = new MySqlProjectStore({
      db: { execute: execute as unknown as MySqlExecutor['execute'] },
      events: { publish },
    });

    const project = await store.create({ name: 'New Project' }, 'corr-1');

    expect(project.projectId).toMatch(/^proj-/);
    expect(project.status).toBe('Forming');
    expect(execute).toHaveBeenCalledTimes(1);
    const [sql] = execute.mock.calls[0]!;
    expect(sql).toContain('INSERT INTO work_management_projects');
    expect(publish).toHaveBeenCalledWith('project.created', 'corr-1', expect.objectContaining({ projectId: project.projectId }));
  });

  it('filters list() by status and owner', async () => {
    const execute = vi.fn<MySqlExecutor['execute']>(async () => [] as never);
    const store = new MySqlProjectStore({ db: { execute: execute as unknown as MySqlExecutor['execute'] } });

    await store.list({ status: 'Active', owner: 'human.ceo' });

    const [sql, params] = execute.mock.calls[0]!;
    expect(sql).toContain('WHERE status = ? AND owner = ?');
    expect(params).toEqual(['Active', 'human.ceo']);
  });

  it('updateStatus returns undefined for an unknown project without writing', async () => {
    const execute = vi.fn<MySqlExecutor['execute']>(async () => [] as never);
    const store = new MySqlProjectStore({ db: { execute: execute as unknown as MySqlExecutor['execute'] } });

    const result = await store.updateStatus('missing', 'Active', 'corr-1');

    expect(result).toBeUndefined();
    expect(execute).toHaveBeenCalledTimes(1); // only the SELECT from get(), no INSERT
  });
});
