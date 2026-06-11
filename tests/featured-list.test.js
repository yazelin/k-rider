import { describe, it, expect } from 'vitest';
import { FEATURED, isTw } from '../src/shared/featured-list.js';

describe('featured list', () => {
  it('有 12 檔，台股 6 檔', () => {
    expect(FEATURED).toHaveLength(12);
    expect(FEATURED.filter((f) => f.market === 'tw')).toHaveLength(6);
  });
  it('每檔有雙語名稱', () => {
    for (const f of FEATURED) {
      expect(f.name['zh-TW']).toBeTruthy();
      expect(f.name.en).toBeTruthy();
    }
  });
  it('isTw 依代號判斷', () => {
    expect(isTw('2330.TW')).toBe(true);
    expect(isTw('TSLA')).toBe(false);
  });
});
