// src/game/render.js
import { SPACING } from '../shared/terrain.js';

// 行動裝置省電：shadowBlur 是手機 canvas 最貴的操作之一，coarse pointer（觸控）一律關 blur。
// 地形那層本來就有寬 globalAlpha 光暈描邊近似發光，關 shadowBlur 後視覺幾乎無損。桌機維持完整陰影。
const LITE = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

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

// 遠景裝飾（慢視差）：星空 + 金塵 + 光柱 + 月亮 + 市場地標剪影
const FOG = 'rgba(139, 147, 167, 0.16)';

// 星空與金塵用固定種子預生成（無 Math.random 每幀抖動）
const STARS = Array.from({ length: 110 }, (_, i) => {
  const h = ((i * 2654435761) >>> 0) / 4294967296;
  const h2 = (((i + 57) * 2246822519) >>> 0) / 4294967296;
  const h3 = (((i + 131) * 3266489917) >>> 0) / 4294967296;
  return { x: h, y: h2 * 0.62, r: 0.5 + h3 * 1.1, tw: 2 + h3 * 4 };
});
const DUST = Array.from({ length: 26 }, (_, i) => {
  const h = (((i + 7) * 2654435761) >>> 0) / 4294967296;
  const h2 = (((i + 91) * 2246822519) >>> 0) / 4294967296;
  return { x: h, sp: 8 + h2 * 18, ph: h2 * 7, r: 0.8 + h * 1.4 };
});

function drawMoon(ctx, x, y, r, big) {
  const grad = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 2.4);
  grad.addColorStop(0, 'rgba(216, 181, 106, 0.22)');
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(x, y, r * 2.4, 0, Math.PI * 2); ctx.fill();
  // 月面：暖灰 + 邊緣亮
  const surf = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.2, x, y, r);
  surf.addColorStop(0, 'rgba(238, 230, 208, 0.5)');
  surf.addColorStop(1, 'rgba(190, 180, 158, 0.3)');
  ctx.fillStyle = surf;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  // 隕石坑（所有市場都有，加密月亮更大顆更明顯）
  ctx.fillStyle = `rgba(11, 14, 20, ${big ? 0.2 : 0.12})`;
  for (const [dx, dy, cr] of [[-0.3, -0.2, 0.18], [0.25, 0.1, 0.13], [-0.05, 0.35, 0.1], [0.35, -0.3, 0.08]]) {
    ctx.beginPath(); ctx.arc(x + dx * r, y + dy * r, cr * r, 0, Math.PI * 2); ctx.fill();
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

export function drawBackdrop(ctx, cam, market, tSec = 0) {
  // 視口用 CSS px：ctx 已套 setTransform(dpr,...)，座標空間是 innerWidth×innerHeight，
  // ctx.canvas.width/height 是被 dpr 放大的 backing store 尺寸，拿來當視口會把背景畫到畫面外
  const W = innerWidth, H = innerHeight;
  const big = market === 'crypto';
  // 星空（極慢視差 + 個別閃爍）
  for (const s of STARS) {
    const sx = ((s.x * W - cam.x * 0.015) % W + W) % W;
    const a = 0.18 + 0.22 * (0.5 + 0.5 * Math.sin(tSec * (6.28 / s.tw) + s.x * 40));
    ctx.fillStyle = `rgba(230, 233, 240, ${a})`;
    ctx.fillRect(sx, s.y * H, s.r, s.r);
  }
  // 左上斜射光柱（兩道，極淡金）
  for (const [x0, w0] of [[W * 0.06, W * 0.1], [W * 0.2, W * 0.06]]) {
    const g = ctx.createLinearGradient(x0, 0, x0 + W * 0.22, H);
    g.addColorStop(0, 'rgba(216, 181, 106, 0.05)');
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x0, 0); ctx.lineTo(x0 + w0, 0);
    ctx.lineTo(x0 + w0 + W * 0.2, H); ctx.lineTo(x0 + W * 0.2, H);
    ctx.fill();
  }
  drawMoon(ctx, W * 0.8, H * 0.15, big ? 64 : 28, big); // 月亮固定天上（遠到沒有視差）
  // 金塵：緩慢上飄
  for (const d of DUST) {
    const dy = H - (((tSec * d.sp + d.ph * 60) % (H + 40)));
    const dx = ((d.x * W - cam.x * 0.03) % W + W) % W + Math.sin(tSec * 0.7 + d.ph) * 14;
    ctx.fillStyle = 'rgba(216, 181, 106, 0.28)';
    ctx.beginPath(); ctx.arc(dx, dy, d.r, 0, Math.PI * 2); ctx.fill();
  }
  if (market !== 'crypto') {
    const span = W + 700;
    const lx = W - (((cam.x * 0.12) % span) + span) % span; // 慢視差，循環出現
    const baseY = H + 6, h = H * 0.55;                       // 剪影貼底，不浮空
    if (market === 'tw') drawTaipei101(ctx, lx, baseY, h);
    else drawNycSkyline(ctx, lx, baseY, h);
  }
  // 邊緣暈影
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.75);
  vg.addColorStop(0, 'transparent');
  vg.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
}

