import { describe, it, expect, vi, afterEach } from 'vitest';
import { handleQuote, SYMBOL_RE } from '../worker/src/quote.js';
import { mockEnv, req } from './helpers/mock-env.js';

afterEach(() => vi.restoreAllMocks());

describe('symbol 白名單', () => {
  it('合法/非法格式', () => {
    for (const ok of ['TSLA', '2330.TW', 'BTC-USD', '^TWII', '0050.TW']) expect(SYMBOL_RE.test(ok)).toBe(true);
    for (const bad of ['<x>', 'a'.repeat(20), 'TS LA', '../etc']) expect(SYMBOL_RE.test(bad)).toBe(false);
  });
});

describe('GET /quote', () => {
  it('非法 symbol → 400', async () => {
    const res = await handleQuote(req('https://api/quote?symbol=<bad>&range=1y&interval=1d'), mockEnv(), '');
    expect(res.status).toBe(400);
  });
  it('非法 range/interval → 400', async () => {
    const res = await handleQuote(req('https://api/quote?symbol=TSLA&range=99y&interval=1s'), mockEnv(), '');
    expect(res.status).toBe(400);
  });
  it('合法請求轉發 Yahoo 並轉成 [{t,close}]', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      chart: { result: [{ timestamp: [1700000000], indicators: { quote: [{ close: [123.456] }] } }] },
    }))));
    const res = await handleQuote(req('https://api/quote?symbol=TSLA&range=1y&interval=1d'), mockEnv(), '');
    const body = await res.json();
    expect(body).toEqual([{ t: 1700000000000, close: 123.46 }]);
  });
});
