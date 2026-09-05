// worker/src/live.js
// 現場共同創作用的即時投票。跟主題投票(vote.js)是兩回事:
// 那個是長期的偏好清單,這個是「這一題,現在,選一個」,講者推題、大家投、當場關票。
//
// 為什麼不是留言投票:群眾共同創作要能繼續往下走,就必須有人按下「就這個」。
// 所以主持人能關票、關票的那一刻結果凍結,故事才走得下去。
//
// 提議在該題開著的時候公開(共同創作的重點就是看見彼此的點子),關票就收起來。
// 主持人手上有刪除,那是唯一的審核機制,靠的是他人在現場。
import { json, rateLimit } from './util.js';

const VOTER_RE = /^[a-z0-9-]{8,64}$/;
const EVENT_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
const MAX_OPTIONS = 4;
const MAX_Q = 120;
const MAX_OPT = 40;
const MAX_IDEA = 200;

const auth = (req, env) => {
  const a = req.headers.get('Authorization') || '';
  return !!env.ADMIN_TOKEN && a.startsWith('Bearer ') && a.slice(7) === env.ADMIN_TOKEN;
};
const clip = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);

// 一場只有一題是開著的。回目前那題(沒有就回最後關掉的那題,給簡報顯示結果用)。
async function currentRound(env, event) {
  return await env.SIGNUPS
    .prepare(`SELECT * FROM live_rounds WHERE event=?1 ORDER BY (state='open') DESC, seq DESC LIMIT 1`)
    .bind(event).first();
}

async function snapshot(env, event, voter, wantIdeas) {
  const r = await currentRound(env, event);
  if (!r) return { round: null, decided: await decided(env, event) };

  let opts = [];
  try { opts = JSON.parse(r.options); } catch { opts = []; }

  const { results } = await env.SIGNUPS
    .prepare('SELECT voter, choice FROM live_votes WHERE round_id=?1').bind(r.id).all();
  const tally = opts.map(() => 0);
  let mine = null;
  for (const v of results || []) {
    if (v.choice >= 0 && v.choice < tally.length) tally[v.choice] += 1;
    if (v.voter === voter) mine = v.choice;
  }

  let ideas = [];
  if (wantIdeas || r.state === 'open') {
    const q = await env.SIGNUPS
      .prepare(`SELECT id, text FROM vote_notes WHERE kind='idea' AND ref=?1 ORDER BY id DESC LIMIT 30`)
      .bind(r.id).all();
    ideas = (q.results || []).map((x) => ({ id: x.id, text: x.text }));
  }

  return {
    round: { id: r.id, seq: r.seq, question: r.question, options: opts, state: r.state, winner: r.winner },
    tally, mine, voters: (results || []).length, ideas,
    decided: await decided(env, event),
  };
}

// 已經定案的每一題,給簡報回顧整條故事怎麼被決定的
async function decided(env, event) {
  const { results } = await env.SIGNUPS
    .prepare(`SELECT seq, question, options, winner FROM live_rounds
              WHERE event=?1 AND state='closed' AND winner IS NOT NULL ORDER BY seq`)
    .bind(event).all();
  return (results || []).map((r) => {
    let o = []; try { o = JSON.parse(r.options); } catch {}
    return { seq: r.seq, question: r.question, answer: o[r.winner] ?? '' };
  });
}

export async function handleLiveGet(req, env, origin) {
  const u = new URL(req.url);
  const event = String(u.searchParams.get('e') || '');
  if (!EVENT_RE.test(event)) return json({ error: 'bad_event' }, origin, 400);
  const voter = String(u.searchParams.get('voter') || '');
  return json(await snapshot(env, event, VOTER_RE.test(voter) ? voter : '', auth(req, env)), origin);
}

