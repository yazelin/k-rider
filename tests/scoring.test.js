import { describe, it, expect } from 'vitest';
import { score, maxPlausible } from '../src/shared/scoring.js';

const base = { pointsPassed: 0, nitroPointsPassed: 0, airSegmentsMs: [], flips: 0, wheelieMs: 0, finished: false, nitroLeftRatio: 0 };

describe('score', () => {
  it('過點每個 100 分', () => expect(score({ ...base, pointsPassed: 10 })).toBe(1000));
  it('氮氣中過點翻倍（額外 +100）', () =>
    expect(score({ ...base, pointsPassed: 10, nitroPointsPassed: 4 })).toBe(1400));
  it('騰空每秒 50，連續疊乘 1.1x 上限 2x', () => {
    expect(score({ ...base, airSegmentsMs: [1000] })).toBe(50);
    expect(score({ ...base, airSegmentsMs: [2000] })).toBe(50 + 55);
    const long = score({ ...base, airSegmentsMs: [20000] });
    expect(long).toBe(1773); // 每秒封頂 100（1.1^8 起鎖 2x），釘死回歸值
  });
  it('惡意超長騰空不會熱迴圈（單段封頂 120s）', () => {
    expect(score({ ...base, airSegmentsMs: [Number.MAX_SAFE_INTEGER] }))
      .toBe(score({ ...base, airSegmentsMs: [120000] }));
  });
  it('空翻 1000、孤輪每秒 30', () =>
    expect(score({ ...base, flips: 2, wheelieMs: 3500 })).toBe(2000 + 90));
  it('完賽 +5000 + 剩餘氮氣比例x2000', () =>
    expect(score({ ...base, finished: true, nitroLeftRatio: 0.5 })).toBe(6000));
  it('COMBO 加成累加、翻車每次 -500、不會負分', () => {
    expect(score({ ...base, comboBonus: 2000 })).toBe(2000);
    expect(score({ ...base, pointsPassed: 10, crashes: 1 })).toBe(500);
    expect(score({ ...base, crashes: 9 })).toBe(0); // floor 0
  });
});

describe('maxPlausible', () => {
  it('合法高分 < 上限，灌水分 > 上限', () => {
    const n = 252;
    const legit = score({ pointsPassed: n, nitroPointsPassed: n, airSegmentsMs: [30000], flips: 20, wheelieMs: 60000, finished: true, nitroLeftRatio: 1 });
    expect(legit).toBeLessThanOrEqual(maxPlausible(n));
    expect(99999999).toBeGreaterThan(maxPlausible(n));
  });
});
