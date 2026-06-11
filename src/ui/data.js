// src/ui/data.js
import { FEATURED } from '../shared/featured-list.js';
import { WORKER_URL } from '../config.js';

const BASE = import.meta.env.BASE_URL; // '/k-rider/'
const cache = new Map();

export async function loadTicker(symbol) {
  if (cache.has(symbol)) return cache.get(symbol);
  let data;
  if (FEATURED.some((f) => f.symbol === symbol)) {
    const res = await fetch(`${BASE}data/tickers/${symbol}.json`);
    if (!res.ok) throw new Error(`no data for ${symbol}`);
    data = await res.json();
  } else {
    const res = await fetch(`${WORKER_URL}/quote?symbol=${encodeURIComponent(symbol)}&range=5y&interval=1d`);
    if (!res.ok) throw new Error(`quote failed: ${res.status}`);
    const daily = await res.json();
    let intraday5m = [], intraday15m = [];
    try {
      const r5 = await fetch(`${WORKER_URL}/quote?symbol=${encodeURIComponent(symbol)}&range=1d&interval=5m`);
      if (r5.ok) intraday5m = await r5.json();
      const r15 = await fetch(`${WORKER_URL}/quote?symbol=${encodeURIComponent(symbol)}&range=5d&interval=15m`);
      if (r15.ok) intraday15m = await r15.json();
    } catch { /* 盤中資料可缺 */ }
    data = { symbol, daily, intraday5m, intraday15m };
  }
  cache.set(symbol, data);
  return data;
}

export async function loadJson(path, fallback = null) {
  try {
    const res = await fetch(`${BASE}${path}`);
    return res.ok ? await res.json() : fallback;
  } catch { return fallback; }
}
