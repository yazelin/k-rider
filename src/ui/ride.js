// src/ui/ride.js
import { sliceForPeriod } from '../shared/candles.js';
import { buildTerrain } from '../shared/terrain.js';
import { isTw } from '../shared/featured-list.js';
import { createRun } from '../game/run.js';
import { createInput } from '../game/input.js';
import { createHud } from '../game/hud.js';
import { createAudio } from '../game/audio.js';
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
      <div class="hud-microlabel">CONTROLS</div>
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
    b.onclick = () => { period = p; showPreview(); };
    btns.appendChild(b);
  }
  root.querySelector('.smooth-btn').onclick = (e) => { smooth = !smooth; e.target.classList.toggle('active', smooth); showPreview(); };

  let run, input, hud, previewEl, previewKey, audio;
  const redUp = isTw(symbol);

  function teardown() {
    run?.destroy(); input?.destroy(); hud?.destroy();
    root.querySelectorAll('.settle').forEach((n) => n.remove());
    if (previewKey) { removeEventListener('keydown', previewKey); previewKey = null; }
    previewEl?.remove(); previewEl = null;
  }

  // 選關預覽：全賽道走勢 + 統計，看清楚再出發（原版的選關畫面）
  function showPreview() {
    teardown();
    btns.querySelectorAll('.pill').forEach((b) => b.classList.toggle('active', b.textContent === period.toUpperCase()));
    const series = seriesFor(data, period);
    const chg = Math.round((series.at(-1).close / series[0].close - 1) * 1000) / 10;
    const vol = annualizedVol(series);
    const diff = vol < 0.22 ? 'easy' : vol < 0.38 ? 'medium' : vol < 0.6 ? 'hard' : 'insane';
    previewEl = document.createElement('div');
    previewEl.className = 'ride-preview';
    previewEl.innerHTML = `
      <div class="rp-card">
        <div class="rp-name"></div>
        <div class="rp-sub">${period.toUpperCase()}${smooth ? ` · ${t('period.smooth')}` : ''}</div>
        <canvas class="rp-chart"></canvas>
        <div class="rp-stats">
          <div><b>${series.length}</b><span>${t('preview.points')}</span></div>
          <div><b class="rp-chg">${chg > 0 ? '+' : ''}${chg}%</b><span>${t('preview.change')}</span></div>
          <div><b class="d-${diff}">${t(`difficulty.${diff}`)}</b><span>${t('preview.vol')} ${vol}</span></div>
        </div>
        <button class="lux-btn gold rp-start">${t('preview.start')}</button>
        <div class="rp-hint">${t('preview.hint')}</div>
      </div>`;
    root.appendChild(previewEl);
    previewEl.querySelector('.rp-name').textContent = symbol;
    previewEl.querySelector('.rp-chg').style.color = (chg >= 0) === redUp ? '#ff5a5a' : '#36e07f';
    drawPreviewChart(previewEl.querySelector('.rp-chart'), series, redUp);
    const go = () => startRun();
    previewEl.querySelector('.rp-start').onclick = go;
    previewKey = (e) => {
      if (e.code === 'Enter' || e.code === 'ArrowUp' || e.code === 'Space') { e.preventDefault(); go(); }
    };
    addEventListener('keydown', previewKey);
  }

  function startRun() {
    teardown();
    if (!audio) audio = createAudio(); // 出發是使用者手勢，AudioContext 可啟動
    audio.resume();
    const series = seriesFor(data, period);
    const terrain = buildTerrain(series, { smooth });
    terrain.eventMarks = Object.entries(events.events || {})
      .map(([date, e]) => ({ idx: series.findIndex((pt) => new Date(pt.t).toISOString().slice(0, 10) === date), text: e[lang()] || e.zh, pct: e.pct }))
      .filter((m) => m.idx > 0);
    input = createInput(root);
    hud = createHud(root);
    hud.setTitle(`${symbol} · ${period.toUpperCase()}`);
    run = createRun({
      canvas, minimap: hud.minimap, terrain, redUp, input, market: marketOf(symbol), audio,
      onTick: (s) => hud.update(s),
      onEnd: (result) => {
        if (result.reset) { startRun(); return; }
        showSettle(root, { symbol, period, series, result, isDaily, onRetry: startRun });
      },
    });
    run.start();
  }
  showPreview();
  root.cleanup = () => { teardown(); audio?.destroy(); removeEventListener('resize', resize); };
}

// 年化波動度（與資料管線同公式，任意 series 都能算）
function annualizedVol(series) {
  const rets = [];
  for (let i = 1; i < series.length; i++) rets.push(Math.log(series[i].close / series[i - 1].close));
  const mean = rets.reduce((a, b) => a + b, 0) / (rets.length || 1);
  const sd = Math.sqrt(rets.reduce((a, r) => a + (r - mean) ** 2, 0) / (rets.length || 1));
  return Math.round(sd * Math.sqrt(252) * 1000) / 1000;
}

function marketOf(symbol) {
  if (symbol === 'BTC-USD') return 'crypto';
  return isTw(symbol) ? 'tw' : 'us';
}

// 預覽走勢圖：逐段漲跌染色 + 起點旗標
function drawPreviewChart(canvas, series, redUp) {
  const dpr = window.devicePixelRatio || 1;
  const w = Math.min(innerWidth - 80, 720), h = 220;
  canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const closes = series.map((p) => p.close);
  const min = Math.min(...closes), max = Math.max(...closes), r = max - min || 1;
  const x = (i) => (i / (closes.length - 1)) * (w - 16) + 8;
  const y = (v) => h - 14 - ((v - min) / r) * (h - 40);
  for (let i = 1; i < closes.length; i++) {
    const up = closes[i] >= closes[i - 1];
    ctx.strokeStyle = (up === redUp) ? '#ff5a5a' : '#36e07f';
    ctx.lineWidth = 2;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 5;
    ctx.beginPath();
    ctx.moveTo(x(i - 1), y(closes[i - 1]));
    ctx.lineTo(x(i), y(closes[i]));
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
  // 起點
  ctx.fillStyle = '#d8b56a';
  ctx.beginPath();
  ctx.arc(x(0), y(closes[0]), 4, 0, Math.PI * 2);
  ctx.fill();
  // 高低價標籤
  ctx.font = '11px ui-monospace, monospace';
  ctx.fillStyle = 'rgba(139,147,167,0.9)';
  ctx.fillText(`${max}`, 8, 12);
  ctx.fillText(`${min}`, 8, h - 2);
}
