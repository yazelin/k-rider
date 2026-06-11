// src/game/render.js
import { SPACING } from '../shared/terrain.js';

// 主題固定不換，快取避免每幀每段 getComputedStyle 強制 reflow
const cssCache = new Map();
const css = (name) => {
  let v = cssCache.get(name);
  if (v === undefined) {
    v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    cssCache.set(name, v);
  }
  return v;
};

export function segColor(dir, redUp) {
  if (dir === 'flat') return css('--dim');
  const up = dir === 'up';
  if (redUp) return up ? css('--up-tw') : css('--down-tw');
  return up ? css('--up-us') : css('--down-us');
}

export function drawTerrain(ctx, terrain, cam, redUp) {
  const { vertices, segments } = terrain;
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const i0 = Math.max(0, Math.floor(cam.x / SPACING) - 2);
  const i1 = Math.min(vertices.length - 1, Math.ceil((cam.x + W) / SPACING) + 2);
  for (let i = Math.max(1, i0 + 1); i <= i1; i++) {
    const a = vertices[i - 1], b = vertices[i];
    const color = segColor(segments[i - 1].dir, redUp);
    // 地面下方漸層填色
    const grad = ctx.createLinearGradient(0, Math.min(a.y, b.y) - cam.y, 0, H);
    grad.addColorStop(0, color + '26'); // 15% alpha
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(a.x - cam.x, a.y - cam.y);
    ctx.lineTo(b.x - cam.x, b.y - cam.y);
    ctx.lineTo(b.x - cam.x, H);
    ctx.lineTo(a.x - cam.x, H);
    ctx.fill();
    // 霓虹折線
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(a.x - cam.x, a.y - cam.y);
    ctx.lineTo(b.x - cam.x, b.y - cam.y);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
}

export function drawBike(ctx, bike, cam) {
  const { chassis, wheelB, wheelF } = bike;
  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  for (const w of [wheelB, wheelF]) {
    ctx.strokeStyle = css('--text');
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(w.position.x, w.position.y, w.circleRadius, 0, Math.PI * 2);
    ctx.stroke();
    // 輻條（看得出轉動）
    ctx.beginPath();
    ctx.moveTo(w.position.x, w.position.y);
    ctx.lineTo(w.position.x + Math.cos(w.angle) * w.circleRadius, w.position.y + Math.sin(w.angle) * w.circleRadius);
    ctx.stroke();
  }
  // 車架 + 騎士
  ctx.save();
  ctx.translate(chassis.position.x, chassis.position.y);
  ctx.rotate(chassis.angle);
  ctx.strokeStyle = css('--accent');
  ctx.lineWidth = 4;
  ctx.shadowColor = css('--accent');
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(-26, 8); ctx.lineTo(-6, -6); ctx.lineTo(14, -6); ctx.lineTo(26, 8); // 車架
  ctx.moveTo(-2, -6); ctx.lineTo(-8, -20);                                       // 身體
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-8, -27, 7, 0, Math.PI * 2);                                           // 頭
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}

export function drawEventMarks(ctx, terrain, cam) {
  if (!terrain.eventMarks?.length) return;
  ctx.save();
  ctx.font = '12px ui-monospace, monospace';
  for (const m of terrain.eventMarks) {
    const v = terrain.vertices[m.idx];
    if (!v) continue;
    const x = v.x - cam.x, y = v.y - cam.y;
    if (x < -300 || x > ctx.canvas.width + 300) continue;
    // 立牌
    ctx.strokeStyle = css('--accent2');
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x, y - 46);
    ctx.stroke();
    const text = `${m.pct > 0 ? '+' : ''}${m.pct}% ${m.text}`;
    const w = Math.min(ctx.measureText(text).width + 12, 260);
    ctx.fillStyle = 'rgba(19,24,38,0.92)';
    ctx.fillRect(x - 4, y - 66, w, 20);
    ctx.strokeRect(x - 4, y - 66, w, 20);
    ctx.fillStyle = css('--accent2');
    ctx.fillText(text, x + 2, y - 52, 248);
  }
  ctx.restore();
}

// 每幀呼叫，y 範圍只跟 terrain 有關 → 以 WeakMap 對 terrain 物件做一次性預計算
const minimapRange = new WeakMap();

export function drawMinimap(mini, terrain, progressX, redUp) {
  const ctx = mini.getContext('2d');
  const { vertices } = terrain;
  const W = mini.width, H = mini.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, W, H);
  const xs = vertices.at(-1).x || 1;
  let range = minimapRange.get(terrain);
  if (!range) {
    let yMin = Infinity, yMax = -Infinity;
    for (const v of vertices) { if (v.y < yMin) yMin = v.y; if (v.y > yMax) yMax = v.y; }
    range = { yMin, yr: yMax - yMin || 1 };
    minimapRange.set(terrain, range);
  }
  const { yMin, yr } = range;
  ctx.strokeStyle = css('--dim');
  ctx.lineWidth = 1;
  ctx.beginPath();
  vertices.forEach((v, i) => {
    const x = (v.x / xs) * (W - 8) + 4;
    const y = ((v.y - yMin) / yr) * (H - 10) + 5;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.stroke();
  ctx.fillStyle = css('--accent2');
  const px = (Math.min(progressX, xs) / xs) * (W - 8) + 4;
  ctx.beginPath();
  ctx.arc(px, H / 2, 3, 0, Math.PI * 2);
  ctx.fill();
}