export async function handleLivePost(req, env, origin) {
  let b; try { b = await req.json(); } catch { return json({ error: 'bad_json' }, origin, 400); }
  const voter = String(b.voter || '');
  if (!VOTER_RE.test(voter)) return json({ error: 'bad_voter' }, origin, 400);
  const event = String(b.event || '');
  if (!EVENT_RE.test(event)) return json({ error: 'bad_event' }, origin, 400);

  const ip = req.headers.get('cf-connecting-ip') || '0.0.0.0';
  if (!(await rateLimit(env, 'live', ip, 400, new Date().toISOString().slice(0, 10)))) {
    return json({ error: 'rate_limited' }, origin, 429);
  }

  const r = await currentRound(env, event);
  if (!r || r.state !== 'open') return json({ error: 'no_open_round' }, origin, 409);

  if (b.action === 'idea') {
    const t = clip(b.text, MAX_IDEA);
    if (!t) return json({ error: 'need_text' }, origin, 400);
    await env.SIGNUPS
      .prepare(`INSERT INTO vote_notes (voter, kind, ref, text, created_at) VALUES (?1,'idea',?2,?3,?4)`)
      .bind(voter, r.id, t, new Date().toISOString()).run();
  } else {
    let opts = []; try { opts = JSON.parse(r.options); } catch {}
    const c = Number(b.choice);
    if (!Number.isInteger(c) || c < 0 || c >= opts.length) return json({ error: 'bad_choice' }, origin, 400);
    // 一人一票,關票前可以改
    await env.SIGNUPS
      .prepare(`INSERT INTO live_votes (round_id, voter, choice) VALUES (?1,?2,?3)
                ON CONFLICT(round_id, voter) DO UPDATE SET choice=?3`)
      .bind(r.id, voter, c).run();
  }
  return json(await snapshot(env, event, voter, false), origin);
}

export async function handleLiveAdmin(req, env, origin) {
  if (!auth(req, env)) return json({ error: 'unauthorized' }, origin, 401);
  let b; try { b = await req.json(); } catch { return json({ error: 'bad_json' }, origin, 400); }
  const event = String(b.event || '');
  if (!EVENT_RE.test(event)) return json({ error: 'bad_event' }, origin, 400);
  const now = new Date().toISOString();

  if (b.action === 'push') {
    const question = clip(b.question, MAX_Q);
    const options = (Array.isArray(b.options) ? b.options : []).map((o) => clip(o, MAX_OPT)).filter(Boolean).slice(0, MAX_OPTIONS);
    if (!question || options.length < 2) return json({ error: 'need_question_and_2_options' }, origin, 400);
    // 推新題等於把上一題關掉,現場不會有兩題同時開著
    await env.SIGNUPS.prepare(`UPDATE live_rounds SET state='closed' WHERE event=?1 AND state='open'`).bind(event).run();
    const row = await env.SIGNUPS.prepare('SELECT MAX(seq) AS m FROM live_rounds WHERE event=?1').bind(event).first();
    const seq = (row && row.m ? row.m : 0) + 1;
    await env.SIGNUPS
      .prepare(`INSERT INTO live_rounds (id, event, seq, question, options, state, created_at)
                VALUES (?1,?2,?3,?4,?5,'open',?6)`)
      .bind(`${event}-r${seq}`, event, seq, question, JSON.stringify(options), now).run();
  } else if (b.action === 'close') {
    const r = await currentRound(env, event);
    if (!r || r.state !== 'open') return json({ error: 'no_open_round' }, origin, 409);
    // 關票的時候把當下票數最高的那個凍結成答案。同票取先出現的那個。
    let opts = []; try { opts = JSON.parse(r.options); } catch {}
    const { results } = await env.SIGNUPS.prepare('SELECT choice FROM live_votes WHERE round_id=?1').bind(r.id).all();
    const t = opts.map(() => 0);
    for (const v of results || []) if (v.choice >= 0 && v.choice < t.length) t[v.choice] += 1;
    let win = 0;
    for (let i = 1; i < t.length; i++) if (t[i] > t[win]) win = i;
    await env.SIGNUPS.prepare(`UPDATE live_rounds SET state='closed', winner=?2 WHERE id=?1`).bind(r.id, win).run();
  } else if (b.action === 'drop_idea') {
    await env.SIGNUPS.prepare(`DELETE FROM vote_notes WHERE kind='idea' AND id=?1`).bind(Number(b.id)).run();
  } else if (b.action === 'reset') {
    // 彩排完清乾淨用
    await env.SIGNUPS.batch([
      env.SIGNUPS.prepare(`DELETE FROM live_votes WHERE round_id IN (SELECT id FROM live_rounds WHERE event=?1)`).bind(event),
      env.SIGNUPS.prepare(`DELETE FROM vote_notes WHERE kind='idea' AND ref LIKE ?1`).bind(event + '-r%'),
      env.SIGNUPS.prepare('DELETE FROM live_rounds WHERE event=?1').bind(event),
    ]);
  } else {
    return json({ error: 'bad_action' }, origin, 400);
  }
  return json(await snapshot(env, event, '', true), origin);
}
