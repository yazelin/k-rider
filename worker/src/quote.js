// worker/src/quote.js
import { json, rateLimit } from './util.js';
import { taipeiDateStr } from '../../src/shared/daily-pick.js';

export const SYMBOL_RE = /^[A-Z0-9.\-=^]{1,12}$/;
const RANGES = new Set(['1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y', 'max']);
const INTERVALS = new Set(['5m', '15m', '60m', '1d', '1wk', '1mo']);

function transform(raw) {
  const r = raw?.chart?.result?.[0];
  if (!r) return null;
  const ts = r.timestamp || [];
  const cl = r.indicators?.quote?.[0]?.close || [];
  return ts
    .map((t, i) => ({ t: t * 1000, close: cl[i] }))
    .filter((p) => Number.isFinite(p.close))
    .map((p) => ({ t: p.t, close: Math.round(p.close * 100) / 100 }));
}

export async function handleQuote(req, env, origin) {
  const url = new URL(req.url);
  const symbol = (url.searchParams.get('symbol') || '').toUpperCase();
  const range = url.searchParams.get('range') || '1y';
  const interval = url.searchParams.get('interval') || '1d';
  if (!SYMBOL_RE.test(symbol) || !RANGES.has(range) || !INTERVALS.has(interval)) {
    return json({ error: 'bad params' }, origin, 400);
  }
  const ip = req.headers.get('CF-Connecting-IP') || 'unknown';
  if (!(await rateLimit(env, 'quote', ip, 300, taipeiDateStr()))) return json({ error: 'rate limited' }, origin, 429);

  const target = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
  const cacheKey = new Request(target);
  const cache = globalThis.caches?.default;
  let upstream = cache && (await cache.match(cacheKey));
  if (!upstream) {
    upstream = await fetch(target, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!upstream.ok) return json({ error: `upstream ${upstream.status}` }, origin, 502);
    const ttl = interval === '1d' || interval === '1wk' || interval === '1mo' ? 3600 : 300;
    upstream = new Response(upstream.body, upstream);
    upstream.headers.set('Cache-Control', `s-maxage=${ttl}`);
    if (cache) await cache.put(cacheKey, upstream.clone());
  }
  const points = transform(await upstream.json());
  if (!points || points.length === 0) return json({ error: 'no data' }, origin, 404);
  return json(points, origin);
}
