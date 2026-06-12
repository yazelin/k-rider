// src/ui/settle.js
import { t, lang } from '../i18n/index.js';
import { postScore, postRoast, postEvent } from './api.js';
import { cannedRoast } from '../i18n/roast-canned.js';
import { taipeiDateStr } from '../shared/daily-pick.js';
import { shareResult, shareText, profitOf } from './share.js';
import { LINKS } from '../config.js';

// 各平台發文 intent（文字+連結，圖靠連結的 OG 卡展開）
const SOCIAL_INTENTS = [
  ['X', (txt) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(txt)}`],
  ['Threads', (txt) => `https://threads.net/intent/post?text=${encodeURIComponent(txt)}`],
  ['Reddit', (txt) => `https://www.reddit.com/submit?url=${encodeURIComponent('https://yazelin.github.io/k-rider/en.html')}&title=${encodeURIComponent(txt)}`],
  ['Bluesky', (txt) => `https://bsky.app/intent/compose?text=${encodeURIComponent(txt)}`],
  ['LINE', (txt) => `https://line.me/R/share?text=${encodeURIComponent(txt)}`],
];

const PID_KEY = 'k-rider-pid';
const NICK_KEY = 'k-rider-nick';

export function playerId() {
  let pid = localStorage.getItem(PID_KEY);
  if (!pid) {
    pid = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(PID_KEY, pid);
  }
  return pid;
}

export function showSettle(root, { symbol, period, series, result, isDaily, onRetry }) {
  const { ev, score, elapsed, crashedAtIndex } = result;
  // 虛擬成交額：買進 10 萬 + 出場市值（完賽=獲利了結、摔車=斷頭賣出，都算成交）
  const { profit } = profitOf(series, result);
  postEvent(ev.finished ? 'finish' : 'crash', 200000 + profit).catch(() => {});
  const el = document.createElement('div');
  el.className = 'settle';
  el.innerHTML = `
    <div class="settle-card">
      <h2>${ev.finished ? t('settle.finished') : t('settle.crashed')}</h2>
      <div class="settle-score">${score.toLocaleString()} <span>${t('hud.points')}</span></div>
      <div class="settle-roast dim">…</div>
      <table class="settle-detail">
        <tr><td>${t('settle.distance')}</td><td>${ev.pointsPassed}/${series.length - 1}</td></tr>
        <tr><td>${t('settle.airtime')}</td><td>${(ev.airSegmentsMs.reduce((a, b) => a + b, 0) / 1000).toFixed(1)}s</td></tr>
        <tr><td>${t('settle.flips')}</td><td>${ev.flips}</td></tr>
        <tr><td>${t('settle.crashes')}</td><td>${ev.crashes || 0}</td></tr>
        <tr><td>${t('settle.time')}</td><td>${(elapsed / 1000).toFixed(1)}s</td></tr>
      </table>
      <div class="settle-tricks"></div>
      ${isDaily ? `
      <div class="settle-submit">
        <input class="nick" maxlength="16" placeholder="${t('settle.nickname')}" />
        <button class="pill submit">${t('settle.submit')}</button>
        <div class="submit-msg dim"></div>
      </div>` : ''}
      <div class="settle-actions">
        <button class="pill retry">${t('settle.retry')}</button>
        <button class="pill share">${t('share.button')}</button>
        <a class="pill" href="#/">${t('nav.home')}</a>
      </div>
      <div class="share-msg dim"></div>
      <div class="settle-socials"></div>
      <a class="coffee-cta" href="${LINKS.coffee}" target="_blank" rel="noopener" hidden>${t('coffee.cta')}</a>
    </div>`;
  root.appendChild(el);

  // 特技清單：同名合併計次與總分
  if (ev.tricks?.length) {
    const tally = {};
    for (const tk of ev.tricks) {
      tally[tk.key] = tally[tk.key] || { n: 0, pts: 0 };
      tally[tk.key].n++;
      tally[tk.key].pts += tk.pts;
    }
    const box = el.querySelector('.settle-tricks');
    for (const [key, v] of Object.entries(tally)) {
      const row = document.createElement('div');
      row.className = 'trick-row';
      row.textContent = `${t(`trick.${key}`)} ×${v.n}　+${v.pts.toLocaleString()}`;
      box.appendChild(row);
    }
  }

  // 「賺」超過 10% 才出現請喝咖啡（賺爛了的時刻）
  if (LINKS.coffee && profitOf(series, result).profit >= 10000) {
    el.querySelector('.coffee-cta').hidden = false;
  }

  // 平台分享按鈕
  const socials = el.querySelector('.settle-socials');
  const txt = shareText({ symbol, series, result });
  for (const [name, urlFn] of SOCIAL_INTENTS) {
    const a = document.createElement('a');
    a.className = 'social-pill';
    a.textContent = name;
    a.href = urlFn(txt);
    a.target = '_blank';
    a.rel = 'noopener';
    socials.appendChild(a);
  }

  el.querySelector('.share').onclick = async (e) => {
    e.target.disabled = true;
    const msg = el.querySelector('.share-msg');
    try {
      const how = await shareResult({ symbol, series, result });
      msg.textContent = how === 'saved' ? t('share.saved') : t('share.done');
    } catch { msg.textContent = t('share.failed'); }
    e.target.disabled = false;
  };
  if (isDaily) el.querySelector('.nick').value = localStorage.getItem(NICK_KEY) || '';
  el.querySelector('.retry').onclick = () => { el.remove(); onRetry(); };

  // AI 賽評（失敗退罐頭句）
  const roastEl = el.querySelector('.settle-roast');
  postRoast({ symbol, period, score, crashedAtIndex, stats: { crashes: ev.crashes || 0, flips: ev.flips, finished: ev.finished }, lang: lang() })
    .then((r) => { roastEl.textContent = r?.line || cannedRoast(ev, score, lang()); })
    .catch(() => { roastEl.textContent = cannedRoast(ev, score, lang()); });

  if (isDaily) {
    el.querySelector('.submit').onclick = async (e) => {
      const nickname = el.querySelector('.nick').value.trim() || 'rider';
      localStorage.setItem(NICK_KEY, nickname);
      e.target.disabled = true;
      const msg = el.querySelector('.submit-msg');
      try {
        await postScore({ nickname, score, playerId: playerId(), date: taipeiDateStr(), stats: { finished: ev.finished } });
        msg.textContent = t('settle.submitted');
      } catch { msg.textContent = t('settle.submitFailed'); e.target.disabled = false; }
    };
  }
}
