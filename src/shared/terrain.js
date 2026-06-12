export const SPACING = 60;        // 每個資料點水平間距 px
export const BASE_Y = 600;        // 最低價的地面 y
export const MAX_VERT = 1600;     // 價格映射的最大垂直幅度 px（防低波動股比例爆炸）
export const MAX_SLOPE_RAD = (50 * Math.PI) / 180; // 硬上限：保證可騎
export const TYP_SLOPE_RAD = (35 * Math.PI) / 180; // 目標：典型單日（p90）走 35° 坡，起伏貼近線圖手感

export function movingAvg(values, w) {
  return values.map((_, i) => {
    const s = Math.max(0, i - w + 1);
    const win = values.slice(s, i + 1);
    return win.reduce((a, b) => a + b, 0) / win.length;
  });
}

export function buildTerrain(points, { smooth = false } = {}) {
  const rawCloses = points.map((p) => p.close);
  let closes = rawCloses;
  if (smooth) {
    const w = Math.max(2, Math.min(10, Math.round(rawCloses.length / 60)));
    closes = movingAvg(rawCloses, w);
  }
  // min/max 一律取原始資料：smooth 只改形狀、不改比例（平滑模式才會真的變簡單）
  const min = Math.min(...rawCloses);
  const max = Math.max(...rawCloses);
  const range = max - min || 1;
  const norm = closes.map((c) => (c - min) / range);

  const maxRise = Math.tan(MAX_SLOPE_RAD) * SPACING;
  // 垂直比例：讓「第 90 百分位單日波動」≈ 35° 坡（由原始資料決定，p90 抗單日極端值）
  // 高波動股自動縮、低波動股放大到上限，起伏感貼近實際線圖
  const steps = [];
  for (let i = 1; i < rawCloses.length; i++) steps.push(Math.abs(rawCloses[i] - rawCloses[i - 1]) / range);
  steps.sort((a, b) => a - b);
  const p90 = steps.length ? steps[Math.floor(0.9 * (steps.length - 1))] : 0;
  const vert = Math.min(MAX_VERT, p90 > 1e-9 ? (Math.tan(TYP_SLOPE_RAD) * SPACING) / p90 : MAX_VERT);

  // 斜率限制器：y 追隨絕對映射目標，但單步升降 ≤ maxRise（坡度仍保證 ≤ 50°）
  // 超陡段變成連續 50° 坡爬向目標，而不是犧牲整條賽道的高度比例
  const vertices = [{ x: 0, y: BASE_Y - norm[0] * vert }];
  for (let i = 1; i < norm.length; i++) {
    const target = BASE_Y - norm[i] * vert;
    const prev = vertices[i - 1].y;
    vertices.push({ x: i * SPACING, y: Math.min(prev + maxRise, Math.max(prev - maxRise, target)) });
  }
  const segments = [];
  for (let i = 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    segments.push({ i0: i - 1, i1: i, dir: d > 0 ? 'up' : d < 0 ? 'down' : 'flat' });
  }
  return { vertices, segments, meta: { min, max, vert, points } };
}
