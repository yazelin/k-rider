// tests/worker-daily-score.test.js
import { describe, it, expect } from 'vitest';
import { handleDaily } from '../worker/src/daily.js';
import { handleScore } from '../worker/src/score.js';
import { mockEnv, req } from './helpers/mock-env.js';
import { pickDaily, taipeiDateStr } from '../src/shared/daily-pick.js';
import { FEATURED } from '../src/shared/featured-list.js';

describe('GET /daily', () => {
  it('回今日挑戰與空榜', async () => {
    const env = mockEnv();
    const res = await handleDaily(req('https://api/daily'), env, 'https://yazelin.github.io');
    const body = await res.json();
    const expected = pickDaily(taipeiDateStr(), FEATURED);
    expect(body.symbol).toBe(expected.symbol);
    expect(body.period).toBe(expected.period);
    expect(body.leaderboard).toEqual([]);
    expect(body.totalPlayers).toBe(0);
  });
});

describe('POST /score', () => {
  const valid = () => ({
    nickname: 'tester', score: 12345,
    playerId: 'a'.repeat(32), stats: { finished: true },
  });
  it('收分後出現在榜上', async () => {
    const env = mockEnv();
    const res = await handleScore(req('https://api/score', { method: 'POST', body: JSON.stringify(valid()) }), env, 'https://yazelin.github.io');
    expect(res.status).toBe(200);
    const daily = await (await handleDaily(req('https://api/daily'), env, '')).json();
    expect(daily.leaderboard[0]).toMatchObject({ nickname: 'tester', score: 12345 });
    expect(daily.totalPlayers).toBe(1);
  });
  it('同 playerId 只留最高分', async () => {
    const env = mockEnv();
    const post = (score) => handleScore(req('https://api/score', { method: 'POST', body: JSON.stringify({ ...valid(), score }) }), env, '');
    await post(100); await post(999); await post(50);
    const daily = await (await handleDaily(req('https://api/daily'), env, '')).json();
    expect(daily.leaderboard).toHaveLength(1);
    expect(daily.leaderboard[0].score).toBe(999);
  });
  it('超過理論上限 → 400', async () => {
    const env = mockEnv();
    const res = await handleScore(req('https://api/score', { method: 'POST', body: JSON.stringify({ ...valid(), score: 99999999 }) }), env, '');
    expect(res.status).toBe(400);
  });
  it('playerId 格式錯 → 400', async () => {
    const env = mockEnv();
    const res = await handleScore(req('https://api/score', { method: 'POST', body: JSON.stringify({ ...valid(), playerId: 'x!' }) }), env, '');
    expect(res.status).toBe(400);
  });
});
