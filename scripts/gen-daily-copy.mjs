// scripts/gen-daily-copy.mjs — 每日挑戰開場白（今天 + 明天，保留 14 天）
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FEATURED } from '../src/shared/featured-list.js';
import { pickDaily, taipeiDateStr } from '../src/shared/daily-pick.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = join(ROOT, 'public', 'data', 'daily-copy.json');

async function gen(apiKey, date) {
  const { symbol, period } = pickDaily(date, FEATURED);
  const entry = FEATURED.find((f) => f.symbol === symbol);
  const prompt = `今天的股價騎機車遊戲每日挑戰是「${entry.name['zh-TW']}（${symbol}）」近 ${period} 的走勢賽道。
請以 JSON 回覆 {"zh": "...", "en": "..."}：各一句熱血又帶股市幽默的開場白（zh ≤30 字、en ≤20 words），不用 emoji，不捏造具體行情數字。`;
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'llama-3.3-70b-versatile', max_tokens: 150, response_format: { type: 'json_object' }, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`groq ${res.status}`);
  return JSON.parse((await res.json()).choices[0].message.content);
}

const apiKey = process.env.GROQ_API_KEY;
if (!apiKey) { console.log('GROQ_API_KEY not set, skip'); process.exit(0); }
const all = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : {};
const today = taipeiDateStr();
const tomorrow = taipeiDateStr(new Date(Date.now() + 864e5));
for (const date of [today, tomorrow]) {
  if (all[date]) continue;
  try { all[date] = await gen(apiKey, date); console.log(`copy ${date}`); }
  catch (e) { console.error(`skip ${date}: ${e.message}`); }
}
const dates = Object.keys(all).sort().slice(-14);
mkdirSync(dirname(FILE), { recursive: true });
writeFileSync(FILE, JSON.stringify(Object.fromEntries(dates.map((d) => [d, all[d]]))));
