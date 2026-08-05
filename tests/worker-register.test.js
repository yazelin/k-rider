import { describe, expect, it } from 'vitest';
import { handleRegister } from '../worker/src/register.js';

function makeEnv() {
  const limits = new Map();
  let wrote = false;
  return {
    env: {
      KRIDER: {
        async get(key) { return limits.get(key) || null; },
        async put(key, value) { limits.set(key, value); },
      },
      SIGNUPS: {
        prepare() { return this; },
        bind() { return this; },
        async run() { wrote = true; return { meta: { changes: 1 } }; },
      },
    },
    wrote: () => wrote,
  };
}

function request(batch) {
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
    }),
  });
}

describe('POST /register 報名截止', () => {
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
