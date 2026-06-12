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

// 遠景裝飾（慢視差）：月亮 + 市場地標剪影（台股=台北101、美股=紐約天際線、加密=大月亮 to the moon）
const FOG = 'rgba(139, 147, 167, 0.10)';

function drawMoon(ctx, x, y, r, big) {
  const grad = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 2.2);
  grad.addColorStop(0, 'rgba(216, 181, 106, 0.20)');
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(x, y, r * 2.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(230, 222, 196, 0.32)';
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  if (big) { // 加密月亮加隕石坑
    ctx.fillStyle = 'rgba(11, 14, 20, 0.18)';
    for (const [dx, dy, cr] of [[-0.3, -0.2, 0.18], [0.25, 0.1, 0.13], [-0.05, 0.35, 0.1]]) {
      ctx.beginPath(); ctx.arc(x + dx * r, y + dy * r, cr * r, 0, Math.PI * 2); ctx.fill();
    }
  }
}

function drawTaipei101(ctx, x, baseY, h) {
  ctx.fillStyle = FOG;
  const segs = 8, segH = (h * 0.72) / segs, w = h * 0.13;
  ctx.fillRect(x - w * 0.75, baseY - h * 0.1, w * 1.5, h * 0.1);       // 裙樓
  for (let i = 0; i < segs; i++) {                                      // 倒梯形節節相疊
    const yB = baseY - h * 0.1 - i * segH, yT = yB - segH;
    const k = 1 - i * 0.03;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.42 * k, yB); ctx.lineTo(x - w * 0.55 * k, yT);
    ctx.lineTo(x + w * 0.55 * k, yT); ctx.lineTo(x + w * 0.42 * k, yB);
    ctx.fill();
  }
  ctx.fillRect(x - w * 0.05, baseY - h, w * 0.1, h * 0.18);             // 塔尖
}

function drawNycSkyline(ctx, x, baseY, h) {
  ctx.fillStyle = FOG;
  const b = (dx, bw, bh) => ctx.fillRect(x + dx, baseY - bh, bw, bh);
  b(-150, 36, h * 0.42); b(-104, 30, h * 0.55); b(60, 40, h * 0.48); b(110, 26, h * 0.36);
  // 帝國大廈：階梯塔身 + 尖頂
  b(-30, 56, h * 0.5); b(-18, 32, h * 0.72); b(-8, 12, h * 0.84);
  ctx.fillRect(x - 3, baseY - h, 2.4, h * 0.16);
}

export function drawBackdrop(ctx, cam, market) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const big = market === 'crypto';
  drawMoon(ctx, W * 0.78 - (cam.x * 0.01) % (W * 0.2), H * 0.16, big ? 64 : 26, big);
  if (market === 'crypto') return; // 月亮就是地標
  const span = W + 700;
  const lx = W - (((cam.x * 0.12) % span) + span) % span; // 慢視差，循環出現
  const baseY = H * 0.82, h = H * 0.5;
  if (market === 'tw') drawTaipei101(ctx, lx, baseY, h);
  else drawNycSkyline(ctx, lx, baseY, h);
}

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
  // 看盤式十字線：交點落在走勢線上的目前位置（線性內插）
  const cx = Math.max(0, Math.min(progressX, xs));
  const ti = cx / SPACING;
  const i0 = Math.min(Math.floor(ti), vertices.length - 2);
  const frac = ti - i0;
  const wy = vertices[i0].y + (vertices[i0 + 1].y - vertices[i0].y) * frac;
  const mx = (cx / xs) * (W - 8) + 4;
  const my = ((wy - yMin) / yr) * (H - 10) + 5;
  const gold = 'rgba(216, 181, 106, 0.7)';
  ctx.strokeStyle = gold;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(mx, 0); ctx.lineTo(mx, H);   // 縱線
  ctx.moveTo(0, my); ctx.lineTo(W, my);   // 橫線
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = gold;
  ctx.beginPath();
  ctx.arc(mx, my, 2.5, 0, Math.PI * 2);
  ctx.fill();
}
