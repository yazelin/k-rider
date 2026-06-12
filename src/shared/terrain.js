export const SPACING = 60;        // 每個資料點水平間距 px
export const BASE_Y = 600;        // 最低價的地面 y
export const MAX_VERT = 420;      // 價格映射的最大垂直幅度 px
export const MAX_SLOPE_RAD = (50 * Math.PI) / 180;

export function movingAvg(values, w) {
  return values.map((_, i) => {
    const s = Math.max(0, i - w + 1);
    const win = values.slice(s, i + 1);
    return win.reduce((a, b) => a + b, 0) / win.length;
  });
}

export function buildTerrain(points, { smooth = false } = {}) {
  let closes = points.map((p) => p.close);
  if (smooth) {
    const w = Math.max(2, Math.min(10, Math.round(closes.length / 60)));
    closes = movingAvg(closes, w);
  }
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;
  const norm = closes.map((c) => (c - min) / range);

  const maxRise = Math.tan(MAX_SLOPE_RAD) * SPACING;
  // 垂直比例用「第 90 百分位單步」決定，而非最大單步：
  // 單日暴漲暴跌不再壓扁整條賽道，高度貼近真實線圖
  const steps = [];
  for (let i = 1; i < norm.length; i++) steps.push(Math.abs(norm[i] - norm[i - 1]));
  steps.sort((a, b) => a - b);
  const p90 = steps.length ? steps[Math.floor(0.9 * (steps.length - 1))] : 0;
  const vert = Math.min(MAX_VERT, p90 > 1e-9 ? maxRise / p90 : MAX_VERT);

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