export function segColor(dir, redUp) {
  if (dir === 'flat') return css('--dim');
  const up = dir === 'up';
  if (redUp) return up ? css('--up-tw') : css('--down-tw');
  return up ? css('--up-us') : css('--down-us');
}

export function drawTerrain(ctx, terrain, cam, redUp) {
  const { vertices, segments } = terrain;
  // 視口用 CSS px（同 drawBackdrop 理由）：W 也用於 cam.x+W 的右緣可見範圍 culling
  const W = innerWidth, H = innerHeight;
  // 助跑段與終點緩衝段（與 physics 的隱形平路對齊）
  ctx.strokeStyle = css('--dim');
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(vertices[0].x - 180 - cam.x, vertices[0].y - cam.y);
  ctx.lineTo(vertices[0].x - cam.x, vertices[0].y - cam.y);
  ctx.moveTo(vertices.at(-1).x - cam.x, vertices.at(-1).y - cam.y);
  ctx.lineTo(vertices.at(-1).x + 180 - cam.x, vertices.at(-1).y - cam.y);
  ctx.stroke();
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
    // 霓虹折線：外圈光暈 + 內芯亮線（mock 的厚光感）
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.16;
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(a.x - cam.x, a.y - cam.y);
    ctx.lineTo(b.x - cam.x, b.y - cam.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = color;
    ctx.shadowBlur = LITE ? 0 : 14;
    ctx.beginPath();
    ctx.moveTo(a.x - cam.x, a.y - cam.y);
    ctx.lineTo(b.x - cam.x, b.y - cam.y);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
}

// 車尾光軌：隨車身殘影淡出
export function drawTrail(ctx, trail, cam) {
  if (!trail || trail.length < 2) return;
  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  ctx.lineCap = 'round';
  for (let i = 1; i < trail.length; i++) {
    const a = i / trail.length;
    ctx.strokeStyle = `rgba(94, 234, 212, ${a * 0.3})`;
    ctx.lineWidth = 1 + a * 3;
    ctx.beginPath();
    ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
    ctx.lineTo(trail[i].x, trail[i].y);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawBike(ctx, bike, cam) {
  const { chassis, wheelB, wheelF } = bike;
  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  const spin = chassis.spinVisual ?? chassis.angle; // 剛體輪不自轉，輻條用視覺自轉角
  for (const w of [wheelB, wheelF]) {
    ctx.strokeStyle = css('--text');
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(w.position.x, w.position.y, w.circleRadius, 0, Math.PI * 2);
    ctx.stroke();
    // 輻條（看得出轉動）
    ctx.beginPath();
    ctx.moveTo(w.position.x, w.position.y);
    ctx.lineTo(w.position.x + Math.cos(spin) * w.circleRadius, w.position.y + Math.sin(spin) * w.circleRadius);
    ctx.stroke();
  }
  // 車架 + 騎士
  ctx.save();
  ctx.translate(chassis.position.x, chassis.position.y);
  ctx.rotate(chassis.angle);
  ctx.strokeStyle = css('--accent');
  ctx.lineWidth = 4;
  ctx.shadowColor = css('--accent');
  ctx.shadowBlur = LITE ? 0 : 8;
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
    // 可見範圍 culling 用 CSS px 視口寬（同前述，避免 dpr 放大 backing store 尺寸）
    if (x < -300 || x > innerWidth + 300) continue;
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
  ctx.fillStyle = gold;
  // 看盤十字線改用 fillRect 拼虛線：minimap 每幀重畫，dashed stroke 在某些 mx/my 浮點值下
  // 會整條漏畫（曾發生縱線消失、只剩橫線）；fillRect 不經 path/dash，穩定每幀都畫得出來
  const vx = Math.round(mx);
  for (let y = 0; y < H; y += 6) ctx.fillRect(vx, y, 1, 3);   // 縱線：目前騎到的水平位置
  const hy = Math.round(my);
  for (let x = 0; x < W; x += 6) ctx.fillRect(x, hy, 3, 1);   // 橫線：目前所在高度
  // 交點圓點
  ctx.beginPath();
  ctx.arc(mx, my, 2.5, 0, Math.PI * 2);
  ctx.fill();
}
