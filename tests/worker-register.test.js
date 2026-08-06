import { describe, expect, it } from 'vitest';
import { handleRegister } from '../worker/src/register.js';

function makeEnv() {
  const limits = new Map();
  let wrote = false;
  let bound = [];
  return {
    env: {
      KRIDER: {
        async get(key) { return limits.get(key) || null; },
        async put(key, value) { limits.set(key, value); },
      },
      SIGNUPS: {
        prepare() { return this; },
        bind(...args) { bound = args; return this; },
        async run() { wrote = true; return { meta: { changes: 1 } }; },
      },
    },
    wrote: () => wrote,
    flagged: () => bound.at(-1),
  };
}

function request(batch, extra = {}) {
  return new Request('https://api/register', {
    method: 'POST',
    headers: {
      'CF-Connecting-IP': '1.2.3.4',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      name: '測試者',
      email: 'tester@example.com',
      note: '',
      batch,
      ...extra,
    }),
  });
}

describe('POST /register 報名截止', () => {
  // 擋錯的代價比收錯高:被自動填入的真人會以為報名成功、名單裡卻沒有他，
  // 而且他看不到那個欄位、沒辦法自己清掉。所以命中只標記，不擋。
  it('honeypot(company 有值)照樣寫入 D1，只標記 flagged=1', async () => {
    const state = makeEnv();
    const response = await handleRegister(
      request('sticker-2026-08-05-feedback', { company: 'browser-autofill' }),
      state.env,
      'https://yazelin.github.io',
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, already: false });
    expect(state.wrote()).toBe(true);
    expect(state.flagged()).toBe(1);
  });

  it('一般送出 flagged=0', async () => {
    const state = makeEnv();
    const response = await handleRegister(
      request('sticker-2026-08-05-feedback'),
      state.env,
      'https://yazelin.github.io',
    );

    expect(response.status).toBe(200);
    expect(state.wrote()).toBe(true);
    expect(state.flagged()).toBe(0);
  });

  it('已額滿梯次回 409，且不寫入 D1', async () => {
    const state = makeEnv();
    const response = await handleRegister(
      request('sticker-2026-08-05'),
      state.env,
      'https://yazelin.github.io',
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'registration_closed' });
    expect(state.wrote()).toBe(false);
  });

  it('其他梯次仍可正常報名', async () => {
    const state = makeEnv();
    const response = await handleRegister(
      request('comic-2026-08-19'),
      state.env,
      'https://yazelin.github.io',
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, already: false });
    expect(state.wrote()).toBe(true);
  });
});
