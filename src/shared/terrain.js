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

  let maxStep = 0;
  for (let i = 1; i < norm.length; i++) maxStep = Math.max(maxStep, Math.abs(norm[i] - norm[i - 1]));
  const maxRise = Math.tan(MAX_SLOPE_RAD) * SPACING;
  const vert = Math.min(MAX_VERT, maxStep > 0 ? maxRise / maxStep : MAX_VERT);

  const vertices = norm.map((v, i) => ({ x: i * SPACING, y: BASE_Y - v * vert }));
  const segments = [];
  for (let i = 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    segments.push({ i0: i - 1, i1: i, dir: d > 0 ? 'up' : d < 0 ? 'down' : 'flat' });
  }
  return { vertices, segments, meta: { min, max, vert, points } };
}
