#!/usr/bin/env node
// 查活動報名／回饋名單（D1 registrations，報名與回饋都在這張表，用 batch 區分），
// 以及訂閱名單（D1 signups，blog／首頁等留資點，用 source 區分）。
//   node scripts/registrations.mjs                              列出所有 batch 與筆數
//   node scripts/registrations.mjs sticker-2026-08-05-feedback  看某個 batch 的每一筆內容
//   node scripts/registrations.mjs --signups                    看訂閱名單（signups 表）
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
const sql = notes
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

const tpe = (iso) =>
  new Date(iso).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false, dateStyle: 'short', timeStyle: 'short' });

if (notes) {
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
