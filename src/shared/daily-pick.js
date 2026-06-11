export const PERIODS = ['3m', '6m', '1y'];

export function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function pickDaily(dateStr, pool) {
  const symbol = pool[fnv1a(dateStr) % pool.length].symbol;
  const period = PERIODS[fnv1a(dateStr + '|p') % PERIODS.length];
  return { symbol, period };
}

export function taipeiDateStr(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
}
