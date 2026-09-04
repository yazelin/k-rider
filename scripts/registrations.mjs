#!/usr/bin/env node
// 查活動報名／回饋名單（D1 registrations，報名與回饋都在這張表，用 batch 區分），
// 以及訂閱名單（D1 signups，blog／首頁等留資點，用 source 區分）。
//   node scripts/registrations.mjs                              列出所有 batch 與筆數
//   node scripts/registrations.mjs sticker-2026-08-05-feedback  看某個 batch 的每一筆內容
//   node scripts/registrations.mjs --signups                    看訂閱名單（signups 表）
//   node scripts/registrations.mjs --vote                       看投票結果：票數、程度分佈、愛心、交叉
//   node scripts/registrations.mjs --notes                      看週三直播投票頁送上來的回饋
//   node scripts/registrations.mjs --notes wish|offer|feedback   只看其中一種
//   加 --all                                                    連 honeypot 標記的可疑筆數一起看
// 時間一律轉台北時間顯示（D1 存的是 UTC）。
// flagged=1 是 honeypot 命中：Worker 照收不擋（擋錯會讓真人靜靜掉出名單），由這裡濾掉。
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const worker = join(dirname(fileURLToPath(import.meta.url)), '..', 'worker');
const args = process.argv.slice(2);
const showAll = args.includes('--all');
const signups = args.includes('--signups');
const notes = args.includes('--notes');
const vote = args.includes('--vote');
const batch = args.find((a) => !a.startsWith('--'));
// batch 直接進 SQL，所以只收 slug 字元（這支是本機 CLI，但沒理由留個洞）
const KINDS = ['wish', 'offer', 'feedback'];
if (notes && batch && !KINDS.includes(batch)) {
  console.error(`--notes 後面只能接 ${KINDS.join(' / ')}，收到：${batch}`);
  process.exit(1);
}
if (!notes && batch && !/^[a-z0-9-]+$/.test(batch)) {
  console.error(`batch 只能是小寫英數與 -，收到：${batch}`);
  process.exit(1);
}

const skipFlagged = showAll ? '' : ' AND flagged=0';
const sql = vote
  ? `SELECT voter, topics, uses, likes FROM topic_votes`
  : notes
  ? `SELECT id,voter,kind,ref,pace,text,contact,created_at FROM vote_notes${batch ? ` WHERE kind='${batch}'` : ''} ORDER BY id DESC`
  : signups
  ? `SELECT id,email,source,created_at,flagged FROM signups WHERE 1=1${skipFlagged} ORDER BY created_at`
  : batch
    ? `SELECT id,name,email,note,created_at,flagged FROM registrations WHERE batch='${batch}'${skipFlagged} ORDER BY created_at`
    : `SELECT batch, COUNT(*) AS n, SUM(flagged) AS flagged, MAX(created_at) AS latest FROM registrations GROUP BY batch ORDER BY latest DESC`;

const raw = execFileSync('npx', ['wrangler', 'd1', 'execute', 'k-rider-signups', '--remote', '--json', '--command', sql], {
  cwd: worker,
  encoding: 'utf8',
  maxBuffer: 32 * 1024 * 1024,
});
const rows = JSON.parse(raw.slice(raw.indexOf('[')))[0].results;

// 中文在終端機是雙寬,padEnd 數字元會讓欄位歪掉。這支只在 --vote 的表格裡用。
const W_RE = /[\u1100-\u115F\u2E80-\uA4CF\uA960-\uA97F\uAC00-\uD7A3\uF900-\uFAFF\uFE10-\uFE19\uFE30-\uFE6F\uFF00-\uFF60\uFFE0-\uFFE6]/;
const dispW = (s) => [...String(s)].reduce((n, c) => n + (W_RE.test(c) ? 2 : 1), 0);
const padR = (s, w) => String(s) + ' '.repeat(Math.max(0, w - dispW(s)));
const padL = (s, w) => ' '.repeat(Math.max(0, w - dispW(s))) + String(s);

const tpe = (iso) =>
  new Date(iso).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false, dateStyle: 'short', timeStyle: 'short' });

