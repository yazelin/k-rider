import { describe, it, expect } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { transformChart, validateDaily, computeMeta, writeIfChanged } from '../scripts/fetch-data.mjs';
import sample from './fixtures/yahoo-chart-sample.json';

describe('transformChart', () => {
  it('轉成 {t, close}，濾掉 null，close 取兩位', () => {
    const pts = transformChart(sample);
    expect(pts).toHaveLength(2);
    expect(pts[0]).toEqual({ t: 1749600000000, close: 1000.5 });
    expect(pts[1].close).toBe(1010.12);
  });
});

describe('validateDaily', () => {
  const now = new Date('2026-06-12T00:00:00Z').getTime();
  const mk = (n, lastT) => Array.from({ length: n }, (_, i) => ({ t: lastT - (n - 1 - i) * 864e5, close: 100 }));
  it('點數足夠且日期新 → 過', () => {
    expect(validateDaily(mk(150, now - 864e5), 'TSLA', now)).toBe(true);
  });
  it('點數太少 → 不過', () => {
    expect(validateDaily(mk(50, now - 864e5), 'TSLA', now)).toBe(false);
  });
  it('資料太舊 → 不過', () => {
    expect(validateDaily(mk(150, now - 30 * 864e5), 'TSLA', now)).toBe(false);
  });
});

describe('computeMeta', () => {
  it('算波動度/難度/年漲跌%', () => {
    const daily = Array.from({ length: 300 }, (_, i) => ({ t: i * 864e5, close: 100 * Math.pow(1.001, i) }));
    const meta = computeMeta(daily, { symbol: 'X', market: 'us', name: { 'zh-TW': 'X', en: 'X' } });
    expect(meta.difficulty).toBe('easy');           // 等比上漲＝零波動
    expect(meta.changePct).toBeGreaterThan(0);
    expect(meta.lastClose).toBeCloseTo(daily.at(-1).close, 2);
  });
});

describe('writeIfChanged', () => {
  it('內容相同（忽略 updated）不重寫', () => {
    const dir = mkdtempSync(join(tmpdir(), 'kr-'));
    const f = join(dir, 'a.json');
    expect(writeIfChanged(f, { v: 1, updated: 'a' })).toBe(true);
    expect(writeIfChanged(f, { v: 1, updated: 'b' })).toBe(false);
    expect(writeIfChanged(f, { v: 2, updated: 'b' })).toBe(true);
  });
});
