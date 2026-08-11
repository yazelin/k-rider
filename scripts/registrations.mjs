#!/usr/bin/env node
// 查活動報名／回饋名單（D1 registrations，報名與回饋都在這張表，用 batch 區分），
// 以及訂閱名單（D1 signups，blog／首頁等留資點，用 source 區分）。
//   node scripts/registrations.mjs                              列出所有 batch 與筆數
//   node scripts/registrations.mjs sticker-2026-08-05-feedback  看某個 batch 的每一筆內容
//   node scripts/registrations.mjs --signups                    看訂閱名單（signups 表）
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
const batch = args.find((a) => !a.startsWith('--'));
// batch 直接進 SQL，所以只收 slug 字元（這支是本機 CLI，但沒理由留個洞）
if (batch && !/^[a-z0-9-]+$/.test(batch)) {
  console.error(`batch 只能是小寫英數與 -，收到：${batch}`);
  process.exit(1);
}

const skipFlagged = showAll ? '' : ' AND flagged=0';
const sql = signups
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

if (signups) {
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
