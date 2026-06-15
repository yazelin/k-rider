# K-Rider 漏斗 + 教學版 case study Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 給 K-Rider 補上 email 留資漏斗(收名單 + 即時兌現 + 後台)並把既有內部 spec 轉成教學版 case study,讓它成為課程體系名副其實的「天花板案例」。

**Architecture:** 後端擴充既有 `k-rider-api` Worker —— 新增 `POST /signup`(honeypot + KV 限流 + D1 `UNIQUE(email)` 去重 + 回 gift 連結)與 `GET /admin/list`(Bearer token);名單存新建 D1 `k-rider-signups`。前端在結算頁/about 加零依賴留資表單,成功當場顯示「精選挑戰賽道」連結兌現。`public/admin.html` 看名單。最後把內部 spec 轉教學版 case study 並做課程雙向導流。

**Tech Stack:** Cloudflare Workers + D1 + KV、Vite + vanilla JS、Vitest。Worker 慣例:handler `(req, env, origin)` → 回 `json(data, origin, status)`(見 `worker/src/util.js`)。

---

## File Structure

- `worker/src/signup.js`（建立）— `handleSignup` + `handleList`,純 Worker 邏輯
- `worker/src/index.js`（改 18-24 行附近）— 掛 `/signup`、`/admin/list` 路由
- `worker/schema.sql`（建立）— D1 `signups` 表
- `worker/wrangler.toml`（改）— 加 `[[d1_databases]]` binding + `[vars] GIFT_URL`
- `tests/worker-signup.test.js`（建立）— signup/list 單元測試
- `src/ui/signup.js`（建立）— `describeSignupResult` 純函式 + `initSignup` DOM 接線
- `tests/ui-signup.test.js`（建立）— `describeSignupResult` 純函式測試
- `src/ui/api.js`（改）— 加 `signup(payload)`
- `src/ui/settle.js`（改）— 結算頁底掛留資表單
- `src/ui/about.js`（改）— about 頁次要留資入口
- `src/style.css`（改）— 留資表單 lux 樣式 + honeypot 隱藏
- `public/admin.html`（建立）— 名單後台
- `README.md`（改）— 新端點 / D1 / admin / 漏斗說明
- `docs/case-study/README.md`（建立）— 教學版 case study
- (另一 repo)`/home/ct/ai-marketing-pages-course` course 側連結 —— 見 Task B3,**分開 branch、發佈由 user 拍板**

---

## Deliverable A — 後端 Worker

### Task A1: D1 schema 與 wrangler binding

**Files:**
- Create: `worker/schema.sql`
- Modify: `worker/wrangler.toml`

- [ ] **Step 1: 寫 schema.sql**

```sql
-- K-Rider email 留資名單(D1)
CREATE TABLE IF NOT EXISTS signups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  source TEXT,            -- 'result' | 'about':辨識留資位置
  ip TEXT
);
```

- [ ] **Step 2: wrangler.toml 加 D1 binding 與 GIFT_URL**

在現有檔尾(保留既有 `name` / KV / observability)追加:

```toml
[[d1_databases]]
binding = "SIGNUPS"
database_name = "k-rider-signups"
database_id = "PLACEHOLDER_FILLED_AT_DEPLOY"  # Task A4 wrangler d1 create 後填回

[vars]
GIFT_URL = "https://yazelin.github.io/k-rider/#/ride/2330.TW"
```

- [ ] **Step 3: Commit**

```bash
git add worker/schema.sql worker/wrangler.toml
git commit -m "feat(worker): D1 signups schema + wrangler binding"
```

---

### Task A2: signup Worker 邏輯(TDD)

**Files:**
- Create: `tests/worker-signup.test.js`
- Create: `worker/src/signup.js`

- [ ] **Step 1: 寫失敗測試**

```js
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
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run tests/worker-signup.test.js`
Expected: FAIL —— `handleSignup is not defined`(模組尚未建立)

- [ ] **Step 3: 寫 worker/src/signup.js**

