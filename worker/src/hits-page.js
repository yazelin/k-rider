// worker/src/hits-page.js
// site_hits 的公開儀表板。一個網址,開了就是即時查 D1,沒有快取層、沒有前端框架。
// 資料本身只有 (day, site, n),所以這頁答得出「哪天哪個站被打開幾次」,答不出「幾個人」。
import { taipeiDateStr } from '../../src/shared/daily-pick.js';

// ponytail: 每次進來全表掃。一天約 25 列,一年約 9k 列,撐得住;
// 真的變慢再改成 GROUP BY 兩支查詢或加日期範圍參數。
const SQL = 'SELECT day, site, n FROM site_hits ORDER BY day';

export function aggregate(rows) {
  const days = [...new Set(rows.map((r) => r.day))].sort();
  const idx = new Map(days.map((d, i) => [d, i]));
  const bySite = new Map();
  for (const r of rows) {
    if (!bySite.has(r.site)) bySite.set(r.site, new Array(days.length).fill(0));
    bySite.get(r.site)[idx.get(r.day)] += r.n;
  }
  const dailyTotals = days.map((_, i) => [...bySite.values()].reduce((s, v) => s + v[i], 0));
  const sites = [...bySite.entries()]
    .map(([site, byDay]) => ({ site, byDay, total: byDay.reduce((s, n) => s + n, 0) }))
    .sort((a, b) => b.total - a.total || a.site.localeCompare(b.site));
  return { days, dailyTotals, sites, grandTotal: dailyTotals.reduce((s, n) => s + n, 0) };
}

// 折線用的座標。回傳每個點的 [x, y],畫線與畫點共用同一組。
export function points(values, { w, h, padX, padTop, padBottom }) {
  const max = Math.max(1, ...values);
  const span = values.length > 1 ? values.length - 1 : 1;
  const plotH = h - padTop - padBottom;
  return values.map((v, i) => [
    padX + (i * (w - padX * 2)) / span,
    padTop + plotH - (v / max) * plotH,
  ]);
}

const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
const md = (day) => `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}`;

function lineChart(days, values) {
  const w = 720, h = 240, padX = 40, padTop = 20, padBottom = 34;
  const max = Math.max(1, ...values);
  const pts = points(values, { w, h, padX, padTop, padBottom });
  const gridVals = [0, 0.5, 1].map((f) => Math.round(max * f));
  const grid = gridVals
    .map((v) => {
      const y = padTop + (h - padTop - padBottom) * (1 - v / max);
      return `<line x1="${padX}" y1="${y}" x2="${w - padX}" y2="${y}" class="grid"/>`
        + `<text x="${padX - 8}" y="${y + 4}" class="tick" text-anchor="end">${v}</text>`;
    })
    .join('');
  const peak = values.indexOf(max);
  const marks = pts
    .map(([x, y], i) => {
      const label = i === peak || i === pts.length - 1
        ? `<text x="${x}" y="${y - 12}" class="pointlabel" text-anchor="middle">${values[i]}</text>`
        : '';
      return `<g><circle cx="${x}" cy="${y}" r="4.5" class="dot"><title>${md(days[i])} ${values[i]} 次</title></circle>${label}</g>`;
    })
    .join('');
  const xLabels = pts
    .map(([x], i) => `<text x="${x}" y="${h - 10}" class="tick" text-anchor="middle">${md(days[i])}</text>`)
    .join('');
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="每日總開啟數折線圖">
    ${grid}
    <polyline class="series" points="${pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}"/>
    ${marks}${xLabels}
  </svg>`;
}

function sparkline(byDay) {
  const w = 74, h = 16;
  const max = Math.max(1, ...byDay);
  const pts = points(byDay, { w, h, padX: 2, padTop: 2, padBottom: 2 });
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${pts
    .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ')}"/></svg>`;
}

