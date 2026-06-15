// src/ui/settle.js
import { t, lang } from '../i18n/index.js';
import { postScore, postRoast, postEvent } from './api.js';
import { cannedRoast } from '../i18n/roast-canned.js';
import { taipeiDateStr, pickDaily } from '../shared/daily-pick.js';
import { FEATURED } from '../shared/featured-list.js';

const dailyHref = () => {
  const p = pickDaily(taipeiDateStr(), FEATURED);
  return `#/ride/${p.symbol}?p=${p.period}`;
};
import { shareResult, shareText, profitOf } from './share.js';
import { LINKS } from '../config.js';
import { ICONS } from './icons.js';
import { initSignup } from './signup.js';

// 留資漏斗區塊(結算頁/about 共用結構);honeypot company 欄位靠 CSS 移出視野
export const SIGNUP_HTML = (title, sub) => `
  <section class="signup">
    <h3 class="signup-title">${title}</h3>
    <p class="signup-sub">${sub}</p>
    <form class="signup-form" novalidate>
      <div class="signup-fields">
        <input class="signup-email" type="email" inputmode="email" autocomplete="email" placeholder="you@example.com" aria-label="Email" />
        <input class="signup-hp" type="text" name="company" tabindex="-1" autocomplete="off" aria-hidden="true" />
        <button class="signup-go lux-btn gold" type="submit">加入每日挑戰</button>
      </div>
      <p class="signup-msg" hidden></p>
      <p class="signup-gift" hidden>👉 <a class="signup-gift-link" href="#"></a></p>
    </form>
  </section>`;

// 把表單元素湊齊接到 initSignup
export function wireSignup(scope, source) {
  const form = scope.querySelector('.signup-form');
  if (!form) return;
  initSignup({
    form,
    emailInput: form.querySelector('.signup-email'),
    companyInput: form.querySelector('.signup-hp'),
    submitBtn: form.querySelector('.signup-go'),
    msgEl: form.querySelector('.signup-msg'),
    giftEl: form.querySelector('.signup-gift'),
    giftLink: form.querySelector('.signup-gift-link'),
  }, { source });
}

// 各平台發文 intent（文字+連結，圖靠連結的 OG 卡展開）；FB sharer 只吃網址
const enc = encodeURIComponent;
const INTENTS = {
  x: { label: 'X', url: (txt) => `https://twitter.com/intent/tweet?text=${enc(txt)}` },
  threads: { label: 'Threads', url: (txt) => `https://www.threads.net/intent/post?text=${enc(txt)}` },
  reddit: { label: 'Reddit', url: (txt) => `https://www.reddit.com/submit?url=${enc('https://yazelin.github.io/k-rider/en.html')}&title=${enc(txt)}` },
  bluesky: { label: 'Bluesky', url: (txt) => `https://bsky.app/intent/compose?text=${enc(txt)}` },
  line: { label: 'LINE', url: (txt) => `https://line.me/R/share?text=${enc(txt)}` },
  facebook: { label: 'Facebook', url: () => `https://www.facebook.com/sharer/sharer.php?u=${enc('https://yazelin.github.io/k-rider/')}` },
};
// 平台順序在地化：台灣 LINE/Threads/FB 為主，Bluesky 只給英文介面（台灣冷門）
const SOCIAL_ORDER = {
  'zh-TW': ['line', 'threads', 'x', 'facebook', 'reddit'],
  en: ['x', 'threads', 'reddit', 'bluesky', 'facebook'],
};

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
  const stat = (label, value) => `<div class="sd-row"><span>${label}</span><b>${value}</b></div>`;
  el.innerHTML = `
    <div class="settle-card">
      <div class="settle-ornament">◆ ◆ ◆</div>
      <h2>${ev.finished ? t('settle.finished') : t('settle.crashed')}</h2>
      <div class="settle-kicker">FINAL SCORE</div>
      <div class="settle-score">${score.toLocaleString()}</div>
      <div class="settle-roast">…</div>
      <div class="settle-detail">
        ${stat(t('settle.distance'), `${ev.pointsPassed}/${series.length - 1}`)}
        ${stat(t('settle.airtime'), `${(ev.airSegmentsMs.reduce((a, b) => a + b, 0) / 1000).toFixed(1)} s`)}
        ${stat(t('settle.flips'), ev.flips)}
        ${stat(t('settle.crashes'), ev.crashes || 0)}
        ${stat(t('settle.time'), `${(elapsed / 1000).toFixed(1)} s`)}
      </div>
      <div class="settle-tricks"></div>
      ${isDaily ? `
      <div class="settle-submit">
        <input class="nick" maxlength="16" placeholder="${t('settle.nickname')}" />
        <button class="lux-btn gold submit">${t('settle.submit')}</button>
        <div class="submit-msg dim"></div>
      </div>` : `
      <a class="settle-daily-hint" href="${dailyHref()}">${t('settle.notDaily')}</a>`}
      <div class="settle-actions">
        <button class="lux-btn retry">${t('settle.retry')}</button>
        <button class="lux-btn share">${t('share.button')}</button>
        <a class="lux-btn" href="#/">${t('nav.home')}</a>
      </div>
      <div class="share-msg dim"></div>
      <div class="settle-socials"></div>
      <a class="coffee-cta" href="${LINKS.coffee}" target="_blank" rel="noopener" hidden>${t('coffee.cta')}</a>
      ${SIGNUP_HTML('訂閱每日挑戰提醒', '每天一條精選台股 K 線,賽道直接寄到信箱。免費,隨時退訂。')}
    </div>`;
  root.appendChild(el);
  wireSignup(el, 'result');

  // 特技徽章：同名合併計次與總分
  if (ev.tricks?.length) {
    const tally = {};
    for (const tk of ev.tricks) {
      tally[tk.key] = tally[tk.key] || { n: 0, pts: 0 };
      tally[tk.key].n++;
      tally[tk.key].pts += tk.pts;
    }
    const box = el.querySelector('.settle-tricks');
    for (const [key, v] of Object.entries(tally)) {
      const badge = document.createElement('span');
      badge.className = 'trick-badge';
      badge.textContent = `◆ ${t(`trick.${key}`)} ×${v.n} +${v.pts.toLocaleString()}`;
      box.appendChild(badge);
    }
  }

  // 「賺」超過 10% 才出現請喝咖啡（賺爛了的時刻）
  if (LINKS.coffee && profitOf(series, result).profit >= 10000) {
    el.querySelector('.coffee-cta').hidden = false;
  }

  // 平台分享：圓框官方 glyph（順序在地化）
  const socials = el.querySelector('.settle-socials');
  const txt = shareText({ symbol, series, result });
  for (const key of SOCIAL_ORDER[lang()] || SOCIAL_ORDER.en) {
    const it = INTENTS[key];
    const a = document.createElement('a');
    a.className = 'lux-icon sm';
    a.href = it.url(txt);
    a.target = '_blank';
    a.rel = 'noopener';
    a.setAttribute('aria-label', it.label);
    a.title = it.label;
    a.innerHTML = `<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="${ICONS[key]}"/></svg>`;
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
