// worker/src/notes.js
// 投票頁上的三種文字回饋,跟投票共用同一個匿名身分:
//   wish     想聽的不在上面(表單原本的第二題)
//   offer    想來講一場(表單原本的第三題)
//   feedback 某一場講完的心得(節奏 + 最有收穫的一段)
//
// 為什麼跟投票放在同一頁:原本要叫人再去填另一份表單,那一步會流失掉大部分的人。
// 同一個 voter id 貫穿,所以同一個人的票與心得對得起來,而且不必收 email。
//
// 這些內容一律不公開。提案沒有審核機制,公開等於開一個沒人顧的留言板;
// 心得公開的話沒有人會說實話。讀取走 /admin/notes,跟訂閱名單同一套 Bearer。
import { json, rateLimit } from './util.js';

const VOTER_RE = /^[a-z0-9-]{8,64}$/;
const REF_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
const KINDS = ['wish', 'offer', 'feedback'];
const PACE = ['fast', 'ok', 'slow'];
const MAX_TEXT = 500;
const MAX_CONTACT = 60;

const clip = (v, n) => String(v == null ? '' : v).replace(/\s+$/, '').slice(0, n).trim();

export async function handleNote(req, env, origin) {
  let b;
  try { b = await req.json(); } catch { return json({ error: 'bad_json' }, origin, 400); }

  const voter = String(b.voter || '');
  if (!VOTER_RE.test(voter)) return json({ error: 'bad_voter' }, origin, 400);

  const kind = String(b.kind || '');
  if (!KINDS.includes(kind)) return json({ error: 'bad_kind' }, origin, 400);

  const text = clip(b.text, MAX_TEXT);
  const contact = clip(b.contact, MAX_CONTACT);
  const pace = PACE.includes(b.pace) ? b.pace : null;
  const ref = REF_RE.test(String(b.ref || '')) ? String(b.ref) : null;

  if (kind === 'feedback') {
    if (!ref) return json({ error: 'need_ref' }, origin, 400);
    if (!pace && !text) return json({ error: 'need_something' }, origin, 400);
  } else if (!text) {
    return json({ error: 'need_text' }, origin, 400);
  }

  const ip = req.headers.get('cf-connecting-ip') || '0.0.0.0';
  if (!(await rateLimit(env, 'note', ip, 30, new Date().toISOString().slice(0, 10)))) {
    return json({ error: 'rate_limited' }, origin, 429);
  }

  const now = new Date().toISOString();
  const ins = env.SIGNUPS
    .prepare('INSERT INTO vote_notes (voter, kind, ref, pace, text, contact, created_at) VALUES (?1,?2,?3,?4,?5,?6,?7)')
    .bind(voter, kind, ref, pace, text, contact || null, now);

  if (kind === 'feedback') {
    // 一個人一場只留一份心得,改了就覆蓋。先刪再插比在部分索引上做 upsert 好讀。
    await env.SIGNUPS.batch([
      env.SIGNUPS.prepare("DELETE FROM vote_notes WHERE kind='feedback' AND voter=?1 AND ref=?2").bind(voter, ref),
      ins,
    ]);
  } else {
    await ins.run();
  }
  return json({ ok: true }, origin);
}

export async function handleNotesList(req, env, origin) {
  const auth = req.headers.get('Authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!env.ADMIN_TOKEN || bearer !== env.ADMIN_TOKEN) {
    return json({ error: 'unauthorized' }, origin, 401);
  }
  const kind = new URL(req.url).searchParams.get('kind');
  const q = KINDS.includes(kind)
    ? env.SIGNUPS.prepare('SELECT id, voter, kind, ref, pace, text, contact, created_at FROM vote_notes WHERE kind=?1 ORDER BY id DESC LIMIT 500').bind(kind)
    : env.SIGNUPS.prepare('SELECT id, voter, kind, ref, pace, text, contact, created_at FROM vote_notes ORDER BY id DESC LIMIT 500');
  const { results } = await q.all();
  return json({ count: results.length, rows: results }, origin);
}