if (vote) {
  // 主題與場次的中文名在前端的 vote/topics.js，這裡讀得到就用，讀不到就印 slug。
  // 兩個 repo 用路徑相依很脆，所以是「有就更好看」而不是「沒有就不能跑」。
  const names = {};
  try {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(join(process.env.HOME || '~', 'yazelin.github.io/vote/topics.js'), 'utf8');
    for (const m of src.matchAll(/slug:\s*'([^']+)'[^}]*?title:\s*'([^']+)'/g)) names[m[1]] = m[2];
    for (const m of src.matchAll(/key:\s*'([^']+)'[^}]*?title:\s*'([^']+)'/g)) names[m[1]] = m[2];
  } catch { /* 沒有就用 slug */ }
  const nm = (k) => names[k] || k;

  const USE_ORDER = ['chat', 'media', 'agent', 'build'];
  const parse = (v) => { try { const a = JSON.parse(v || '[]'); return Array.isArray(a) ? a : []; } catch { return []; } };
  const people = rows.map((r) => ({ topics: parse(r.topics), uses: parse(r.uses), likes: parse(r.likes) }));

  const voters = people.filter((p) => p.topics.length).length;
  const answered = people.filter((p) => p.uses.length).length;
  console.log(`週三直播投票　${voters} 人投過、${answered} 人回答過程度、共 ${people.length} 筆\n`);

  const count = (pick) => {
    const c = {};
    for (const p of people) for (const k of pick(p)) c[k] = (c[k] || 0) + 1;
    return Object.entries(c).sort((a, b) => b[1] - a[1]);
  };
  const bar = (n, max) => '█'.repeat(Math.round((n / (max || 1)) * 22));

  const topics = count((p) => p.topics);
  if (topics.length) {
    const max = topics[0][1];
    console.log('票數排行');
    topics.forEach(([k, n], i) => console.log(`  ${padL(i + 1, 2)} ${padR(nm(k), 22)} ${padL(n, 3)}  ${bar(n, max)}`));
    console.log('');
  }

  if (answered) {
    console.log(`用 AI 到什麼程度（${answered} 人回答，複選）`);
    for (const k of USE_ORDER) {
      const n = people.filter((p) => p.uses.includes(k)).length;
      console.log(`  ${padR(nm(k), 22)} ${padL(n, 3)}  ${padL(Math.round(n / answered * 100), 3)}%  ${bar(n, answered)}`);
    }
    console.log('');
  }

  const likes = count((p) => p.likes);
  if (likes.length) {
    console.log('已講場次的愛心');
    likes.forEach(([k, n]) => console.log(`  ${padR(nm(k), 26)} ${padL(n, 3)}`));
    console.log('');
  }

  // 這張表才是這個功能的目的：深度使用者跟入門者想聽的不一樣，講深講淺才有依據。
  const deep = people.filter((p) => p.uses.includes('agent') || p.uses.includes('build'));
  const shallow = people.filter((p) => p.uses.length && !p.uses.includes('agent') && !p.uses.includes('build'));
  if (deep.length || shallow.length) {
    const tallyOf = (g) => { const c = {}; for (const p of g) for (const t of p.topics) c[t] = (c[t] || 0) + 1; return c; };
    const d = tallyOf(deep), sh = tallyOf(shallow);
    const keys = [...new Set([...Object.keys(d), ...Object.keys(sh)])]
      .sort((a, b) => ((d[b] || 0) + (sh[b] || 0)) - ((d[a] || 0) + (sh[a] || 0)));
    console.log(`程度 × 想聽什麼　（會 agent 的 ${deep.length} 人 ／ 只到生圖聊天的 ${shallow.length} 人）`);
    console.log(`  ${padR('主題', 22)} ${padL('會 agent', 9)} ${padL('入門', 7)}`);
    for (const k of keys) console.log(`  ${padR(nm(k), 22)} ${padL(d[k] || 0, 9)} ${padL(sh[k] || 0, 7)}`);
    console.log('');
  }
  if (!people.length) console.log('（還沒有人投）\n');
} else if (notes) {
  // 投票頁的三種文字回饋。voter 是匿名碼，只印前 6 碼用來認「同一個人」，不必看全。
  const NAME = { wish: '想聽這個', offer: '想來講　', feedback: '心得　　' };
  const PACE = { fast: '節奏太快', ok: '節奏剛好', slow: '節奏太慢' };
  console.log(`投票頁回饋　共 ${rows.length} 筆${batch ? `（只看 ${NAME[batch].trim()}）` : ''}\n`);
  if (!rows.length) console.log('（還沒有人送過）\n');
  for (const r of rows) {
    const who = String(r.voter || '').slice(0, 6);
    const tag = [NAME[r.kind] || r.kind, r.ref, PACE[r.pace]].filter(Boolean).join('　');
    console.log(`#${String(r.id).padEnd(4)}${tpe(r.created_at)}　${tag}　［${who}］`);
    if (r.text) console.log(r.text.split('\n').map((l) => '    ' + l).join('\n'));
    if (r.contact) console.log(`    怎麼找他：${r.contact}`);
    console.log('');
  }
  console.log('只看一種：--notes wish / --notes offer / --notes feedback');
} else if (signups) {
  console.log(`訂閱名單（signups）　共 ${rows.length} 筆${showAll ? '（含 honeypot 標記）' : '（已濾掉 honeypot 標記，加 --all 看全部）'}\n`);
  for (const r of rows) {
    // source：blog=部落格頁尾、post=文章底、home=k-rider 首頁、result=k-rider 結算頁、about=關於頁
    console.log(`#${String(r.id).padEnd(4)}${tpe(r.created_at)}　${(r.source || '（空）').padEnd(7)}${r.email}${r.flagged ? '　[honeypot 標記]' : ''}`);
  }
} else if (!batch) {
  console.log('batch（最新在上）：\n');
  for (const r of rows) {
    const hp = r.flagged ? `　（其中 ${r.flagged} 筆 honeypot 標記）` : '';
    console.log(`  ${r.batch.padEnd(34)} ${String(r.n).padStart(3)} 筆   最後一筆 ${tpe(r.latest)}${hp}`);
  }
  console.log('\n看內容：node scripts/registrations.mjs <batch>；訂閱名單：--signups');
} else {
  console.log(`${batch}　共 ${rows.length} 筆${showAll ? '（含 honeypot 標記）' : '（已濾掉 honeypot 標記，加 --all 看全部）'}\n`);
  for (const r of rows) {
    console.log(`#${r.id}　${r.name}　<${r.email}>　${tpe(r.created_at)}${r.flagged ? '　[honeypot 標記]' : ''}`);
    console.log((r.note || '（沒填）').split('\n').map((l) => '    ' + l).join('\n'));
    console.log('');
  }
}
