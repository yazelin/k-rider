// worker/src/roast.js
import { json, rateLimit } from './util.js';
import { taipeiDateStr } from '../../src/shared/daily-pick.js';

export const bucketOf = (score) => Math.min(9, Math.floor(Math.max(0, score) / 30000));

const PROMPTS = {
  'zh-TW': (p) => `你是毒舌但幽默的賽車播報員。玩家在「${p.symbol} ${p.period}」股價賽道騎機車，${p.stats.finished ? '完賽' : '中途摔車'}，得分 ${p.score}，空翻 ${p.stats.flips || 0} 次。用繁體中文嘴他一句（不超過 40 字，股市梗加分，不用 emoji，只回那一句話）。`,
  en: (p) => `You are a snarky race commentator. Player rode the "${p.symbol} ${p.period}" stock-chart track, ${p.stats.finished ? 'finished' : 'crashed mid-ride'}, score ${p.score}, ${p.stats.flips || 0} flips. Roast them in one English sentence (max 25 words, stock-market jokes welcome, no emoji, reply with the sentence only).`,
};

export async function handleRoast(request, env, origin) {
  let p;
  try { p = await request.json(); } catch { return json({ error: 'bad json' }, origin, 400); }

  const lang = p.lang === 'en' ? 'en' : 'zh-TW';

  if (!env.GROQ_API_KEY) return json({ line: null }, origin);

  // Security: cap user-supplied strings to prevent KV key bloat / prompt injection size
  const symbol = String(p.symbol || '').slice(0, 12);
  const period = String(p.period || '').slice(0, 4);

  const key = `roast:${symbol}:${period}:${lang}:${bucketOf(p.score)}:${p.stats?.finished ? 'f' : 'c'}`;
  const cached = await env.KRIDER.get(key);
  if (cached) return json({ line: cached }, origin);

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (!(await rateLimit(env, 'roast', ip, 20, taipeiDateStr()))) return json({ line: null }, origin);

  // Build a sanitized payload for the prompt
  const promptParams = { ...p, symbol, period };

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 100,
        messages: [{ role: 'user', content: PROMPTS[lang](promptParams) }],
      }),
    });
    if (!res.ok) throw new Error(`groq ${res.status}`);
    const line = (await res.json()).choices?.[0]?.message?.content
      ?.trim()
      ?.replace(/^["「]|["」]$/g, '') || null;
    if (line) await env.KRIDER.put(key, line, { expirationTtl: 604800 });
    return json({ line }, origin);
  } catch {
    return json({ line: null }, origin); // 前端退罐頭句
  }
}
