// worker/src/stats.js
import { json, rateLimit } from './util.js';
import { taipeiDateStr } from '../../src/shared/daily-pick.js';

const KEYS = { finish: 'stat:rides', crash: 'stat:crashes' };

export async function handleStats(req, env, origin) {
  const [rides, crashes, volume] = await Promise.all(
    ['stat:rides', 'stat:crashes', 'stat:volume'].map(async (k) => parseInt((await env.KRIDER.get(k)) || '0', 10)),
  );
  return json({ rides, crashes, volume }, origin);
}

export async function handleEvent(req, env, origin) {
  const ip = req.headers.get('CF-Connecting-IP') || 'unknown';
  if (!(await rateLimit(env, 'event', ip, 300, taipeiDateStr()))) return json({ error: 'rate limited' }, origin, 429);
  let body;
  try { body = await req.json(); } catch { return json({ error: 'bad json' }, origin, 400); }
  const key = KEYS[body.type];
  if (!key) return json({ error: 'bad type' }, origin, 400);
  // KV 非原子 → 計數為近似值（個人小遊戲可接受）
  const n = parseInt((await env.KRIDER.get(key)) || '0', 10) + 1;
  await env.KRIDER.put(key, String(n));
  // 完賽=獲利了結、摔車=斷頭賣出，都算成交額
  if (Number.isFinite(body.volume) && body.volume > 0 && body.volume < 1e7) {
    const v = parseInt((await env.KRIDER.get('stat:volume')) || '0', 10) + Math.round(body.volume);
    await env.KRIDER.put('stat:volume', String(v));
  }
  return json({ ok: true }, origin);
}
