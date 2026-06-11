import { describe, it, expect } from 'vitest';
import { countFlips, pointIndexAt } from '../src/game/run.js';
import { SPACING } from '../src/shared/terrain.js';

describe('countFlips', () => {
  it('累計旋轉每滿 2π 記一圈（雙向皆可）', () => {
    expect(countFlips(Math.PI * 2.1)).toBe(1);
    expect(countFlips(-Math.PI * 4.2)).toBe(2);
    expect(countFlips(Math.PI)).toBe(0);
  });
});

describe('pointIndexAt', () => {
  it('x 座標 → 已通過的資料點 index', () => {
    expect(pointIndexAt(0)).toBe(0);
    expect(pointIndexAt(SPACING * 3 + 1)).toBe(3);
    expect(pointIndexAt(-5)).toBe(0);
  });
});
