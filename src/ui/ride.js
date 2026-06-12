// src/ui/ride.js
import { sliceForPeriod } from '../shared/candles.js';
import { buildTerrain } from '../shared/terrain.js';
import { isTw } from '../shared/featured-list.js';
import { createRun } from '../game/run.js';
import { createInput } from '../game/input.js';
import { createHud } from '../game/hud.js';
import { loadTicker, loadJson } from './data.js';
import { t, lang } from '../i18n/index.js';
import { showSettle } from './settle.js';

const PERIOD_KEYS = ['1d', '5d', '3m', '6m', '1y', '5y', 'all'];

function seriesFor(data, period) {
  if (period === '1d') return data.intraday5m;
  if (period === '5d') return data.intraday15m;
  return sliceForPeriod(data.daily, period);
}

export async function renderRide(root, { symbol, params }) {
  let period = PERIOD_KEYS.includes(params.get('p')) ? params.get('p') : '1y';
  let smooth = params.get('smooth') === '1';
  const isDaily = params.get('daily') === '1';
  root.innerHTML = `<div class="ride-bar">
      <a href="#/" class="pill">← ${t('nav.home')}</a>
      <span class="ride-symbol"></span>
      <span class="period-btns"></span>
      <button class="pill smooth-btn">${t('period.smooth')}</button>
    </div>
    <canvas class="game-canvas"></canvas>
    <div class="controls-hint">
      <div><kbd>↑</kbd>${t('controls.gas')}</div>
      <div><kbd>←</kbd><kbd>→</kbd>${t('controls.lean')}</div>
      <div><kbd>Space</kbd>${t('controls.jump')}</div>
      <div><kbd>Shift</kbd>${t('controls.nitro')}</div>
      <div><kbd>R</kbd>${t('controls.reset')}</div>
    </div>`;
  // symbol 來自 URL hash（不可信輸入），一律走 textContent 防 XSS
  root.querySelector('.ride-symbol').textContent = symbol;
  const canvas = root.querySelector('.game-canvas');
  const resize = () => { canvas.width = innerWidth; canvas.height = innerHeight; };
  resize();
  addEventListener('resize', resize);

  let data;
  try { data = await loadTicker(symbol); }
  catch { root.querySelector('.ride-bar').insertAdjacentHTML('afterend', `<p class="error">${t('notFound')}</p>`); return; }

  const events = await loadJson(`data/events/${symbol}.json`, { events: {} });
  const btns = root.querySelector('.period-btns');
  for (const p of PERIOD_KEYS) {
    const series = seriesFor(data, p);
    const b = document.createElement('button');
    b.className = 'pill' + (p === period ? ' active' : '');
    b.textContent = p.toUpperCase();
    b.disabled = !series || series.length < 10;
    b.onclick = () => { period = p; restart(); };
    btns.appendChild(b);
  }
  root.querySelector('.smooth-btn').onclick = (e) => { smooth = !smooth; e.target.classList.toggle('active', smooth); restart(); };

  let run, input, hud;
  function restart() {
    run?.destroy(); input?.destroy(); hud?.destroy();
    root.querySelectorAll('.settle').forEach((n) => n.remove());
    btns.querySelectorAll('.pill').forEach((b) => b.classList.toggle('active', b.textContent === period.toUpperCase()));
    const series = seriesFor(data, period);
    const terrain = buildTerrain(series, { smooth });
    terrain.eventMarks = Object.entries(events.events || {})
      .map(([date, e]) => ({ idx: series.findIndex((pt) => new Date(pt.t).toISOString().slice(0, 10) === date), text: e[lang()] || e.zh, pct: e.pct }))
      .filter((m) => m.idx > 0);
    input = createInput(root);
    hud = createHud(root);
    hud.setTitle(`${symbol} · ${period.toUpperCase()}`);
    run = createRun({
      canvas, minimap: hud.minimap, terrain, redUp: isTw(symbol), input,
      onTick: (s) => hud.update(s),
      onEnd: (result) => {
        if (result.reset) { restart(); return; }
        showSettle(root, { symbol, period, series, result, isDaily, onRetry: restart });
      },
    });
    run.start();
  }
  restart();
  root.cleanup = () => { run?.destroy(); input?.destroy(); hud?.destroy(); removeEventListener('resize', resize); };
}
