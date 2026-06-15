// src/ui/ride.js
import { sliceForPeriod } from '../shared/candles.js';
import { buildTerrain } from '../shared/terrain.js';
import { isTw, FEATURED } from '../shared/featured-list.js';
import { pickDaily, taipeiDateStr } from '../shared/daily-pick.js';
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
  // 每日挑戰即時判定：騎的就是今日賽道（同檔同區間、未開平滑）就能上榜——不看入口；
  // 平滑模式地形較好騎，開了就不算（封刷分漏洞）
  const todayPick = pickDaily(taipeiDateStr(), FEATURED);
  const isDailyNow = () => symbol === todayPick.symbol && period === todayPick.period && !smooth;
  root.innerHTML = `<div class="ride-bar">
      <a href="#/" class="pill">← ${t('nav.home')}</a>
      <span class="ride-symbol"></span>
      <span class="period-btns"></span>
      <button class="pill smooth-btn">${t('period.smooth')}</button>
      <button class="pill sound-btn" aria-label="sound"></button>
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
  // 同一個 2d context 物件會與 run.js 共用（getContext 對同一 canvas 回傳同一個）
  const gameCtx = canvas.getContext('2d');
  const resize = () => {
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = innerWidth + 'px';
    canvas.style.height = innerHeight + 'px';
    canvas.width = Math.round(innerWidth * dpr);
    canvas.height = Math.round(innerHeight * dpr);
    // backing store 設定會清掉既有 transform，故每次 resize 後重設一次：
    // 之後所有繪圖以 CSS px 座標下單，背後自動乘 dpr 進高解析 backing store
    gameCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
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

  // 可見的聲音開關（M 鍵同步）：喇叭 SVG 兩態
  const SPK_ON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 9v6h4l5 4V5L7 9H3z" fill="currentColor" stroke="none"/><path d="M15.5 8.5c1.6 1.2 1.6 5.8 0 7M18 6.5c2.6 2.2 2.6 8.8 0 11"/></svg>';
  const SPK_OFF = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 9v6h4l5 4V5L7 9H3z" fill="currentColor" stroke="none"/><line x1="15" y1="9" x2="21" y2="15"/><line x1="21" y1="9" x2="15" y2="15"/></svg>';
  const soundBtn = root.querySelector('.sound-btn');
  const refreshSoundBtn = () => { soundBtn.innerHTML = localStorage.getItem('k-rider-mute') === '1' ? SPK_OFF : SPK_ON; };
  refreshSoundBtn();
  addEventListener('kr-mute', refreshSoundBtn); // M 鍵切換時同步圖示
  soundBtn.onclick = () => {
    const m = localStorage.getItem('k-rider-mute') !== '1';
    localStorage.setItem('k-rider-mute', m ? '1' : '0');
    if (input) input.state.mute = m;
    audio?.setMuted(m);
    refreshSoundBtn();
  };

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
    root.classList.remove('is-playing'); // 回到選關預覽：恢復完整 ride-bar
    btns.querySelectorAll('.pill').forEach((b) => b.classList.toggle('active', b.textContent === period.toUpperCase()));
    const series = seriesFor(data, period);
    const chg = Math.round((series.at(-1).close / series[0].close - 1) * 1000) / 10;
    const vol = annualizedVol(series);
    const diff = vol < 0.22 ? 'easy' : vol < 0.38 ? 'medium' : vol < 0.6 ? 'hard' : 'insane';
    const previewTerrain = buildTerrain(series, { smooth }); // 預覽畫真實地形：所見即所騎
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
    drawPreviewChart(previewEl.querySelector('.rp-chart'), previewTerrain, redUp);
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
    if (import.meta.env?.DEV) window.__audio = audio;
    const series = seriesFor(data, period);
    const terrain = buildTerrain(series, { smooth });
    terrain.eventMarks = Object.entries(events.events || {})
      .map(([date, e]) => ({ idx: series.findIndex((pt) => new Date(pt.t).toISOString().slice(0, 10) === date), text: e[lang()] || e.zh, pct: e.pct }))
      .filter((m) => m.idx > 0);
    input = createInput(root);
    hud = createHud(root);
    root.classList.add('is-playing'); // 手機:遊玩中收掉 ride-bar 設定列，讓 HUD 不被蓋
    hud.setTitle(`${symbol} · ${period.toUpperCase()}`);
    run = createRun({
      canvas, minimap: hud.minimap, terrain, redUp, input, market: marketOf(symbol), audio,
      onTick: (s) => hud.update(s),
      onEnd: (result) => {
        if (result.reset) { startRun(); return; }
        showSettle(root, { symbol, period, series, result, isDaily: isDailyNow(), onRetry: startRun });
      },
    });
    run.start();
  }
  showPreview();
  root.cleanup = () => { teardown(); audio?.destroy(); removeEventListener('resize', resize); removeEventListener('kr-mute', refreshSoundBtn); };
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

// 預覽圖畫「實際地形頂點」（坡度限制後的形狀）：所見即所騎，不會有預覽與賽道不符的被騙感
function drawPreviewChart(canvas, terrain, redUp) {
  const dpr = window.devicePixelRatio || 1;
  const w = Math.min(innerWidth - 80, 720), h = 220;
  canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const { vertices, segments, meta } = terrain;
  let yMin = Infinity, yMax = -Infinity;
  for (const v of vertices) { if (v.y < yMin) yMin = v.y; if (v.y > yMax) yMax = v.y; }
  const yr = yMax - yMin || 1;
  const xs = vertices.at(-1).x || 1;
  const px = (v) => (v.x / xs) * (w - 16) + 8;
  const py = (v) => 14 + ((v.y - yMin) / yr) * (h - 40);
  for (let i = 1; i < vertices.length; i++) {
    const dir = segments[i - 1].dir;
    ctx.strokeStyle = dir === 'flat' ? '#8b93a7' : ((dir === 'up') === redUp ? '#ff5a5a' : '#36e07f');
    ctx.lineWidth = 2;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 5;
    ctx.beginPath();
    ctx.moveTo(px(vertices[i - 1]), py(vertices[i - 1]));
    ctx.lineTo(px(vertices[i]), py(vertices[i]));
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
  // 起點
  ctx.fillStyle = '#d8b56a';
  ctx.beginPath();
  ctx.arc(px(vertices[0]), py(vertices[0]), 4, 0, Math.PI * 2);
  ctx.fill();
  // 高低價標籤（價格仍取自原始資料）
  ctx.font = '11px ui-monospace, monospace';
  ctx.fillStyle = 'rgba(139,147,167,0.9)';
  ctx.fillText(`${meta.max}`, 8, 12);
  ctx.fillText(`${meta.min}`, 8, h - 2);
}
