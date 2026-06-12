// src/ui/home.js — 首頁（午夜交易室 × 私人銀行）
import { FEATURED } from '../shared/featured-list.js';
import { pickDaily, taipeiDateStr } from '../shared/daily-pick.js';
import { t, lang, toggleLang } from '../i18n/index.js';
import { loadJson } from './data.js';
import { getDaily, getStats } from './api.js';
import { LINKS } from '../config.js';

const fmtPct = (p) => `${p > 0 ? '+' : ''}${p}%`;
// canvas 漸層不吃 CSS 變數，這裡用具體色碼（與 style.css token 同值）
const pctColor = (p, market) =>
  (p >= 0) === (market === 'tw') ? '#ff5a5a' : '#36e07f';

// 迷你走勢線（devicePixelRatio 對齊，免鋸齒）
function drawSpark(canvas, data, color) {
  if (!data || data.length < 2) { canvas.hidden = true; return; }
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 150, h = canvas.clientHeight || 38;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const min = Math.min(...data), max = Math.max(...data), r = max - min || 1;
  const x = (i) => (i / (data.length - 1)) * (w - 4) + 2;
  const y = (v) => h - 5 - ((v - min) / r) * (h - 10);
  // 收盤線下方淡漸層
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, color + '33');
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(x(0), h);
  data.forEach((v, i) => ctx.lineTo(x(i), y(v)));
  ctx.lineTo(x(data.length - 1), h);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  data.forEach((v, i) => (i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v))));
  ctx.stroke();
  // 收盤點
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x(data.length - 1), y(data.at(-1)), 2.2, 0, Math.PI * 2);
  ctx.fill();
}

