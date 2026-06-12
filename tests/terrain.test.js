import { describe, it, expect } from 'vitest';
import { buildTerrain, SPACING, MAX_SLOPE_RAD, MAX_VERT } from '../src/shared/terrain.js';

const mk = (closes) => closes.map((close, i) => ({ t: i * 864e5, close }));

describe('buildTerrain', () => {
  it('頂點數 = 資料點數，水平等距', () => {
    const t = buildTerrain(mk([10, 11, 12, 11]));
    expect(t.vertices).toHaveLength(4);
    expect(t.vertices[1].x - t.vertices[0].x).toBe(SPACING);
  });
  it('價格高 → y 小（畫布座標向下為正）', () => {
    const t = buildTerrain(mk([10, 20]));
    expect(t.vertices[1].y).toBeLessThan(t.vertices[0].y);
  });
  it('坡度不超過上限（暴漲暴跌資料）', () => {
    const t = buildTerrain(mk([1, 100, 1, 100, 1]));
    for (let i = 1; i < t.vertices.length; i++) {
      const dy = Math.abs(t.vertices[i].y - t.vertices[i - 1].y);
      const slope = Math.atan2(dy, SPACING);
      expect(slope).toBeLessThanOrEqual(MAX_SLOPE_RAD + 1e-9);
    }
  });
  it('segments 帶漲跌方向', () => {
    const t = buildTerrain(mk([10, 12, 12, 9]));
    expect(t.segments.map((s) => s.dir)).toEqual(['up', 'flat', 'down']);
  });
  it('smooth 模式降低高低差總量', () => {
    // 趨勢（sin）+ 高頻雜訊（±3）：smooth 應壓掉雜訊、保留趨勢
    const closes = Array.from({ length: 200 }, (_, i) => 100 + 10 * Math.sin(i / 10) + (i % 2 ? 3 : -3));
    const rough = buildTerrain(mk(closes));
    const smooth = buildTerrain(mk(closes), { smooth: true });
    const wiggle = (t) => t.vertices.reduce((s, v, i) => (i ? s + Math.abs(v.y - t.vertices[i - 1].y) : 0), 0);
    expect(wiggle(smooth)).toBeLessThan(wiggle(rough));
  });
  it('緩坡走勢用滿垂直幅度（高度貼近真實線圖）', () => {
    const t = buildTerrain(mk(Array.from({ length: 100 }, (_, i) => 100 + i)));
    const ys = t.vertices.map((v) => v.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(MAX_VERT * 0.95);
  });
  it('單日大跳空不再壓扁整條賽道（陡段以 50° 坡爬向目標）', () => {
    const closes = [...Array(50).fill(100), ...Array(50).fill(200)];
    const t = buildTerrain(mk(closes));
    const ys = t.vertices.map((v) => v.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(MAX_VERT * 0.8); // 舊演算法只剩 ~71px
    for (let i = 1; i < t.vertices.length; i++) {
      const slope = Math.atan2(Math.abs(t.vertices[i].y - t.vertices[i - 1].y), SPACING);
      expect(slope).toBeLessThanOrEqual(MAX_SLOPE_RAD + 1e-9);
    }
  });
});
