// worker/src/vote.js
// 週三直播主題投票。取代 Google 表單。
//
// 為什麼不用 Google 表單:要的是「一份會活著的偏好清單」——每個人有自己的一份、
// 隨時可以改、講過的主題自動下架。表單做不到最後兩件:
// 編輯連結只出現在提交後的確認畫面,關掉就找不回來(除非收 email,那會抬高門檻);
// 而刪掉講過的選項之後,舊回覆的統計會跟著錯亂。
//
// 這裡的資料模型就是「一人一列」:改答案等於覆寫自己那一列,不會產生第二筆票。
// 身分是前端產的匿名 id 存在 localStorage,不收 email、不設 cookie、不存 IP。
// 清掉瀏覽器資料就換一個身分,那就重複投——跟原本的表單一樣沒有防線,不值得為它收個資。
import { corsHeaders, json, rateLimit } from './util.js';

const VOTER_RE = /^[a-z0-9-]{8,64}$/;
const TOPIC_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
export const MAX_PICKS = 3;   // 限選三項才問得出優先序;不限制的話兩成的人會全部勾滿

const UPSERT = `INSERT INTO topic_votes (voter, topics, updated_at) VALUES (?1, ?2, ?3)
                ON CONFLICT(voter) DO UPDATE SET topics = ?2, updated_at = ?3`;

// ponytail: 全表掃描算票。幾千個投票人以內都不用管;真的長到那個量再開一張計數表。
async function snapshot(env, voter) {
  const { results } = await env.SIGNUPS.prepare('SELECT voter, topics FROM topic_votes').all();
  const tally = {};
  let mine = [];
  for (const row of results || []) {
    let picks;
    try { picks = JSON.parse(row.topics); } catch { continue; }
    if (!Array.isArray(picks)) continue;
    if (row.voter === voter) mine = picks;
    for (const t of picks) tally[t] = (tally[t] || 0) + 1;
  }
  return { mine, tally, voters: (results || []).length, max: MAX_PICKS };
}

export async function handleVoteGet(req, env, origin) {
  const voter = String(new URL(req.url).searchParams.get('voter') || '');
  return json(await snapshot(env, VOTER_RE.test(voter) ? voter : ''), origin);
}

export async function handleVotePost(req, env, origin) {
  let body;
  try { body = await req.json(); } catch { return json({ error: 'bad_json' }, origin, 400); }

  const voter = String(body.voter || '');
  if (!VOTER_RE.test(voter)) return json({ error: 'bad_voter' }, origin, 400);

  const raw = Array.isArray(body.topics) ? body.topics : [];
  // 去重之後才數,免得送 ['a','a','a'] 佔掉三格
  const topics = [...new Set(raw.map(String))].filter((t) => TOPIC_RE.test(t));
  if (topics.length > MAX_PICKS) return json({ error: 'too_many', max: MAX_PICKS }, origin, 400);

  const ip = req.headers.get('cf-connecting-ip') || '0.0.0.0';
  const day = new Date().toISOString().slice(0, 10);
  // 同一個 IP 一天改 200 次已經不是在投票了
  if (!(await rateLimit(env, 'vote', ip, 200, day))) return json({ error: 'rate_limited' }, origin, 429);

  await env.SIGNUPS.prepare(UPSERT).bind(voter, JSON.stringify(topics), new Date().toISOString()).run();
  return json(await snapshot(env, voter), origin);
}

export const voteCors = (origin) => new Response(null, { headers: corsHeaders(origin) });
