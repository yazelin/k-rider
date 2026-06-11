import { describe, it, expect } from 'vitest';
import { bigMoveDates, missingDates } from '../scripts/gen-events.mjs';

const mk = (closes) => closes.map((close, i) => ({ t: Date.UTC(2026, 0, 1 + i), close }));

describe('bigMoveDates', () => {
  it('挑出 |漲跌| >= 5% 的日子', () => {
    const daily = mk([100, 106, 106, 100, 100.5]);
    const hits = bigMoveDates(daily, 5);
    expect(hits).toHaveLength(2);
    expect(hits[0]).toMatchObject({ date: '2026-01-02' });
    expect(hits[0].pct).toBeCloseTo(6, 1);
    expect(hits[1].pct).toBeLessThan(0);
  });
  it('ETF 用 3% 門檻', () => {
    expect(bigMoveDates(mk([100, 104]), 3)).toHaveLength(1);
    expect(bigMoveDates(mk([100, 104]), 5)).toHaveLength(0);
  });
});

describe('missingDates', () => {
  it('已生成的日期不重打', () => {
    const hits = [{ date: 'a' }, { date: 'b' }];
    expect(missingDates(hits, { a: {} })).toEqual([{ date: 'b' }]);
  });
});
