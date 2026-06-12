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
  it('volume 在 finish 與 crash 都累加，非法值忽略', async () => {
    const env = mockEnv();
    const post = (type, volume) => handleEvent(req('https://api/event', { method: 'POST', body: JSON.stringify({ type, volume }) }), env, '');
    await post('finish', 210000);
    await post('crash', 180000);          // 摔車=斷頭賣出，也算成交
    await post('crash', -5);              // 非法：負值忽略
    await post('finish', 99999999999);    // 非法：超過上限忽略
    const s = await (await handleStats(req('https://api/stats'), env, '')).json();
    expect(s.volume).toBe(390000);
  });
});
