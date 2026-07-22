import { describe, expect, it } from 'vitest';
import { InMemoryWorkPackageStore } from './store.js';
import { createTestWorkPackage } from './test-utils.js';

describe('InMemoryWorkPackageStore', () => {
  it('saves and retrieves records', async () => {
    const store = new InMemoryWorkPackageStore();
    const record = { workPackage: createTestWorkPackage({ status: 'Queued' }) };
    await store.save(record);
    expect(await store.get('wp-1')).toEqual(record);
  });

  it('lists records by status', async () => {
    const store = new InMemoryWorkPackageStore();
    await store.save({ workPackage: createTestWorkPackage({ status: 'Queued' }) });
    await store.save({
      workPackage: createTestWorkPackage({ workPackageId: 'wp-2', status: 'Running' }),
    });
    expect(await store.listByStatus('Queued')).toHaveLength(1);
    store.clear();
    expect(await store.get('wp-1')).toBeUndefined();
  });
});
