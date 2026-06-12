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
    </div>
    <div class="hud-center">
      <div class="hud-time">0:00.0</div>
      <div class="nitro-bar"><div class="nitro-fill"></div></div>
    </div>
    <div class="hud-right">
      <canvas class="minimap" width="180" height="60"></canvas>
      <div class="hud-progress dim"></div>
    </div>`;
  root.appendChild(el);
  const $ = (c) => el.querySelector(c);
  return {
    minimap: $('.minimap'),
    setTitle(s) { $('.hud-title').textContent = s; },
    update({ score, elapsed, nitroRatio, airborne, progress, total }) {
      $('.hud-score').firstChild.textContent = `${score} `;
      const sec = elapsed / 1000;
      $('.hud-time').textContent = `${Math.floor(sec / 60)}:${(sec % 60).toFixed(1).padStart(4, '0')}`;
      $('.nitro-fill').style.width = `${nitroRatio * 100}%`;
      $('.hud-air').textContent = airborne ? t('hud.airborne') : t('hud.grounded');
      $('.hud-air').style.color = airborne ? 'var(--accent2)' : 'var(--accent)';
      if (total) $('.hud-progress').textContent = `${progress}/${total}`;
    },
    destroy() { el.remove(); },
  };
}
