// src/ui/home.js
import { FEATURED } from '../shared/featured-list.js';
import { pickDaily, taipeiDateStr } from '../shared/daily-pick.js';
import { t, lang, toggleLang } from '../i18n/index.js';
import { loadJson } from './data.js';
import { getDaily, getStats } from './api.js';
import { LINKS } from '../config.js';

const fmtPct = (p) => `${p > 0 ? '+' : ''}${p}%`;
const pctClass = (p, market) => (p >= 0 ? (market === 'tw' ? 'pct-up-tw' : 'pct-up-us') : (market === 'tw' ? 'pct-down-tw' : 'pct-down-us'));

export async function renderHome(root) {
  const date = taipeiDateStr();
  const pick = pickDaily(date, FEATURED);
  const pickEntry = FEATURED.find((f) => f.symbol === pick.symbol);
  root.innerHTML = `
    <header class="nav">
      <span class="logo"><span class="logo-accent">${t('app.name')}</span>${lang() === 'zh-TW' ? ' <span class="logo-sub">K-RIDER</span>' : ''}</span>
      <button class="pill lang-btn">${lang() === 'zh-TW' ? 'EN' : '中'}</button>
    </header>
    <main class="home">
      <p class="subtitle">${t('subtitle')}</p>
      <h1>${t('tagline')}</h1>
      <section class="stats-row" hidden>
        <div><b class="s-rides">0</b><span>${t('stats.rides')}</span></div>
        <div><b class="s-volume">$0</b><span>${t('stats.volume')}</span></div>
        <div><b class="s-crashes">0</b><span>${t('stats.crashes')}</span></div>
      </section>
      <section class="daily-card">
        <div class="daily-label">${t('daily.title')}</div>
        <div class="daily-pick">${pickEntry.name[lang()] || pickEntry.name.en} (${pick.symbol}) · ${pick.period.toUpperCase()}</div>
        <div class="daily-copy dim"></div>
        <div class="daily-best dim"></div>
        <a class="pill cta" href="#/ride/${pick.symbol}?p=${pick.period}&daily=1">${t('daily.ride')}</a>
        <a class="pill" href="#/leaderboard">${t('leaderboard')}</a>
      </section>
      <form class="search">
        <input class="search-input" placeholder="${t('search.placeholder')}" />
        <button class="pill cta">${t('search.go')}</button>
      </form>
      <section class="tracks"><h2>${t('section.tw')}</h2><div class="grid tw-grid"></div></section>
      <section class="tracks"><h2>${t('section.us')}</h2><div class="grid us-grid"></div></section>
    </main>
    <footer class="footer">
      <a href="${LINKS.coffee || '#'}" target="_blank" rel="noopener">Buy me a coffee</a>
      <a href="${LINKS.facebook || '#'}" target="_blank" rel="noopener">Facebook</a>
      <a href="${LINKS.github}" target="_blank" rel="noopener">GitHub</a>
      <p class="dim">${t('footer.disclaimer')} · ${t('footer.inspired')}</p>
    </footer>`;

  root.querySelector('.lang-btn').onclick = toggleLang;
  root.querySelector('.search').onsubmit = (e) => {
    e.preventDefault();
    const v = root.querySelector('.search-input').value.trim().toUpperCase();
    if (v) location.hash = `#/ride/${encodeURIComponent(v)}?p=1y`;
  };

  const featured = await loadJson('data/featured.json', { tickers: [] });
  const byMarket = (mk) => featured.tickers.filter((x) => (mk === 'us' ? x.market !== 'tw' : x.market === 'tw'));
  for (const [sel, mk] of [['.tw-grid', 'tw'], ['.us-grid', 'us']]) {
    const grid = root.querySelector(sel);
    for (const tk of byMarket(mk)) {
      const a = document.createElement('a');
      a.className = 'track-card';
      a.href = `#/ride/${tk.symbol}?p=1y`;
      a.innerHTML = `<b>${tk.symbol}</b>
        <span class="diff diff-${tk.difficulty}">${t(`difficulty.${tk.difficulty}`)}</span>
        <span class="dim">${tk.name[lang()] || tk.name.en}</span>
        <span class="${pctClass(tk.changePct, tk.market)}">${fmtPct(tk.changePct)}</span>`;
      grid.appendChild(a);
    }
  }

  const copy = await loadJson('data/daily-copy.json', {});
  if (copy[date]) root.querySelector('.daily-copy').textContent = copy[date][lang() === 'zh-TW' ? 'zh' : 'en'];

  getDaily().then((d) => {
    if (d.leaderboard?.[0]) {
      const top = d.leaderboard[0];
      root.querySelector('.daily-best').textContent =
        `${t('daily.best')}: ${top.score.toLocaleString()} ${t('hud.points')} ${t('daily.by')} ${top.nickname} · ${d.totalPlayers} ${t('daily.riders')}`;
    }
  }).catch(() => {});
  getStats().then((s) => {
    const row = root.querySelector('.stats-row');
    row.hidden = false;
    row.querySelector('.s-rides').textContent = (s.rides || 0).toLocaleString();
    row.querySelector('.s-crashes').textContent = (s.crashes || 0).toLocaleString();
    row.querySelector('.s-volume').textContent = `$${(s.volume || 0).toLocaleString()}`;
  }).catch(() => {});
}
