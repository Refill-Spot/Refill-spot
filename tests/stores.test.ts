import { runStoreHealthCheck } from '../app/api/stores/test/route';
import { test } from 'node:test';
import assert from 'node:assert';

// 간단한 Supabase 모의 객체 생성
const mockSupabase = {
  from: (table: string) => ({
    select: (_fields: string, options?: any) => {
      if (options && options.count === 'exact') {
        return Promise.resolve({ data: [{ id: 1 }], error: null });
      }
      return {
        limit: (_n: number) => Promise.resolve({ data: [], error: null }),
      } as any;
    },
  }),
  rpc: (_name: string, _params: any) => Promise.resolve({ data: [], error: null }),
} as any;

test('runStoreHealthCheck returns structured result', async () => {
  const result = await runStoreHealthCheck(mockSupabase);
  assert.strictEqual(result.storesCount, 1);
  assert.deepEqual(result.sampleStores, []);
});
