export function score(ev) {
  let s = (ev.pointsPassed || 0) * 100 + (ev.nitroPointsPassed || 0) * 100;
  for (const ms of ev.airSegmentsMs || []) {
    // 單段封頂 120s：此函式可能在 Worker 收到不可信輸入時被呼叫，避免熱迴圈
    const secs = Math.min(Math.floor(ms / 1000), 120);
    for (let i = 1; i <= secs; i++) s += Math.round(50 * Math.min(Math.pow(1.1, i - 1), 2));
  }
  s += (ev.flips || 0) * 1000 + Math.floor((ev.wheelieMs || 0) / 1000) * 30;
  if (ev.finished) s += 5000 + Math.round((ev.nitroLeftRatio || 0) * 2000);
  return s;
}

// 寬鬆理論上限：過點(含氮氣全程) 200n + 騰空(每點≤1.5s, 每秒封頂100) 150n
// + 空翻(每4點最多一圈 → ceil(n/4)*1000) + 孤輪 45n + 完賽 7000
export function maxPlausible(pointCount) {
  const n = pointCount;
  return 200 * n + 150 * n + Math.ceil(n / 4) * 1000 + 45 * n + 7000;
}
