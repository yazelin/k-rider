const DAY = 864e5;
// epoch 1970-01-01 是週四；+4 對齊讓週一為一週起點
const weekKey = (t) => Math.floor((t / DAY + 4) / 7);
const monthKey = (t) => { const d = new Date(t); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };

export function aggregate(points, unit) {
  const keyFn = unit === 'month' ? monthKey : weekKey;
  const out = [];
  let key = null;
  for (const p of points) {
    const k = keyFn(p.t);
    if (k !== key) { out.push({ t: p.t, close: p.close }); key = k; }
    else { const last = out[out.length - 1]; last.t = p.t; last.close = p.close; }
  }
  return out;
}

const COUNTS = { '3m': 63, '6m': 126, '1y': 252 };

export function sliceForPeriod(daily, period) {
  if (period === '5y') return aggregate(daily, 'week');
  if (period === 'all') return aggregate(daily, 'month');
  const n = COUNTS[period] || 252;
  return daily.slice(-n);
}