```js
// worker/src/signup.js
import { json, rateLimit } from './util.js';

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const SIGNUP_LIMIT = 6;           // 每 IP 每日上限(KV 近似限流)
const SIGNUP_ROUTE = 'signup';

const clientIp = (req) => req.headers.get('CF-Connecting-IP') || 'unknown';
const today = () => new Date().toISOString().slice(0, 10);
const gift = (env) => ({ url: env.GIFT_URL, label: '先解鎖這條精選挑戰賽道' });

export async function handleSignup(req, env, origin) {
  const ip = clientIp(req);
  if (!(await rateLimit(env, SIGNUP_ROUTE, ip, SIGNUP_LIMIT, today()))) {
    return json({ error: 'rate_limited' }, origin, 429);
  }

  let body = {};
  try { body = await req.json(); } catch { /* 空 body 當非法 email 處理 */ }

  // honeypot:真人不會填 company;有值假裝成功、不寫入
  if (body.company) return json({ ok: true, already: false, gift: gift(env) }, origin, 200);

  const email = String(body.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 120) {
    return json({ error: 'bad_email' }, origin, 400);
  }
  const source = ['result', 'about'].includes(body.source) ? body.source : null;
  const now = new Date().toISOString();

  try {
    await env.SIGNUPS
      .prepare('INSERT INTO signups (email, created_at, source, ip) VALUES (?, ?, ?, ?)')
      .bind(email, now, source, ip)
      .run();
    return json({ ok: true, already: false, gift: gift(env) }, origin, 200);
  } catch (e) {
    if (String(e).includes('UNIQUE')) {
      return json({ ok: true, already: true, gift: gift(env) }, origin, 200);
    }
    console.error('signup db', e);
    return json({ error: 'db_failed' }, origin, 500);
  }
}

export async function handleList(req, env, origin) {
  const auth = req.headers.get('Authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!env.ADMIN_TOKEN || bearer !== env.ADMIN_TOKEN) {
    return json({ error: 'unauthorized' }, origin, 401);
  }
  const { results } = await env.SIGNUPS
    .prepare('SELECT id, email, created_at, source FROM signups ORDER BY id DESC LIMIT 500')
    .all();
  return json({ count: results.length, rows: results }, origin, 200);
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run tests/worker-signup.test.js`
Expected: PASS（全部 7 個 it 綠）

- [ ] **Step 5: Commit**

```bash
git add tests/worker-signup.test.js worker/src/signup.js
git commit -m "feat(worker): /signup + /admin/list handlers (honeypot, dedup, bearer)"
```

---

### Task A3: 掛路由進 index.js

**Files:**
- Modify: `worker/src/index.js`

- [ ] **Step 1: import 與路由(改 index.js)**

在 import 區加:

```js
import { handleSignup, handleList } from './signup.js';
```

在 `/event` 路由那行之後、`return json({ error: 'not found' }...)` 之前加:

```js
      if (url.pathname === '/signup' && req.method === 'POST') return await handleSignup(req, env, origin);
      if (url.pathname === '/admin/list' && req.method === 'GET') return await handleList(req, env, origin);
```

- [ ] **Step 2: 跑全 worker 測試不回歸**

Run: `npx vitest run tests/worker-signup.test.js tests/worker-util.test.js`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add worker/src/index.js
git commit -m "feat(worker): route /signup and /admin/list"
```

---

### Task A4: 建立 D1 + 部署(ops,非 TDD)

**Files:** 無程式碼;產生 `database_id` 填回 `worker/wrangler.toml`

> 前提:`npx wrangler whoami` 顯示 `yaze.lin.j303@gmail.com`(具 d1/workers write)。在 `worker/` 目錄執行。

- [ ] **Step 1: 建 D1**

Run: `cd worker && npx wrangler d1 create k-rider-signups`
把輸出的 `database_id` 填回 `worker/wrangler.toml` 的 `PLACEHOLDER_FILLED_AT_DEPLOY`。

- [ ] **Step 2: 套 schema 到遠端**

Run: `npx wrangler d1 execute k-rider-signups --remote --file schema.sql`
Expected: 建表成功、無錯。

- [ ] **Step 3: 設 ADMIN_TOKEN secret**

Run: `npx wrangler secret put ADMIN_TOKEN`
貼一個隨機長字串。**值記到 dev 筆記,不進 repo、不進記憶。**

- [ ] **Step 4: 部署**

Run: `npx wrangler deploy`
Expected: 部署到 `k-rider-api`,綁定列出 KV `KRIDER` + D1 `SIGNUPS`。

- [ ] **Step 5: 煙霧測試**

```bash
API=https://k-rider-api.yazelinj303.workers.dev
# 正常留資
curl -s -X POST $API/signup -H 'content-type: application/json' \
  -H 'Origin: https://yazelin.github.io' -d '{"email":"smoke@test.dev","source":"result"}'
