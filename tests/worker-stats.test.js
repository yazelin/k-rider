import { describe, it, expect } from 'vitest';
import { handleStats, handleEvent } from '../worker/src/stats.js';
import { mockEnv, req } from './helpers/mock-env.js';

describe('stats/event', () => {
  it('event 累加，stats 讀回', async () => {
    const env = mockEnv();
    const post = (type) => handleEvent(req('https://api/event', { method: 'POST', body: JSON.stringify({ type }) }), env, '');
    await post('finish'); await post('finish'); await post('crash');
    const s = await (await handleStats(req('https://api/stats'), env, '')).json();
    expect(s.rides).toBe(2);
    expect(s.crashes).toBe(1);
  });
  it('未知 type → 400', async () => {
    const res = await handleEvent(req('https://api/event', { method: 'POST', body: JSON.stringify({ type: 'hack' }) }), mockEnv(), '');
    expect(res.status).toBe(400);
  });
});
