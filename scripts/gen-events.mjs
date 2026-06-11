// scripts/gen-events.mjs — 大波動日 AI 路牌，增量生成
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FEATURED } from '../src/shared/featured-list.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'public', 'data');
const PER_RUN_LIMIT = 12; // 每次最多生成 12 則，控成本

export function bigMoveDates(daily, thresholdPct) {
  const out = [];
  for (let i = 1; i < daily.length; i++) {
    const pct = (daily[i].close / daily[i - 1].close - 1) * 100;
    if (Math.abs(pct) >= thresholdPct) {
      out.push({ date: new Date(daily[i].t).toISOString().slice(0, 10), pct: Math.round(pct * 10) / 10 });
    }
  }
  return out;
}

export const missingDates = (hits, existing) => hits.filter((h) => !existing[h.date]);

async function askGroq(apiKey, entry, hit) {
  const prompt = `${hit.date} 這天，${entry.name['zh-TW']}（${entry.symbol}）股價單日${hit.pct > 0 ? '大漲' : '大跌'} ${Math.abs(hit.pct)}%。
請以 JSON 回覆 {"zh": "...", "en": "..."}：zh 是繁體中文一句話（≤40 字）說明當天市場最可能的背景，en 是對應英文（≤25 words）。
重要：若你不確定當天的具體事件，就描述當時的大盤環境或該產業氛圍，絕對不要捏造具體新聞事件、人名或數字。不用 emoji。`;
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 200,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`groq ${res.status}`);
  const parsed = JSON.parse((await res.json()).choices[0].message.content);
  if (!parsed.zh || !parsed.en) throw new Error('bad llm json');
  return { zh: parsed.zh, en: parsed.en, pct: hit.pct };
}

export async function run({ apiKey = process.env.GROQ_API_KEY, dataDir = DATA } = {}) {
  if (!apiKey) { console.log('GROQ_API_KEY not set, skip'); return; }
  let budget = PER_RUN_LIMIT;
  for (const entry of FEATURED) {
    if (budget <= 0) break;
    const tickerFile = join(dataDir, 'tickers', `${entry.symbol}.json`);
    if (!existsSync(tickerFile)) continue;
    const { daily } = JSON.parse(readFileSync(tickerFile, 'utf8'));
    const threshold = ['SPY', '0050.TW'].includes(entry.symbol) ? 3 : 5;
    const eventFile = join(dataDir, 'events', `${entry.symbol}.json`);
    const existing = existsSync(eventFile) ? JSON.parse(readFileSync(eventFile, 'utf8')).events : {};
    for (const hit of missingDates(bigMoveDates(daily, threshold), existing)) {
      if (budget-- <= 0) break;
      try {
        existing[hit.date] = await askGroq(apiKey, entry, hit);
        console.log(`event ${entry.symbol} ${hit.date} (${hit.pct}%)`);
      } catch (e) { console.error(`skip ${entry.symbol} ${hit.date}: ${e.message}`); }
    }
    mkdirSync(dirname(eventFile), { recursive: true });
    writeFileSync(eventFile, JSON.stringify({ events: existing }));
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await run();
