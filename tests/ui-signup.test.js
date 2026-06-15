import { describe, it, expect } from 'vitest';
import { describeSignupResult } from '../src/ui/signup.js';

describe('describeSignupResult', () => {
  it('非成功 body → 空殼(無 message key、非 badEmail)', () => {
    expect(describeSignupResult(null)).toEqual({ ok: false, already: false, badEmail: false, gift: null, messageKey: '' });
  });
  it('400 bad_email → badEmail 旗標,讓呼叫端顯示格式提示', () => {
    const r = describeSignupResult({ error: 'bad_email' });
    expect(r.ok).toBe(false);
    expect(r.badEmail).toBe(true);
    expect(r.messageKey).toBe('');
  });
  it('其他輸入錯誤(bad_request)亦視為 badEmail', () => {
    expect(describeSignupResult({ error: 'bad_request' }).badEmail).toBe(true);
  });
  it('首次成功 → okFirst key + gift', () => {
    const r = describeSignupResult({ ok: true, already: false, gift: { url: 'u', label: 'L' } });
    expect(r.ok).toBe(true);
    expect(r.already).toBe(false);
    expect(r.badEmail).toBe(false);
    expect(r.gift).toEqual({ url: 'u', label: 'L' });
    expect(r.messageKey).toBe('signup.okFirst');
  });
  it('已在名單 → okAlready key、仍給 gift', () => {
    const r = describeSignupResult({ ok: true, already: true, gift: { url: 'u', label: 'L' } });
    expect(r.already).toBe(true);
    expect(r.gift.url).toBe('u');
    expect(r.messageKey).toBe('signup.okAlready');
  });
});