# 再送一次同 email → already:true
curl -s -X POST $API/signup -H 'content-type: application/json' \
  -H 'Origin: https://yazelin.github.io' -d '{"email":"smoke@test.dev"}'
# honeypot → ok 但不入庫
curl -s -X POST $API/signup -H 'content-type: application/json' \
  -H 'Origin: https://yazelin.github.io' -d '{"email":"bot@test.dev","company":"x"}'
# admin 無 token → 401
curl -s -o /dev/null -w "%{http_code}\n" $API/admin/list
# admin 帶 token → 名單(含 smoke@test.dev、不含 bot@test.dev)
curl -s $API/admin/list -H "Authorization: Bearer <剛設的 token>"
```
Expected: 第一筆 `already:false`、第二筆 `already:true`、honeypot `ok:true`、無 token `401`、有 token 回 `rows` 含 smoke 不含 bot。

- [ ] **Step 6: 清掉煙霧資料**

Run: `npx wrangler d1 execute k-rider-signups --remote --command "DELETE FROM signups WHERE email LIKE '%@test.dev'"`

- [ ] **Step 7: Commit wrangler.toml(已填 database_id)**

```bash
git add worker/wrangler.toml
git commit -m "chore(worker): bind deployed k-rider-signups D1 id"
```

---

## Deliverable A — 前端

### Task A5: signup 純函式 + DOM 接線(TDD)

**Files:**
- Create: `tests/ui-signup.test.js`
- Create: `src/ui/signup.js`

- [ ] **Step 1: 寫失敗測試(純函式)**

```js
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
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run tests/ui-signup.test.js`
Expected: FAIL —— `describeSignupResult is not defined`

- [ ] **Step 3: 寫 src/ui/signup.js**

```js
// src/ui/signup.js
// 漏斗留資:免費價值先給(遊戲免費玩),留 email 換「每日挑戰提醒」+ 當場兌現精選賽道。
// honeypot:藏一個 name=company 欄位(CSS 移出視野),真人不填;有值 Worker 端假成功。
import { signup } from './api.js';

// 純函式:把 /signup 回應轉成顯示內容(非成功一律空殼)
export function describeSignupResult(body) {
  if (!body || typeof body !== 'object' || body.ok !== true) {
    return { ok: false, already: false, gift: null, message: '' };
  }
  const already = body.already === true;
  const gift = body.gift && typeof body.gift.url === 'string' ? body.gift : null;
  return {
    ok: true,
    already,
    gift,
    message: already
      ? '你已經在每日挑戰名單上了 —— 賽道連結照樣再給你一次:'
      : 'Email 已登記,每日挑戰提醒收到囉。先給你一條:',
  };
}

