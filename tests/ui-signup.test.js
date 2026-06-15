import { describe, it, expect } from 'vitest';
import { describeSignupResult } from '../src/ui/signup.js';

describe('describeSignupResult', () => {
  it('非成功 body → 空殼', () => {
    expect(describeSignupResult(null)).toEqual({ ok: false, already: false, gift: null, message: '' });
    expect(describeSignupResult({ error: 'bad_email' })).toEqual({ ok: false, already: false, gift: null, message: '' });
  });
  it('首次成功 → message + gift', () => {
    const r = describeSignupResult({ ok: true, already: false, gift: { url: 'u', label: 'L' } });
    expect(r.ok).toBe(true);
    expect(r.already).toBe(false);
    expect(r.gift).toEqual({ url: 'u', label: 'L' });
    expect(r.message).toContain('登記');
  });
  it('已在名單 → already 文案、仍給 gift', () => {
    const r = describeSignupResult({ ok: true, already: true, gift: { url: 'u', label: 'L' } });
    expect(r.already).toBe(true);
    expect(r.gift.url).toBe('u');
    expect(r.message).toContain('已經');
  });
});
