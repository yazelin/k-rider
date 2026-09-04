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

// 「你用 AI 到什麼程度」。刻意做成複選的工具清單而不是自評分級:
// 人對自己的程度判斷很不準,但「你用過 Suno 嗎」一秒就答得出來。
// 照深度排,勾到哪裡就是程度。存在同一列,所以「程度 x 想聽什麼」是一句 SQL。
export const USE_KEYS = ['chat', 'media', 'agent', 'build'];

// 對「已經講過的場次」按愛心。一人一場一顆,再按取消。存同一列,
// 所以「按過哪幾場愛心的人接下來想聽什麼」也是一句 SQL。

const UPSERT_TOPICS = `INSERT INTO topic_votes (voter, topics, uses, updated_at) VALUES (?1, ?2, '[]', ?3)
                       ON CONFLICT(voter) DO UPDATE SET topics = ?2, updated_at = ?3`;
const UPSERT_USES = `INSERT INTO topic_votes (voter, topics, uses, updated_at) VALUES (?1, '[]', ?2, ?3)
                     ON CONFLICT(voter) DO UPDATE SET uses = ?2, updated_at = ?3`;
const UPSERT_LIKES = `INSERT INTO topic_votes (voter, topics, likes, updated_at) VALUES (?1, '[]', ?2, ?3)
                      ON CONFLICT(voter) DO UPDATE SET likes = ?2, updated_at = ?3`;

// ponytail: 全表掃描算票。幾千個投票人以內都不用管;真的長到那個量再開一張計數表。
async function snapshot(env, voter) {
  const { results } = await env.SIGNUPS.prepare('SELECT voter, topics, uses, likes FROM topic_votes').all();
  const tally = {};
  const useCounts = {};
  const likeCounts = {};
  let mine = [];
  let myUses = [];
  let myLikes = [];
  let voters = 0;   // 只數真的還有票在上面的人:投完又全部取消的不算
  let answered = 0; // 回答過「用 AI 到什麼程度」的人數
  for (const row of results || []) {
    let picks = [];
    try { picks = JSON.parse(row.topics); } catch { picks = []; }
    if (!Array.isArray(picks)) picks = [];
    let uses = [];
    try { uses = row.uses ? JSON.parse(row.uses) : []; } catch { uses = []; }
    if (!Array.isArray(uses)) uses = [];
    let likes = [];
    try { likes = row.likes ? JSON.parse(row.likes) : []; } catch { likes = []; }
    if (!Array.isArray(likes)) likes = [];

    if (row.voter === voter) { mine = picks; myUses = uses; myLikes = likes; }
    for (const l of likes) likeCounts[l] = (likeCounts[l] || 0) + 1;
    if (picks.length) {
      voters += 1;
      for (const t of picks) tally[t] = (tally[t] || 0) + 1;
    }
    if (uses.length) {
      answered += 1;
      for (const u of uses) useCounts[u] = (useCounts[u] || 0) + 1;
    }
  }
  return { mine, tally, voters, uses: myUses, useCounts, answered,
           likes: myLikes, likeCounts, max: MAX_PICKS };
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

  const hasTopics = Array.isArray(body.topics);
  const hasUses = Array.isArray(body.uses);
  const hasLikes = Array.isArray(body.likes);
  if (!hasTopics && !hasUses && !hasLikes) return json({ error: 'nothing_to_save' }, origin, 400);

  // 去重之後才數,免得送 ['a','a','a'] 佔掉三格
  const topics = hasTopics ? [...new Set(body.topics.map(String))].filter((t) => TOPIC_RE.test(t)) : null;
  if (topics && topics.length > MAX_PICKS) return json({ error: 'too_many', max: MAX_PICKS }, origin, 400);
  const uses = hasUses ? [...new Set(body.uses.map(String))].filter((u) => USE_KEYS.includes(u)) : null;
  // 愛心按的是場次 slug,場次清單在前端,這裡只驗格式
  const likes = hasLikes ? [...new Set(body.likes.map(String))].filter((l) => TOPIC_RE.test(l)).slice(0, 60) : null;

  const ip = req.headers.get('cf-connecting-ip') || '0.0.0.0';
  const day = new Date().toISOString().slice(0, 10);
  // 同一個 IP 一天改 200 次已經不是在投票了
  if (!(await rateLimit(env, 'vote', ip, 200, day))) return json({ error: 'rate_limited' }, origin, 429);

  const now = new Date().toISOString();
  // 票與程度分開寫,才不會存其中一個的時候把另一個洗掉
  if (topics) await env.SIGNUPS.prepare(UPSERT_TOPICS).bind(voter, JSON.stringify(topics), now).run();
  if (uses) await env.SIGNUPS.prepare(UPSERT_USES).bind(voter, JSON.stringify(uses), now).run();
  if (likes) await env.SIGNUPS.prepare(UPSERT_LIKES).bind(voter, JSON.stringify(likes), now).run();
  return json(await snapshot(env, voter), origin);
}

export const voteCors = (origin) => new Response(null, { headers: corsHeaders(origin) });
