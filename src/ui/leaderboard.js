// src/ui/leaderboard.js
import { t } from '../i18n/index.js';
import { getDaily } from './api.js';

export async function renderLeaderboard(root) {
  root.innerHTML = `
    <header class="nav"><a class="pill" href="#/">← ${t('nav.home')}</a></header>
    <main class="home">
      <h1>${t('lb.title')}</h1>
      <div class="lb dim">${t('loading')}</div>
    </main>`;
  const box = root.querySelector('.lb');
  try {
    const d = await getDaily();
    box.classList.remove('dim');
    box.textContent = '';
    const meta = document.createElement('p');
    meta.className = 'dim';
    meta.textContent = `${d.symbol} · ${d.period.toUpperCase()} · ${d.date} · ${d.totalPlayers} ${t('daily.riders')}`;
    box.appendChild(meta);
    if (!d.leaderboard?.length) {
      const empty = document.createElement('p');
      empty.textContent = t('lb.empty');
      box.appendChild(empty);
      return;
    }
    const ol = document.createElement('ol');
    ol.className = 'lb-list';
    for (const r of d.leaderboard) {
      const li = document.createElement('li');
      const name = document.createElement('span');
      name.textContent = r.nickname;          // user-controlled → textContent
      const score = document.createElement('b');
      score.textContent = r.score.toLocaleString();
      li.append(name, score);
      ol.appendChild(li);
    }
    box.appendChild(ol);
  } catch { box.textContent = t('lb.empty'); }
}
