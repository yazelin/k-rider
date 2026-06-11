// worker/src/daily.js
import { json } from './util.js';
import { pickDaily, taipeiDateStr } from '../../src/shared/daily-pick.js';
import { FEATURED } from '../../src/shared/featured-list.js';

export async function loadBoard(env, date) {
  const raw = await env.KRIDER.get(`lb:${date}`);
  return raw ? JSON.parse(raw) : { players: {} };
}

export function topList(board, n = 10) {
  return Object.entries(board.players)
    .map(([playerId, p]) => ({ playerId, ...p }))
    .sort((a, b) => b.score - a.score)
    .slice(0, n);
}

export async function handleDaily(req, env, origin) {
  const date = taipeiDateStr();
  const { symbol, period } = pickDaily(date, FEATURED);
  const board = await loadBoard(env, date);
  return json({
    symbol, period, date,
    leaderboard: topList(board),
    totalPlayers: Object.keys(board.players).length,
  }, origin);
}
