// worker/src/register.js
// 通用免費活動報名 endpoint;寫入獨立的 registrations 表,不碰 signups。
import { json, rateLimit } from './util.js';
import { taipeiDateStr } from '../../src/shared/daily-pick.js';
import { EMAIL_RE } from './signup.js';

const REGISTER_LIMIT = 10;                 // 每 IP 每日上限(KV 近似限流)
const REGISTER_ROUTE = 'register';
const BATCH_RE = /^[a-z0-9][a-z0-9-]{0,63}$/; // 梯次 slug:小寫字母數字與連字號

const clientIp = (req) => req.headers.get('CF-Connecting-IP') || 'unknown';

// 去標籤、去角括號、trim、截長度;空字串回 ''
const clean = (raw, max) =>
  String(raw || '').replace(/<[^>]*>/g, '').replace(/[<>]/g, '').trim().slice(0, max);

export async function handleRegister(req, env, origin) {
  const ip = clientIp(req);
  if (!(await rateLimit(env, REGISTER_ROUTE, ip, REGISTER_LIMIT, taipeiDateStr()))) {
    return json({ error: 'rate_limited' }, origin, 429);
  }

  let body = {};
  try { body = await req.json(); } catch { /* 空 body 當非法輸入處理 */ }

  // honeypot:真人不會填 company;有值假裝成功、不寫入
  if (body.company) return json({ ok: true, already: false }, origin, 200);

  const name = clean(body.name, 40);
  const email = String(body.email || '').trim().toLowerCase();
  const note = clean(body.note, 500);
  const batch = String(body.batch || '').trim().toLowerCase();

  if (!name) return json({ error: 'bad_name' }, origin, 400);
  if (!EMAIL_RE.test(email) || email.length > 120) return json({ error: 'bad_email' }, origin, 400);
  if (!BATCH_RE.test(batch)) return json({ error: 'bad_batch' }, origin, 400);

  const now = new Date().toISOString();
  try {
    await env.SIGNUPS
      .prepare('INSERT INTO registrations (name, email, note, batch, created_at, ip) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(name, email, note || null, batch, now, ip)
      .run();
    return json({ ok: true, already: false }, origin, 200);
  } catch (e) {
    if (String(e).includes('UNIQUE')) {
      // 同梯已報過:當成功回應,避免洩漏名單並讓前端顯示友善訊息
      return json({ ok: true, already: true }, origin, 200);
    }
    console.error('register db', e);
    return json({ error: 'db_failed' }, origin, 500);
  }
}

// 後台查詢報名名單(沿用 signups 的 ADMIN_TOKEN);可用 ?batch= 篩選單一梯次
export async function handleRegList(req, env, origin) {
  const auth = req.headers.get('Authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!env.ADMIN_TOKEN || bearer !== env.ADMIN_TOKEN) {
    return json({ error: 'unauthorized' }, origin, 401);
  }
  const url = new URL(req.url);
  const batch = String(url.searchParams.get('batch') || '').trim().toLowerCase();
  const stmt = batch
    ? env.SIGNUPS.prepare(
        'SELECT id, name, email, note, batch, created_at FROM registrations WHERE batch = ? ORDER BY id DESC LIMIT 1000'
      ).bind(batch)
    : env.SIGNUPS.prepare(
        'SELECT id, name, email, note, batch, created_at FROM registrations ORDER BY id DESC LIMIT 1000'
      );
  const { results } = await stmt.all();
  return json({ count: results.length, rows: results }, origin, 200);
}
