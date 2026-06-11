import { describe, it, expect } from 'vitest';
import { aggregate, sliceForPeriod } from '../src/shared/candles.js';

const DAY = 864e5;
// 2024-01-01 (一) 起連續 400 個「交易日」（略過週末不影響聚合正確性驗證，直接連續日）
const daily = Array.from({ length: 400 }, (_, i) => ({
  t: Date.UTC(2024, 0, 1) + i * DAY,
  close: 100 + i,
}));

describe('aggregate', () => {
  it('週聚合：每週取最後一筆 close', () => {
    const w = aggregate(daily.slice(0, 14), 'week');
    expect(w.length).toBeGreaterThanOrEqual(2);
    expect(w.length).toBeLessThanOrEqual(3);
    expect(w[w.length - 1].close).toBe(113); // 最後一筆
  });
  it('月聚合：每月取最後一筆', () => {
    const m = aggregate(daily.slice(0, 60), 'month');
    expect(m[0].close).toBe(130); // 2024-01 最後一天 = 1/31 → close 100+30
    expect(m.length).toBe(2);
  });
  it('聚合結果單調遞增 t', () => {
    const w = aggregate(daily, 'week');
    for (let i = 1; i < w.length; i++) expect(w[i].t).toBeGreaterThan(w[i - 1].t);
  });
});

describe('sliceForPeriod', () => {
  it('3m/6m/1y 取對應筆數日K', () => {
    expect(sliceForPeriod(daily, '3m')).toHaveLength(63);
    expect(sliceForPeriod(daily, '6m')).toHaveLength(126);
    expect(sliceForPeriod(daily, '1y')).toHaveLength(252);
  });
  it('資料不足時回傳全部', () => {
    expect(sliceForPeriod(daily.slice(0, 30), '1y')).toHaveLength(30);
  });
  it('5y 回週K、all 回月K', () => {
    expect(sliceForPeriod(daily, '5y').length).toBeLessThan(70);
    expect(sliceForPeriod(daily, 'all').length).toBeLessThan(16);
  });
});