// hero 背景大走勢（金色細線）
function heroChartSvg(spark) {
  if (!spark || spark.length < 2) return '';
  const W = 1000, H = 240;
  const min = Math.min(...spark), max = Math.max(...spark), r = max - min || 1;
  const pts = spark.map((v, i) => `${(i / (spark.length - 1)) * W},${H - 20 - ((v - min) / r) * (H - 60)}`).join(' ');
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
    <polyline points="${pts}" fill="none" stroke="var(--gold)" stroke-width="1.5" opacity="0.35"/>
    <polyline points="${pts}" fill="none" stroke="var(--gold)" stroke-width="6" opacity="0.06"/>
  </svg>`;
}

export async function renderHome(root) {
  const zh = lang() === 'zh-TW';
  const date = taipeiDateStr();
  const pick = pickDaily(date, FEATURED);
  const pickEntry = FEATURED.find((f) => f.symbol === pick.symbol);
  root.innerHTML = `
  <div class="lux">
    <header class="lux-nav">
      <span class="lux-brand">${t('app.name')}${zh ? '<em>K-RIDER</em>' : '<em>RIDE THE TAPE</em>'}</span>
      <button class="lux-pill lang-btn">${zh ? 'EN' : '中'}</button>
    </header>
    <main class="lux-main">
      <section class="lux-hero">
        <div class="hero-chart"></div>
        <p class="lux-kicker">${t('subtitle')}</p>
        <h1>${t('tagline')}</h1>
        <div class="lux-stats" hidden>
          <div><b class="s-rides">0</b><span>${t('stats.rides')}</span></div>
          <div><b class="s-volume">$0</b><span>${t('stats.volume')}</span></div>
          <div><b class="s-crashes">0</b><span>${t('stats.crashes')}</span></div>
        </div>
      </section>
      <section class="lux-daily">
        <div class="lux-label">${t('daily.title')}<i>${date}</i></div>
        <div class="daily-name">${pickEntry.name[lang()] || pickEntry.name.en}</div>
        <div class="daily-meta">${pick.symbol} · ${pick.period.toUpperCase()}</div>
        <p class="daily-copy"></p>
        <p class="daily-best"></p>
        <div class="daily-actions">
          <a class="lux-btn gold" href="#/ride/${pick.symbol}?p=${pick.period}&daily=1">${t('daily.ride')}</a>
          <a class="lux-btn" href="#/leaderboard">${t('leaderboard')}</a>
        </div>
      </section>
      <form class="lux-search">
        <input class="search-input" name="ticker" placeholder="${t('search.placeholder')}" autocomplete="off" />
        <button class="lux-btn gold">${t('search.go')}</button>
      </form>
      <section class="lux-tracks"><h2>${t('section.tw')}</h2><div class="lux-grid tw-grid"></div></section>
      <section class="lux-tracks"><h2>${t('section.us')}</h2><div class="lux-grid us-grid"></div></section>
    </main>
    <footer class="lux-footer">
      <nav>
        <a href="${LINKS.coffee}" target="_blank" rel="noopener">Buy me a coffee</a>
        <a href="${LINKS.facebook}" target="_blank" rel="noopener">Facebook</a>
        <a href="${LINKS.github}" target="_blank" rel="noopener">GitHub</a>
      </nav>
      <p>${t('footer.disclaimer')} · ${t('footer.inspired')}</p>
    </footer>
  </div>`;

  root.querySelector('.lang-btn').onclick = toggleLang;
  root.querySelector('.lux-search').onsubmit = (e) => {
    e.preventDefault();
    const v = root.querySelector('.search-input').value.trim().toUpperCase();
    if (v) location.hash = `#/ride/${encodeURIComponent(v)}?p=1y`;
  };

  const featured = await loadJson('data/featured.json', { tickers: [] });
  const byMarket = (mk) => featured.tickers.filter((x) => (mk === 'us' ? x.market !== 'tw' : x.market === 'tw'));
  for (const [sel, mk] of [['.tw-grid', 'tw'], ['.us-grid', 'us']]) {
    const grid = root.querySelector(sel);
    for (const tk of byMarket(mk)) {
      const pct = tk.changePct3m ?? tk.changePct;
      const color = pctColor(pct, tk.market);
      const a = document.createElement('a');
      a.className = 'lux-card';
      a.href = `#/ride/${tk.symbol}?p=1y`;
      a.innerHTML = `
        <div class="lc-top"><b>${tk.symbol}</b><span class="lc-diff d-${tk.difficulty}">${t(`difficulty.${tk.difficulty}`)}</span></div>
        <canvas class="lc-spark"></canvas>
        <div class="lc-bottom"><span class="lc-name">${tk.name[lang()] || tk.name.en}</span><span class="lc-pct">3M ${fmtPct(pct)}</span></div>`;
      a.querySelector('.lc-pct').style.color = color;
      grid.appendChild(a);
      drawSpark(a.querySelector('.lc-spark'), tk.spark, color);
    }
  }

  // hero 背景：今日挑戰的走勢
  const pickMeta = featured.tickers.find((x) => x.symbol === pick.symbol);
  if (pickMeta?.spark) root.querySelector('.hero-chart').innerHTML = heroChartSvg(pickMeta.spark);

  const copy = await loadJson('data/daily-copy.json', {});
  if (copy[date]) root.querySelector('.daily-copy').textContent = copy[date][zh ? 'zh' : 'en'];

  getDaily().then((d) => {
    if (d.leaderboard?.[0]) {
      const top = d.leaderboard[0];
      root.querySelector('.daily-best').textContent =
        `${t('daily.best')}: ${top.score.toLocaleString()} ${t('hud.points')} ${t('daily.by')} ${top.nickname} · ${d.totalPlayers} ${t('daily.riders')}`;
    }
  }).catch(() => {});
  getStats().then((s) => {
    const row = root.querySelector('.lux-stats');
    row.hidden = false;
    row.querySelector('.s-rides').textContent = (s.rides || 0).toLocaleString();
    row.querySelector('.s-crashes').textContent = (s.crashes || 0).toLocaleString();
    row.querySelector('.s-volume').textContent = `$${(s.volume || 0).toLocaleString()}`;
  }).catch(() => {});
}