// DOM 接線。els:{ form, emailInput, companyInput, submitBtn, msgEl, giftEl, giftLink }
// source:'result' | 'about'。deps.signup 可注入以利測試,預設用 api.signup。
export function initSignup(els, { source = 'result' } = {}, deps = {}) {
  const doSignup = deps.signup || signup;
  const { form, emailInput, companyInput, submitBtn, msgEl, giftEl, giftLink } = els;

  const show = (text, ok = false) => {
    msgEl.textContent = text || '';
    msgEl.hidden = !text;
    msgEl.classList.toggle('is-ok', ok);
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    if (!email) { show('先填 Email,挑戰提醒馬上開始。'); return; }
    submitBtn.disabled = true;
    show('');
    try {
      const body = await doSignup({ email, company: companyInput.value, source });
      const r = describeSignupResult(body);
      if (!r.ok) { show('送出失敗,稍後再試。'); return; }
      show(r.message, true);
      if (r.gift) {
        giftLink.href = r.gift.url;
        giftLink.textContent = r.gift.label;
        giftEl.hidden = false;
      }
      form.querySelector('.signup-fields')?.setAttribute('hidden', '');
    } catch {
      show('連線出了點問題,稍後再試。');
    } finally {
      submitBtn.disabled = false;
    }
  });
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run tests/ui-signup.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/ui-signup.test.js src/ui/signup.js
git commit -m "feat(ui): signup module (describeSignupResult + initSignup)"
```

---

### Task A6: api.signup + 結算/about 表單 + 樣式

**Files:**
- Modify: `src/ui/api.js`
- Modify: `src/ui/settle.js`
- Modify: `src/ui/about.js`
- Modify: `src/style.css`

- [ ] **Step 1: api.js 加 signup()**

先看 `src/ui/api.js` 既有的 base URL 常數(如 `API_BASE`/`BASE`)與既有 POST helper,沿用同一個 base。新增:

```js
// email 留資。回 /signup 的 JSON body(成功/already/錯誤都回 body,呼叫端用 describeSignupResult 判讀)
export async function signup({ email, company = '', source = 'result' }) {
  const res = await fetch(`${API_BASE}/signup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, company, source }),
  });
  return res.json();
}
```
（若既有常數名不是 `API_BASE`,改成檔案實際使用的名稱。）

- [ ] **Step 2: 結算頁掛表單(settle.js)**

在 `src/ui/settle.js` 結算內容尾段(BMC CTA 附近)插入留資區塊,並在 render 後接線。HTML 片段(沿用 lux class):

```html
<section class="signup lux">
  <h3 class="signup-title">訂閱每日挑戰提醒</h3>
  <p class="signup-sub">每天一條精選台股 K 線,賽道直接寄到信箱。免費,隨時退訂。</p>
  <form class="signup-form" novalidate>
    <div class="signup-fields">
      <input class="signup-email" type="email" inputmode="email" autocomplete="email" placeholder="you@example.com" aria-label="Email" />
      <input class="signup-hp" type="text" name="company" tabindex="-1" autocomplete="off" aria-hidden="true" />
      <button class="signup-go lux-btn" type="submit">加入每日挑戰</button>
    </div>
    <p class="signup-msg" hidden></p>
    <p class="signup-gift" hidden>👉 <a class="signup-gift-link" href="#"></a></p>
  </form>
</section>
```

接線(在該頁 DOM 建好後):

```js
import { initSignup } from './signup.js';
// ...settle render 完成後:
const sform = root.querySelector('.signup-form');
if (sform) initSignup({
  form: sform,
  emailInput: sform.querySelector('.signup-email'),
  companyInput: sform.querySelector('.signup-hp'),
  submitBtn: sform.querySelector('.signup-go'),
  msgEl: sform.querySelector('.signup-msg'),
  giftEl: sform.querySelector('.signup-gift'),
  giftLink: sform.querySelector('.signup-gift-link'),
}, { source: 'result' });
```
（`root` 換成 settle.js 實際的容器變數名;`sform` 命名避免和外層衝突。）

- [ ] **Step 3: about 頁次要入口(about.js)**

在 `src/ui/about.js` 適當段落插入同樣的 `.signup` 區塊(標題可改「每日一條挑戰」),接線時 `source: 'about'`。

- [ ] **Step 4: 樣式(style.css)**

在 `src/style.css` 末尾加(用既有 token,不寫死色):

```css
/* email 留資漏斗(lux) */
.signup { margin: 2rem auto 0; max-width: 30rem; text-align: center; }
.signup-title { font-family: var(--serif, serif); letter-spacing: .04em; }
.signup-sub { color: var(--c-ink-dim, #aab3c5); font-size: .9rem; margin: .3rem 0 1rem; }
.signup-fields { display: flex; gap: .5rem; flex-wrap: wrap; justify-content: center; }
.signup-email { flex: 1 1 14rem; padding: .7rem .9rem; border-radius: 10px;
  border: 1px solid var(--c-line, rgba(140,156,184,.2)); background: rgba(8,12,20,.6); color: var(--c-ink, #e9e6da); }
.signup-email:focus { outline: none; border-color: var(--c-gold, #c9a44e); }
.signup-go { white-space: nowrap; }
.signup-msg { margin-top: .7rem; font-size: .88rem; color: var(--c-ink-dim, #aab3c5); }
.signup-msg.is-ok { color: var(--c-gold-bright, #e7c87e); }
.signup-gift { margin-top: .4rem; }
/* honeypot:移出視野但不用 display:none(部分 bot 會略過 none 欄位) */
.signup-hp { position: absolute; left: -9999px; width: 1px; height: 1px; opacity: 0; }
```
（`--c-*` token 名請對齊 repo 既有命名;`.lux-btn` 若不存在改用既有主按鈕 class。）

- [ ] **Step 5: 跑全測試 + 本機目視**

Run: `npx vitest run`
Expected: 全綠(既有 + 新增)。
Run: `npm run dev`,玩一局到結算頁,填 email 送出 → 出現「Email 已登記」+ 賽道連結;重填同 email → 「已經在名單上」。

- [ ] **Step 6: Commit**

```bash
git add src/ui/api.js src/ui/settle.js src/ui/about.js src/style.css
git commit -m "feat(ui): wire signup form into settle + about pages"
```

---

### Task A7: 名單後台 public/admin.html

**Files:**
- Create: `public/admin.html`

- [ ] **Step 1: 寫 admin.html**

單檔、`<meta name="robots" content="noindex">`、lux 風(比照 goal-grid admin)。token 存 `localStorage`,fetch `${API}/admin/list` 帶 `Authorization: Bearer`。

```html
<!DOCTYPE html><html lang="zh-Hant"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>名單後台 — K-Rider</title>
<style>
  :root { --bg:#0e1420; --gold:#c9a44e; --gold-bright:#e7c87e; --ink:#e9e6da; --ink-dim:#aab3c5;
    --line:rgba(140,156,184,.18); --panel:rgba(20,28,44,.55);
    --serif:"Noto Serif TC",serif; --sans:"Noto Sans TC","PingFang TC",sans-serif; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:var(--sans); color:var(--ink); background:var(--bg); padding:6vh 6vw; line-height:1.7; }
  h1 { font-family:var(--serif); letter-spacing:.05em; margin-bottom:1rem; }
  .gate { max-width:30rem; background:var(--panel); border:1px solid var(--line); border-radius:14px; padding:1.4rem; }
  input { width:100%; padding:.7rem .9rem; border-radius:10px; border:1px solid var(--line);
    background:rgba(8,12,20,.6); color:var(--ink); }
  button { cursor:pointer; margin-top:.8rem; padding:.6rem 1.4rem; border-radius:999px; border:none;
    background:linear-gradient(135deg,#dcb766,#b8923f); color:#1a1408; font-weight:700; }
  table { width:100%; border-collapse:collapse; margin-top:1.4rem; font-size:.9rem; }
  th,td { text-align:left; padding:.5rem .6rem; border-bottom:1px solid var(--line); }
  th { color:var(--gold); letter-spacing:.08em; font-size:.78rem; }
  .count { color:var(--gold-bright); margin-top:1rem; }
  .msg { color:#e08a8a; margin-top:.6rem; }
</style></head><body>
<h1>K-Rider 名單後台</h1>
<div class="gate">
  <label>ADMIN_TOKEN</label>
  <input id="tok" type="password" placeholder="Bearer token" />
  <button id="load">載入名單</button>
  <p class="msg" id="msg" hidden></p>
</div>
<p class="count" id="count" hidden></p>
<table id="tbl" hidden><thead><tr><th>#</th><th>Email</th><th>來源</th><th>時間</th></tr></thead><tbody></tbody></table>
<script>
  const API = 'https://k-rider-api.yazelinj303.workers.dev';
  const $ = (id) => document.getElementById(id);
  $('tok').value = localStorage.getItem('krider-admin-token') || '';
  $('load').addEventListener('click', async () => {
    const token = $('tok').value.trim();
    localStorage.setItem('krider-admin-token', token);
    $('msg').hidden = true;
    try {
      const res = await fetch(`${API}/admin/list`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { $('msg').textContent = res.status === 401 ? 'token 錯誤' : `錯誤 ${res.status}`; $('msg').hidden = false; return; }
      const { rows, count } = await res.json();
      $('count').textContent = `共 ${count} 筆`; $('count').hidden = false;
      const tb = $('tbl').querySelector('tbody');
      tb.innerHTML = rows.map((r) => `<tr><td>${r.id}</td><td>${r.email}</td><td>${r.source || ''}</td><td>${r.created_at}</td></tr>`).join('');
      $('tbl').hidden = false;
    } catch { $('msg').textContent = '連線失敗'; $('msg').hidden = false; }
  });
</script></body></html>
```

- [ ] **Step 2: 本機驗證**

部署後開 `https://yazelin.github.io/k-rider/admin.html`,貼 token → 看到名單。(本機 `npm run dev` 時路徑為 `/admin.html`。)

- [ ] **Step 3: Commit**

```bash
git add public/admin.html
git commit -m "feat: signups admin page (token-gated list)"
```

---

### Task A8: 更新 README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 補 API/漏斗段落**

在 README 的 API 端點清單加 `POST /signup`、`GET /admin/list`;在架構/資料段註明 D1 `k-rider-signups`;新增「留資漏斗」一段說明結算頁留 email → 即時兌現賽道 + `admin.html` 後台。(依「改 repo 必更新 README」。)

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs(readme): signup funnel, /signup, /admin/list, D1"
```

---

## Deliverable B — 教學版 case study + 雙向連結

### Task B1: docs/case-study/README.md

**Files:**
- Create: `docs/case-study/README.md`

- [ ] **Step 1: 寫教學版 case study**

來源:`docs/superpowers/specs/2026-06-12-k-rider-design.md`。轉成對學員可讀的四區塊:

1. **一頁規格書** —— K-Rider 的甲方規格(受眾=想學投資感但怕真賠錢的人 / 核心玩法價值=把抽象 K 線變成體感 / 區塊=選關→騎乘→結算→分享 / 驗收=混沌猴 25 秒穩定前進)。
2. **prompt 鏈** —— 設計 mock(Codex $imagegen 出 HUD/結算卡)→ 物理調參迭代 → AI 路牌生成 → 漏斗。每段一句「下發包」的關鍵 prompt。
3. **驗收清單** —— 混沌猴 25 秒、輪距不變量測試、手感數值實測、防 prompt injection 投毒(roast 共享快取僅精選股)。
4. **模組對應表**:

   | 課程模組 | K-Rider 對應 |
   |---|---|
   | 模組 2 視覺素材 | Codex `$imagegen` 出 HUD/結算卡 mock → 照稿落 CSS |
   | 模組 3 特效 | 零依賴 canvas(星空/光柱/金塵)+ WebAudio 全合成音效 |
   | 模組 5/7 部署排程 | GitHub Actions 多 cron 抓 Yahoo(冪等)+ Pages |
   | 模組 6 AI Worker | roast 吐槽(共享快取防 prompt injection)+ AI 事件路牌 |
   | 模組 9 名單漏斗 | `/signup` + D1 + `admin.html`(本次新增) |

   頂部一句定位:「這是 <課程名> 各進階模組堆到產品級的樣子。課程教零 build、一頁活動頁;K-Rider 把同一套技能(部署排程、AI Worker、名單漏斗)推到一個有真實股價資料的遊戲。程式碼是耗材,規格與驗收才是帶得走的。」

- [ ] **Step 2: Commit**

```bash
git add docs/case-study/README.md
git commit -m "docs(case-study): K-Rider 教學版 case study(規格/prompt鏈/驗收/模組對應)"
```

---

### Task B2: K-Rider 端回連課程

**Files:**
- Modify: `README.md`
- Modify: `src/ui/about.js`

- [ ] **Step 1: README 加 case study + 課程連結**

在 README 頂部簡介後加一句:「本作是 <課程名> 的『天花板案例』。完整拆解(規格書 / prompt 鏈 / 驗收清單 / 模組對應)見 [docs/case-study](docs/case-study/README.md)。」(課程公開站網址待 user 提供,先連 case study,課程 URL 留 TODO 由 user 補或在 Task B3 一併確認。)

- [ ] **Step 2: about 頁加一行**

在 `src/ui/about.js` 的聲明段加一句指向 case study(相對連結 `docs/case-study` 在 GitHub repo 可點;站上版本連到 repo URL)。

- [ ] **Step 3: Commit**

```bash
git add README.md src/ui/about.js
git commit -m "docs: link K-Rider case study + course from README/about"
```

---

### Task B3: 行銷課 dev repo 課程側連結(另一 repo,發佈 user 拍板)

> **這在另一個 repo:`/home/ct/ai-marketing-pages-course`(dev,私有)。開獨立短 branch,不混進 k-rider 的 PR。改完只本機驗證 + 開 PR;`scripts/publish.sh` 發佈到公開 repo 是對外動作,由 yazelin 拍板觸發 —— agent 不自動發佈。**

**Files (in `/home/ct/ai-marketing-pages-course`):**
- Modify: `course/00c-spec-brief.md`(模組 S「對照成品」段加「真實世界天花板版」指向 K-Rider case study)
- Modify: `course/`模組 4 案例檔(加 K-Rider 延伸案例一段)
- Modify: 模組 6、模組 7 檔各補一句「真實世界版見 K-Rider case study」

- [ ] **Step 1: 切 dev repo + 開 branch**

```bash
cd /home/ct/ai-marketing-pages-course
git checkout main && git pull
git checkout -b feat/link-k-rider-case-study
```

- [ ] **Step 2: 改四處課程檔**

各處加一段/一句,連到 K-Rider case study(`https://github.com/yazelin/k-rider/tree/main/docs/case-study`)與站台。措辭呼應「天花板案例 / 進階模組堆到產品級」。

- [ ] **Step 3: 本機驗證 slide/course 連結正確**

開對應 `slides/*.html` 或 `course/*.md` 預覽,確認連結可點、敘述一致。

- [ ] **Step 4: Commit + 開 PR(不發佈)**

```bash
git add course/
git commit -m "docs(course): link K-Rider 天花板案例 from 模組 S/4/6/7"
git push -u origin feat/link-k-rider-case-study
gh pr create --fill   # 注意 default 指向正確 repo
```

- [ ] **Step 5: 交回 yazelin**

回報 PR 連結;**`scripts/publish.sh` 發佈到公開 repo 由 yazelin 決定何時跑。**

---

## 收尾:PR

- [ ] K-Rider:推 branch、開 PR、設 auto-merge(trunk-based)

```bash
cd /home/ct/k-rider
git push -u origin feat/signup-funnel-and-case-study
gh pr create --fill
gh pr merge --auto --squash
```

---

## Self-Review(規格對照)

- **A 漏斗後端**:A1(D1/binding)+ A2(handler/TDD)+ A3(路由)+ A4(部署) ✓
- **A 前端**:A5(純函式/TDD)+ A6(api+表單+樣式)+ A7(admin) ✓
- **A 收尾**:A8(README)✓ 測試 ✓
- **B case study**:B1(教學版)✓
- **B 雙向連結**:B2(k-rider→課程)+ B3(課程→k-rider,另 repo、發佈 gated)✓
- **範圍界定**:模組 S 不動 —— 規格已聲明,計畫無對應任務(刻意)✓
- **型別一致**:`gift` 物件 `{url,label}` 在 worker(`gift(env)`)、`describeSignupResult`、`initSignup`、admin 一致;`already` 布林一致;`source` ∈ {result,about} 一致 ✓
- **gift 路由風險**:`GIFT_URL` 設為 `#/ride/2330.TW`,對齊 main.js 既有 `#/ride/<symbol>` 路由(已驗證) ✓
