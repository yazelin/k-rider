// src/ui/home.js — Task 15 完整實作
import { t, lang, toggleLang } from '../i18n/index.js';
export function renderHome(root) {
  root.innerHTML = `<div style="text-align:center;margin-top:30vh">
    <h1></h1>
    <p><a class="pill" href="#/ride/2330.TW?p=1y"></a> <a class="pill" href="#/leaderboard">${t('leaderboard')}</a>
    <button class="pill lang-btn">${lang() === 'zh-TW' ? 'EN' : '中'}</button></p></div>`;
  root.querySelector('h1').textContent = t('tagline');
  root.querySelector('a.pill').textContent = 'ride 2330.TW';
  root.querySelector('.lang-btn').onclick = toggleLang;
}
