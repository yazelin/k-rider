// scripts/fetch-data.mjs — Node 20，零依賴
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FEATURED } from '../src/shared/featured-list.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'data');
const UA = { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36' };

export function transformChart(raw) {
  const r = raw?.chart?.result?.[0];
  if (!r) return [];
  const ts = r.timestamp || [];
  const cl = r.indicators?.quote?.[0]?.close || [];
  return ts
    .map((t, i) => ({ t: t * 1000, close: cl[i] }))
    .filter((p) => Number.isFinite(p.close))
    .map((p) => ({ t: p.t, close: Math.round(p.close * 100) / 100 }));
}

export function validateDaily(points, symbol, now = Date.now()) {
  if (points.length < 100) return false;
  const staleDays = symbol === 'BTC-USD' ? 3 : 12; // 連假緩衝
  return now - points.at(-1).t < staleDays * 864e5;
}

export function computeMeta(daily, entry) {
  const last252 = daily.slice(-252);
  const rets = [];
  for (let i = 1; i < last252.length; i++) rets.push(Math.log(last252[i].close / last252[i - 1].close));
  const mean = rets.reduce((a, b) => a + b, 0) / (rets.length || 1);
  const sd = Math.sqrt(rets.reduce((a, r) => a + (r - mean) ** 2, 0) / (rets.length || 1));
  const vol = Math.round(sd * Math.sqrt(252) * 1000) / 1000;
  const difficulty = vol < 0.22 ? 'easy' : vol < 0.38 ? 'medium' : vol < 0.6 ? 'hard' : 'insane';
  const changePct = Math.round((last252.at(-1).close / last252[0].close - 1) * 1000) / 10;
  const last63 = daily.slice(-63);
  const changePct3m = Math.round((last63.at(-1).close / last63[0].close - 1) * 1000) / 10;
  // 首頁卡片用的迷你走勢線：近 60 個交易日抽稀到 ~24 點
  const src = last252.slice(-60);
  const step = Math.max(1, Math.ceil(src.length / 24));
  const spark = src.filter((_, i) => i % step === 0).map((p) => p.close);
  if (spark.at(-1) !== src.at(-1).close) spark.push(src.at(-1).close);
  return { ...entry, volatility: vol, difficulty, changePct, changePct3m, lastClose: last252.at(-1).close, spark };
}

export function writeIfChanged(file, obj) {
  const next = JSON.stringify({ ...obj, updated: undefined });
  if (existsSync(file)) {
    const prev = JSON.stringify({ ...JSON.parse(readFileSync(file, 'utf8')), updated: undefined });
    if (prev === next) return false;
  }
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(obj));
  return true;
}

async function fetchChart(fetchFn, symbol, range, interval) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
  const res = await fetchFn(url, { headers: UA });
  if (!res.ok) throw new Error(`${symbol} ${range}/${interval} HTTP ${res.status}`);
  return transformChart(await res.json());
}

export async function run({ fetchFn = fetch, outDir = OUT, now = Date.now() } = {}) {
  const failed = [];
  const metas = [];
  for (const entry of FEATURED) {
    try {
      const daily = await fetchChart(fetchFn, entry.symbol, '5y', '1d');
      if (!validateDaily(daily, entry.symbol, now)) throw new Error('validation failed');
      let intraday5m = [], intraday15m = [];
      try { intraday5m = await fetchChart(fetchFn, entry.symbol, '1d', '5m'); } catch (e) { console.warn(`warn ${entry.symbol} 5m: ${e.message}`); }
      try { intraday15m = await fetchChart(fetchFn, entry.symbol, '5d', '15m'); } catch (e) { console.warn(`warn ${entry.symbol} 15m: ${e.message}`); }
      writeIfChanged(join(outDir, 'tickers', `${entry.symbol}.json`), {
        symbol: entry.symbol, updated: new Date(now).toISOString(), daily, intraday5m, intraday15m,
      });
      metas.push(computeMeta(daily, entry));
      console.log(`ok ${entry.symbol} (${daily.length} pts)`);
    } catch (e) {
      failed.push(entry.symbol);
      console.error(`FAIL ${entry.symbol}: ${e.message}`);
      const prev = join(outDir, 'featured.json');
      if (existsSync(prev)) {
        const old = JSON.parse(readFileSync(prev, 'utf8')).tickers?.find((t) => t.symbol === entry.symbol);
        if (old) metas.push(old);
      }
    }
    await new Promise((r) => setTimeout(r, 500)); // 禮貌間隔
  }
  writeIfChanged(join(outDir, 'featured.json'), { updated: new Date(now).toISOString(), tickers: metas });
  if (failed.length === FEATURED.length) { console.error('all symbols failed'); process.exitCode = 1; }
  return { failed };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await run();
