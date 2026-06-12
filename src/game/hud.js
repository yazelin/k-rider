// src/game/hud.js
import { t } from '../i18n/index.js';

export function createHud(root) {
  const el = document.createElement('div');
  el.className = 'hud';
  el.innerHTML = `
    <div class="hud-left">
      <div class="hud-title"></div>
      <div class="hud-score">0 <span>${t('hud.points')}</span></div>
      <div class="hud-air"></div>
      <div class="hud-combo"></div>
      <div class="hud-crashes dim"></div>
    </div>
    <div class="hud-center">
      <div class="hud-time">0:00.0</div>
      <div class="nitro-bar"><div class="nitro-fill"></div></div>
    </div>
    <div class="hud-right">
      <canvas class="minimap" width="180" height="60"></canvas>
      <div class="hud-progress dim"></div>
    </div>
    <div class="trick-pop" hidden></div>`;
  root.appendChild(el);
  const $ = (c) => el.querySelector(c);
  let shownTrick = null;
  return {
    minimap: $('.minimap'),
    setTitle(s) { $('.hud-title').textContent = s; },
    update({ score, elapsed, nitroRatio, airborne, progress, total, combo, crashes, crashFlash, trick }) {
      $('.hud-score').firstChild.textContent = `${score} `;
      const sec = elapsed / 1000;
      $('.hud-time').textContent = `${Math.floor(sec / 60)}:${(sec % 60).toFixed(1).padStart(4, '0')}`;
      $('.nitro-fill').style.width = `${nitroRatio * 100}%`;
      $('.hud-air').textContent = crashFlash ? t('hud.crashed') : (airborne ? t('hud.airborne') : t('hud.grounded'));
      $('.hud-air').style.color = crashFlash ? '#f87171' : (airborne ? 'var(--accent2)' : 'var(--accent)');
      $('.hud-combo').textContent = combo > 1 ? `COMBO ×${combo}` : '';
      $('.hud-crashes').textContent = crashes > 0 ? `${t('hud.crashes')} ${crashes}` : '';
      if (total) $('.hud-progress').textContent = `${progress}/${total}`;
      const pop = $('.trick-pop');
      if (trick && trick !== shownTrick) {
        shownTrick = trick;
        pop.textContent = `${t(`trick.${trick.key}`)} +${trick.pts.toLocaleString()}`;
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
