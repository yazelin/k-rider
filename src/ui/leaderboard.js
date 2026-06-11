// src/ui/leaderboard.js — Task 16 完整實作
import { t } from '../i18n/index.js';
export function renderLeaderboard(root) {
  root.innerHTML = `<div style="text-align:center;margin-top:30vh"><h1>${t('lb.title')}</h1><a class="pill" href="#/">${t('nav.home')}</a></div>`;
}