export async function handleHitsPage(req, env) {
  const { results } = await env.SIGNUPS.prepare(SQL).all();
  const { days, dailyTotals, sites, grandTotal } = aggregate(results || []);
  const today = taipeiDateStr();
  const todayIdx = days.indexOf(today);
  const todayTotal = todayIdx < 0 ? 0 : dailyTotals[todayIdx];
  const maxSite = sites.length ? sites[0].total : 1;
  const rows = sites
    .map((s) => {
      const t = todayIdx < 0 ? 0 : s.byDay[todayIdx];
      return `<tr>
        <th scope="row">${esc(s.site)}</th>
        <td class="num">${s.total}</td>
        <td class="barcell"><span class="bar" style="width:${((s.total / maxSite) * 100).toFixed(1)}%"></span></td>
        <td class="sparkcell">${sparkline(s.byDay)}</td>
        <td class="num today">${t || ''}</td>
      </tr>`;
    })
    .join('');

  const html = `<!doctype html>
<html lang="zh-Hant"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="300">
<meta name="robots" content="noindex">
<title>站台開啟計數</title>
<style>
:root{color-scheme:light;--surface:#fcfcfb;--card:#fff;--line:#e4e3de;--ink:#0b0b0b;--ink2:#52514e;--ink3:#78766f;--series:#2a78d6}
@media (prefers-color-scheme:dark){:root{color-scheme:dark;--surface:#131312;--card:#1a1a19;--line:#33322e;--ink:#fff;--ink2:#c3c2b7;--ink3:#8d8b81;--series:#3987e5}}
*{box-sizing:border-box}
body{margin:0;padding:24px 16px 64px;background:var(--surface);color:var(--ink);
  font:15px/1.6 system-ui,"Noto Sans TC",sans-serif}
main{max-width:860px;margin:0 auto}
h1{font-size:20px;margin:0 0 4px}
.sub{color:var(--ink3);font-size:13px;margin:0 0 24px}
.tiles{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:24px}
.tile{flex:1 1 150px;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 16px}
.tile b{display:block;font-size:28px;line-height:1.2;font-variant-numeric:tabular-nums}
.tile span{color:var(--ink3);font-size:12px}
section{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px;margin-bottom:20px}
h2{font-size:14px;margin:0 0 12px;color:var(--ink2);font-weight:600}
svg{display:block;width:100%;height:auto;overflow:visible}
.grid{stroke:var(--line);stroke-width:1}
.tick{fill:var(--ink3);font-size:11px}
.pointlabel{fill:var(--ink2);font-size:11px;font-weight:600}
.series{fill:none;stroke:var(--series);stroke-width:2;stroke-linejoin:round;stroke-linecap:round}
.dot{fill:var(--series);stroke:var(--card);stroke-width:2}
table{width:100%;border-collapse:collapse;font-size:13px}
th[scope=row]{text-align:left;font-weight:400;white-space:nowrap;padding-right:8px}
td,th{padding:4px 0;border-bottom:1px solid var(--line)}
.num{text-align:right;font-variant-numeric:tabular-nums;width:56px;padding-right:10px}
.today{color:var(--ink3);width:44px;padding-right:0}
.barcell{width:38%}
.bar{display:block;height:8px;border-radius:4px;background:var(--series);min-width:2px}
.sparkcell{width:80px;padding:0 10px}
.spark{width:74px}
.spark polyline{fill:none;stroke:var(--series);stroke-width:1.5;stroke-linejoin:round;opacity:.75}
thead th{color:var(--ink3);font-weight:500;font-size:12px;text-align:right}
thead th:first-child{text-align:left}
footer{color:var(--ink3);font-size:12px;text-align:center}
</style></head>
<body><main>
<h1>站台開啟計數</h1>
<p class="sub">promo footer 上報的「頁面被打開幾次」。只記日期與站名 — 不存 IP、不設 cookie、不記 referrer,所以答得出次數、答不出人數。每 5 分鐘自動重新整理。</p>
<div class="tiles">
  <div class="tile"><b>${grandTotal}</b><span>總開啟數</span></div>
  <div class="tile"><b>${sites.length}</b><span>有量的站</span></div>
  <div class="tile"><b>${todayTotal}</b><span>今日 ${md(today)}(累積中)</span></div>
  <div class="tile"><b>${days.length}</b><span>統計天數</span></div>
</div>
<section><h2>每日總開啟數</h2>${days.length ? lineChart(days, dailyTotals) : '<p>還沒有資料</p>'}</section>
<section><h2>各站累計(${days.length ? `${md(days[0])} 起` : ''})</h2>
<table><thead><tr><th>站</th><th>總計</th><th></th><th>逐日</th><th>今日</th></tr></thead>
<tbody>${rows}</tbody></table></section>
<footer>資料來源 k-rider-api / D1 site_hits・台北時間</footer>
</main></body></html>`;

  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=60' },
  });
}
