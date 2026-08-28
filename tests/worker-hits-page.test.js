import { describe, it, expect } from 'vitest';
import { aggregate, points } from '../worker/src/hits-page.js';

describe('hits dashboard', () => {
  it('把稀疏的 (day, site, n) 補成每站等長的逐日陣列', () => {
    const { days, dailyTotals, sites, grandTotal } = aggregate([
      { day: '2026-08-18', site: 'b', n: 1 },
      { day: '2026-08-18', site: 'a', n: 3 },
      { day: '2026-08-19', site: 'a', n: 5 },
    ]);
    expect(days).toEqual(['2026-08-18', '2026-08-19']);
    expect(dailyTotals).toEqual([4, 5]);
    expect(sites.map((s) => s.site)).toEqual(['a', 'b']); // 依總計排序
    expect(sites[1].byDay).toEqual([1, 0]); // 沒出現的那天要是 0,不是缺項
    expect(grandTotal).toBe(9);
  });

  it('折線座標:最大值貼上緣、0 貼下緣、橫向平均分佈', () => {
    const pts = points([0, 5, 10], { w: 100, h: 50, padX: 10, padTop: 5, padBottom: 5 });
    expect(pts).toEqual([[10, 45], [50, 25], [90, 5]]);
  });

  it('全 0 不會除以 0', () => {
    expect(points([0, 0], { w: 100, h: 50, padX: 10, padTop: 5, padBottom: 5 })).toEqual([[10, 45], [90, 45]]);
  });
});
