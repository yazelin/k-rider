import { describe, it, expect } from 'vitest';
import { fnv1a, pickDaily, taipeiDateStr, PERIODS } from '../src/shared/daily-pick.js';
import { FEATURED } from '../src/shared/featured-list.js';

describe('daily pick', () => {
  it('fnv1a 穩定（regression 錨點）', () => {
    expect(fnv1a('2026-06-12')).toBe(fnv1a('2026-06-12'));
    expect(fnv1a('a')).not.toBe(fnv1a('b'));
  });
  it('同日期永遠選同一檔同區間', () => {
    const a = pickDaily('2026-06-12', FEATURED);
    const b = pickDaily('2026-06-12', FEATURED);
    expect(a).toEqual(b);
    expect(FEATURED.some((f) => f.symbol === a.symbol)).toBe(true);
    expect(PERIODS).toContain(a.period);
  });
  it('一個月內 12 檔輪到至少 8 檔（分布健檢）', () => {
    const seen = new Set();
    for (let d = 1; d <= 30; d++) seen.add(pickDaily(`2026-06-${String(d).padStart(2, '0')}`, FEATURED).symbol);
    expect(seen.size).toBeGreaterThanOrEqual(8);
  });
  it('taipeiDateStr 轉出 UTC+8 日期', () => {
    // 2026-06-11 23:00 UTC = 台北 06-12 07:00
    expect(taipeiDateStr(new Date('2026-06-11T23:00:00Z'))).toBe('2026-06-12');
  });
});
