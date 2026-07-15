// worker/src/signup.js
import { json, rateLimit } from './util.js';
import { taipeiDateStr } from '../../src/shared/daily-pick.js';

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const SIGNUP_LIMIT = 6;           // 每 IP 每日上限(KV 近似限流)
const SIGNUP_ROUTE = 'signup';

const clientIp = (req) => req.headers.get('CF-Connecting-IP') || 'unknown';
const gift = (env) => ({ url: env.GIFT_URL, label: '打開 K-Rider 拆解手冊' });

export async function handleSignup(req, env, origin) {
  const ip = clientIp(req);
  if (!(await rateLimit(env, SIGNUP_ROUTE, ip, SIGNUP_LIMIT, taipeiDateStr()))) {
    return json({ error: 'rate_limited' }, origin, 429);
  }

  let body = {};
  try { body = await req.json(); } catch { /* 空 body 當非法 email 處理 */ }

  // honeypot:真人不會填 company;有值假裝成功、不寫入
  if (body.company) return json({ ok: true, already: false, gift: gift(env) }, origin, 200);

  const email = String(body.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 120) {
    return json({ error: 'bad_email' }, origin, 400);
  }
  const source = ['result', 'about', 'home', 'blog', 'post'].includes(body.source) ? body.source : null;
  const now = new Date().toISOString();

  try {
    await env.SIGNUPS
      .prepare('INSERT INTO signups (email, created_at, source, ip) VALUES (?, ?, ?, ?)')
      .bind(email, now, source, ip)
      .run();
    return json({ ok: true, already: false, gift: gift(env) }, origin, 200);
  } catch (e) {
    if (String(e).includes('UNIQUE')) {
      return json({ ok: true, already: true, gift: gift(env) }, origin, 200);
    }
    console.error('signup db', e);
    return json({ error: 'db_failed' }, origin, 500);
  }
}

export async function handleList(req, env, origin) {
  const auth = req.headers.get('Authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!env.ADMIN_TOKEN || bearer !== env.ADMIN_TOKEN) {
    return json({ error: 'unauthorized' }, origin, 401);
  }
  const { results } = await env.SIGNUPS
    .prepare('SELECT id, email, created_at, source FROM signups ORDER BY id DESC LIMIT 500')
    .all();
  return json({ count: results.length, rows: results }, origin, 200);
}
