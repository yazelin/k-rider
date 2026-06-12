// src/game/hud.js — 設計稿語言：金框玻璃面板 + 微標籤 + 等寬大數字
import { t } from '../i18n/index.js';

export function createHud(root) {
  const el = document.createElement('div');
  el.className = 'hud';
  el.innerHTML = `
    <div class="hud-panel hud-left">
      <div class="hud-microlabel">SCORE</div>
      <div class="hud-score">0000000</div>
      <div class="hud-subrow"><span class="hud-combo"></span><span class="hud-crashes"></span></div>
      <div class="hud-air"></div>
    </div>
    <div class="hud-center">
      <div class="hud-title"></div>
      <div class="hud-time">0:00.0</div>
      <div class="nitro-bar"><div class="nitro-fill"></div></div>
    </div>
    <div class="hud-panel hud-right">
      <div class="hud-microlabel">MINIMAP</div>
      <canvas class="minimap" width="180" height="60"></canvas>
      <div class="hud-progress"></div>
    </div>
    <div class="trick-pop" hidden></div>`;
  root.appendChild(el);
  const $ = (c) => el.querySelector(c);
  let shownTrick = null;
  return {
    minimap: $('.minimap'),
    setTitle(s) { $('.hud-title').textContent = s; },
    update({ score, elapsed, nitroRatio, airborne, progress, total, combo, crashes, crashFlash, trick }) {
      $('.hud-score').textContent = String(score).padStart(7, '0');
      const sec = elapsed / 1000;
      $('.hud-time').textContent = `${Math.floor(sec / 60)}:${(sec % 60).toFixed(1).padStart(4, '0')}`;
      $('.nitro-fill').style.width = `${nitroRatio * 100}%`;
      $('.hud-air').textContent = crashFlash ? t('hud.crashed') : (airborne ? t('hud.airborne') : t('hud.grounded'));
      $('.hud-air').style.color = crashFlash ? '#f87171' : (airborne ? 'var(--accent2)' : 'var(--dim)');
      $('.hud-combo').textContent = combo > 1 ? `COMBO ×${combo}` : '';
      $('.hud-crashes').textContent = crashes > 0 ? `${t('hud.crashes')} ${crashes}` : '';
      if (total) $('.hud-progress').textContent = `${progress}/${total}`;
      const pop = $('.trick-pop');
      if (trick && trick !== shownTrick) {
        shownTrick = trick;
        pop.textContent = '';
        const name = document.createElement('div');
        name.className = 'trick-name';
        name.textContent = t(`trick.${trick.key}`);
        const pts = document.createElement('div');
        pts.className = 'trick-pts';
        pts.textContent = `+${trick.pts.toLocaleString()}`;
        pop.append(name, pts);
        pop.hidden = false;
        pop.classList.remove('pop-in');
        void pop.offsetWidth; // 重觸發動畫
        pop.classList.add('pop-in');
      } else if (!trick) {
        pop.hidden = true;
      }
    },
    destroy() { el.remove(); },
  };
}
