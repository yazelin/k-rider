// src/ui/leaderboard.js — 今日排行榜（lux 大戶風）
import { t, lang } from '../i18n/index.js';
import { FEATURED } from '../shared/featured-list.js';
import { getDaily } from './api.js';

export async function renderLeaderboard(root) {
  root.innerHTML = `
  <div class="lux lb-page">
    <header class="lux-nav">
      <span class="lux-brand">${t('app.name')}<em>K-RIDER</em></span>
      <a class="lux-pill" href="#/">← ${t('nav.home')}</a>
    </header>
    <main class="lux-main lb-main">
      <p class="lux-kicker">${t('lb.title')}</p>
      <h1 class="lb-title"></h1>
      <p class="lb-meta"></p>
      <div class="lb">${t('loading')}</div>
    </main>
  </div>`;
  const box = root.querySelector('.lb');
  const showEmpty = () => {
    box.textContent = '';
    const empty = document.createElement('p');
    empty.className = 'lb-empty';
    empty.textContent = t('lb.empty');
    box.appendChild(empty);
  };
  try {
    const d = await getDaily();
    const entry = FEATURED.find((f) => f.symbol === d.symbol);
    root.querySelector('.lb-title').textContent = entry ? (entry.name[lang()] || entry.name.en) : d.symbol;
    root.querySelector('.lb-meta').textContent = `${d.symbol} · ${d.period.toUpperCase()} · ${d.date} · ${d.totalPlayers} ${t('daily.riders')}`;
    if (!d.leaderboard?.length) return showEmpty();
    box.textContent = '';
    const ol = document.createElement('ol');
    ol.className = 'lb-list';
    d.leaderboard.forEach((r, i) => {
      const li = document.createElement('li');
      if (i === 0) li.className = 'lb-first';
      const rank = document.createElement('i');
      rank.textContent = String(i + 1).padStart(2, '0');
      const name = document.createElement('span');
      name.textContent = r.nickname; // user-controlled → textContent
      const score = document.createElement('b');
      score.textContent = r.score.toLocaleString();
      li.append(rank, name, score);
      ol.appendChild(li);
    });
    box.appendChild(ol);
  } catch { showEmpty(); }
}
