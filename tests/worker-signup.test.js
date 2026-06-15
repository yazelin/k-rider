import { describe, it, expect } from 'vitest';
import { handleSignup, handleList, EMAIL_RE } from '../worker/src/signup.js';

// 最小 D1 mock:可設定 run() 行為(去重 throw / 正常)與 all() 回傳
function mockDb({ runImpl, rows = [] } = {}) {
  return {
    prepare() { return this; },
    bind() { return this; },
    async run() { return runImpl ? runImpl() : { meta: { changes: 1 } }; },
    async all() { return { results: rows }; },
  };
}
// KV 永遠放行的 env
function env(extra = {}) {
  const store = new Map();
  return {
    KRIDER: { async get(k) { return store.get(k) || null; }, async put(k, v) { store.set(k, v); } },
    SIGNUPS: mockDb(),
    GIFT_URL: 'https://site/#/ride/2330.TW',
    ADMIN_TOKEN: 'secret-token',
    ...extra,
  };
}
function req(method, body, ip = '1.2.3.4') {
  return new Request('https://api/signup', {
    method,
    headers: { 'CF-Connecting-IP': ip, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('EMAIL_RE', () => {
  it('合法/非法', () => {
    for (const ok of ['a@b.co', 'x.y@z.com']) expect(EMAIL_RE.test(ok)).toBe(true);
    for (const bad of ['nope', 'a@b', 'a b@c.com', '']) expect(EMAIL_RE.test(bad)).toBe(false);
  });
});

describe('POST /signup', () => {
  it('honeypot(company 有值)→ 假成功不寫入', async () => {
    let wrote = false;
    const e = env({ SIGNUPS: { prepare() { return this; }, bind() { return this; },
      async run() { wrote = true; return { meta: { changes: 1 } }; }, async all() { return { results: [] }; } } });
    const res = await handleSignup(req('POST', { email: 'real@x.com', company: 'bot' }), e, '');
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(wrote).toBe(false);
    expect(body.gift.url).toBe('https://site/#/ride/2330.TW');
  });

  it('非法 email → 400', async () => {
    const res = await handleSignup(req('POST', { email: 'nope' }), env(), '');
    expect(res.status).toBe(400);
  });

  it('正常留資 → 200 already=false', async () => {
    const res = await handleSignup(req('POST', { email: 'a@b.co', source: 'result' }), env(), '');
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.already).toBe(false);
    expect(body.gift.label).toBeTruthy();
  });

  it('重複 email(UNIQUE)→ 200 already=true', async () => {
    const e = env({ SIGNUPS: mockDb({ runImpl: () => { throw new Error('D1_ERROR: UNIQUE constraint failed'); } }) });
    const res = await handleSignup(req('POST', { email: 'a@b.co' }), e, '');
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.already).toBe(true);
  });

  it('限流超過 → 429', async () => {
    const store = new Map();
    const kv = { async get(k) { return store.get(k) || null; }, async put(k, v) { store.set(k, v); } };
    const e = env({ KRIDER: kv });
    let last;
    for (let i = 0; i < 7; i++) last = await handleSignup(req('POST', { email: `u${i}@b.co` }), e, '');
    expect(last.status).toBe(429);
  });
});

describe('GET /admin/list', () => {
  it('無/錯 token → 401', async () => {
    const res = await handleList(new Request('https://api/admin/list'), env(), '');
    expect(res.status).toBe(401);
  });

  it('正確 Bearer token → 200 回名單', async () => {
    const e = env({ SIGNUPS: mockDb({ rows: [{ id: 2, email: 'b@x.co', created_at: 't2', source: 'about' }] }) });
    const r = new Request('https://api/admin/list', { headers: { Authorization: 'Bearer secret-token' } });
    const res = await handleList(r, e, '');
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.count).toBe(1);
    expect(body.rows[0].email).toBe('b@x.co');
  });
});
