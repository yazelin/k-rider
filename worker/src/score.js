// worker/src/score.js
import { json, sanitizeNickname, rateLimit } from './util.js';
import { maxPlausible } from '../../src/shared/scoring.js';
import { pickDaily, taipeiDateStr } from '../../src/shared/daily-pick.js';
import { FEATURED } from '../../src/shared/featured-list.js';
import { loadBoard, topList } from './daily.js';

const POINTS_BY_PERIOD = { '3m': 70, '6m': 135, '1y': 260 };

export async function handleScore(req, env, origin) {
  const date = taipeiDateStr();
  const ip = req.headers.get('CF-Connecting-IP') || 'unknown';
  if (!(await rateLimit(env, 'score', ip, 60, date))) return json({ error: 'rate limited' }, origin, 429);

  let body;
  try { body = await req.json(); } catch { return json({ error: 'bad json' }, origin, 400); }
  const { period } = pickDaily(date, FEATURED);
  const cap = maxPlausible(POINTS_BY_PERIOD[period]);
  const score = Number(body.score);
  if (!Number.isInteger(score) || score < 0 || score > cap) return json({ error: 'implausible score' }, origin, 400);
  if (!/^[a-f0-9]{8,64}$/.test(String(body.playerId || ''))) return json({ error: 'bad playerId' }, origin, 400);
  const nickname = sanitizeNickname(body.nickname);

  const board = await loadBoard(env, date);
  const prev = board.players[body.playerId];
  if (!prev || score > prev.score) board.players[body.playerId] = { nickname, score, ts: Date.now() };

  // 控制 blob 大小：只留前 100 名
  const keep = topList(board, 100);
  board.players = Object.fromEntries(keep.map((p) => [p.playerId, { nickname: p.nickname, score: p.score, ts: p.ts }]));
  await env.KRIDER.put(`lb:${date}`, JSON.stringify(board), { expirationTtl: 86400 * 14 });

  return json({ ok: true, leaderboard: topList(board), totalPlayers: Object.keys(board.players).length }, origin);
}
