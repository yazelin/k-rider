import { describe, it, expect, vi, afterEach } from 'vitest';
import { handleRoast, bucketOf } from '../worker/src/roast.js';
import { mockEnv, req } from './helpers/mock-env.js';

afterEach(() => vi.restoreAllMocks());

const body = (over = {}) => JSON.stringify({ symbol: 'TSLA', period: '1y', score: 50000, stats: { finished: true, flips: 3 }, lang: 'zh-TW', ...over });

describe('bucketOf', () => {
  it('分數分桶穩定', () => {
    expect(bucketOf(0)).toBe(0);
    expect(bucketOf(29999)).toBe(0);
    expect(bucketOf(30000)).toBe(1);
    expect(bucketOf(9e9)).toBe(9);
  });
});

describe('POST /roast', () => {
  it('無 GROQ_API_KEY → line:null（前端退罐頭）', async () => {
    const res = await handleRoast(req('https://api/roast', { method: 'POST', body: body() }), mockEnv(), '');
    expect((await res.json()).line).toBeNull();
  });
  it('LLM 回應後寫入快取，第二次不再呼叫', async () => {
    const env = mockEnv();
    env.GROQ_API_KEY = 'test-key';
    const f = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: '嘴你一句' } }] })));
    vi.stubGlobal('fetch', f);
    const r1 = await handleRoast(req('https://api/roast', { method: 'POST', body: body() }), env, '');
    expect((await r1.json()).line).toBe('嘴你一句');
    const r2 = await handleRoast(req('https://api/roast', { method: 'POST', body: body() }), env, '');
    expect((await r2.json()).line).toBe('嘴你一句');
    expect(f).toHaveBeenCalledTimes(1);
  });
});
