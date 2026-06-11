import { describe, it, expect } from 'vitest';
import zh from '../src/i18n/zh-TW.js';
import en from '../src/i18n/en.js';

describe('i18n dictionaries', () => {
  it('zh-TW 與 en key 集合一致', () => {
    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort());
  });
  it('無空字串', () => {
    for (const d of [zh, en]) for (const [k, v] of Object.entries(d)) expect(v, k).toBeTruthy();
  });
});
