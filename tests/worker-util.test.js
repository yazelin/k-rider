// tests/worker-util.test.js
import { describe, it, expect } from 'vitest';
import { sanitizeNickname, corsHeaders, isAllowedOrigin } from '../worker/src/util.js';

describe('sanitizeNickname', () => {
  it('去 HTML、截 16 字、空白給預設', () => {
    expect(sanitizeNickname('<b>hi</b>')).toBe('hi');
    expect(sanitizeNickname('a'.repeat(30))).toHaveLength(16);
    expect(sanitizeNickname('  ')).toBe('rider');
    expect(sanitizeNickname('騎士<script>')).toBe('騎士');
  });
});

describe('cors', () => {
  it('允許 Pages 網域與 localhost', () => {
    expect(isAllowedOrigin('https://yazelin.github.io')).toBe(true);
    expect(isAllowedOrigin('http://localhost:5173')).toBe(true);
    expect(isAllowedOrigin('https://evil.example')).toBe(false);
  });
  it('corsHeaders 回 echo origin', () => {
    expect(corsHeaders('https://yazelin.github.io')['Access-Control-Allow-Origin']).toBe('https://yazelin.github.io');
  });
});
