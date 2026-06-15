# K-Rider 漏斗 + 教學版 case study — 設計規格

> 日期:2026-06-15　狀態:已通過 brainstorming、待 user 過目後進 implementation plan
> 緣由:K-Rider 被定位為[[甲方思維 + AI 發包法]]課程體系的「天花板案例」,但缺了兩堂課都在教的漏斗末端(email + 名單 + 後台),且既有內部 spec 沒被轉成教學版 case study、課程與案例之間沒有導流。本規格補齊這兩件。

## 範圍界定(先講不做什麼)

- **行銷頁母課模組 S 不動。** 驗證後 `00c-spec-brief.md` 結尾已有完整填好的「核心 Prompt 規格書」範本,並指向 `demos/01-landing/NOTES.md` 當對照成品實例 —— 這塊已閉環,不無中生有。
- **不寄信。** email hook 是「收名單 + 即時兌現」,不做 cron / SMTP / 每日寄信。誠實漏斗,比照行銷課 demo09 與 goal-grid signup。
- **不另做兌現頁。** gift 兌現物 = 既有 `featured.json` 的精選挑戰賽道連結。

## Deliverable A — K-Rider 漏斗(email hook + 名單 + 後台)

### A1. 後端:擴充現有 `k-rider-api` Worker

沿用現有 routing 風格(`worker/src/index.js` 的 `if (url.pathname === ... && method)` 分派 + 各 handler 獨立檔 + `util.js` 的 `corsHeaders`/`json`)。

新增兩個端點,新增 `worker/src/signup.js`:

- `POST /signup`
  - body:`{ email, company }`(`company` = honeypot)
  - honeypot:`company` 有值 → 回 `{ ok: true, already: false, gift }` 但**不寫入 D1**(假成功)
  - email 驗證:基本格式(有 `@`、長度上限),失敗回 400
  - 限流:沿用既有 KV(`KRIDER`)做 per-IP 計數(例:10 次/分),超過回 429
  - 寫入:`INSERT ... ON CONFLICT(email) DO NOTHING`;受影響列數 0 → `already: true`
  - 回應:`{ ok: true, already, gift: { url, label } }`,`gift.url` = 站上精選挑戰賽道(取 featured.json 第一檔,如 `https://yazelin.github.io/k-rider/#/play?symbol=2330.TW&period=...` 或站上挑戰列表 anchor;實際路由格式在 plan 階段對齊 `src/` 的 hash 路由)
- `GET /admin/list`
  - 憑 `Authorization: Bearer <ADMIN_TOKEN>`(Worker Secret),不符回 401
  - 回 `{ count, rows: [{ id, email, created_at, source }] }`,預設 limit 500、`ORDER BY created_at DESC`

### A2. 資料層:新建 D1 `k-rider-signups`

`worker/schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS signups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  source TEXT,           -- 'result' | 'about' 等,辨識留資位置
  ip TEXT
);
```

`worker/wrangler.toml` 加 binding(沿用現有檔,保留 KV):

```toml
[[d1_databases]]
binding = "SIGNUPS"
database_name = "k-rider-signups"
database_id = "<建立後填>"
```

### A3. 前端:留資表單 + 即時兌現

- 位置:**結算頁**主留資點(虛擬損益達標已有 BMC CTA,留資表單放在結算頁底,動詞型文案「訂閱每日挑戰提醒」);`#/about` 放次要入口。
- 互動:借 goal-grid `signup.js` 純函式 + DOM 接線拆分法 —— `describeSignupResult(body)` 純函式決定顯示文字,`initSignup(els, hooks)` 接 DOM。零依賴。
- honeypot:藏一個 `name=company` 欄位(CSS 移出視野)。
- 即時兌現:成功(或 already)當場顯示 gift 連結「先解鎖這條精選挑戰賽道」。**承諾即時兌現,不依賴寄信。**
- 樣式:lux 金風(`.lux` 系列 class、`var(--c-*)`),不寫死 rgba。

### A4. 後台:`public/admin.html`

- lux 風單頁,比照行銷課 demo09 admin:輸入 `ADMIN_TOKEN` → fetch `/admin/list` → 表格列出名單 + 總數。
- token 存 `localStorage`(僅本機方便),不寫進 repo。

### A5. 部署(直接執行,wrangler 已登入 yaze.lin.j303,具 d1/workers write)

1. `wrangler d1 create k-rider-signups` → 取 `database_id` 填回 wrangler.toml
2. `wrangler d1 execute k-rider-signups --remote --file worker/schema.sql`
3. `wrangler secret put ADMIN_TOKEN`(值記到 dev 筆記 / 不進 repo)
4. `wrangler deploy`(在 `worker/`)
5. 煙霧測試:`/signup` 正常 + 去重 + honeypot;`/admin/list` 帶/不帶 token

### A6. 測試與收尾

- 純邏輯單元測試(比照既有 `tests/`):`describeSignupResult`、email 驗證、honeypot 判定、`already` 判定。
- 更新 `README.md`:新增 `/signup`、`/admin/list`、D1、admin.html、漏斗說明(依「改 repo 必更新 README」)。

## Deliverable B — 教學版 case study + 雙向連結

### B1. K-Rider repo 新增 `docs/case-study/README.md`

把內部 spec(`docs/superpowers/specs/2026-06-12-k-rider-design.md`)轉成**對學員可讀**的教學版,四個區塊:

1. **一頁規格書** — K-Rider 的甲方規格(受眾、核心玩法價值、區塊、驗收),呼應模組 S 格式
2. **prompt 鏈** — 從規格到實作的關鍵 prompt 序列(設計 mock → 物理調參 → AI 路牌 → 漏斗),體現「下發包」
3. **驗收清單** — 混沌猴 25 秒測試、輪距不變量、手感數值實測等,體現「做驗收」
4. **模組對應表**:

   | 課程模組 | K-Rider 對應 |
   |---|---|
   | 模組 2 視覺素材 | Codex $imagegen 出 HUD/結算卡 mock → 照稿落 CSS |
   | 模組 3 特效 | 零依賴 canvas(星空/光柱/金塵)+ WebAudio 全合成 |
   | 模組 5/7 部署排程 | GitHub Actions 多 cron 抓 Yahoo(冪等)+ Pages |
   | 模組 6 AI Worker | roast(共享快取防 prompt injection)+ AI 事件路牌 |
   | 模組 9 名單漏斗 | 本次新增的 /signup + D1 + admin |

### B2. 雙向連結

- **K-Rider README + `#/about`**:加一句「這是 <課程名> 的天花板案例,完整拆解見 case study」連到課程站。
- **行銷課 dev repo**(`/home/ct/ai-marketing-pages-course`,改 `course/`):在模組 S「對照成品」段、模組 4(案例)加「真實世界天花板版」指向 K-Rider case study;模組 6/7 各補一句「真實世界版見 K-Rider case study」。
  - **發佈為對外動作:我只改 dev repo + 本機驗證,`publish.sh` 由 yazelin 拍板觸發,我不自動發佈。**

## 工作流

- K-Rider:branch `feat/signup-funnel-and-case-study`(A + B1 + B2 的 k-rider 側,相關不 stack)→ PR auto-merge
- 行銷課 dev repo:另一 branch 做 B2 的課程側連結 → PR(發佈另議)
- 依 trunk-based:短 branch off 最新 main、PR 設 auto-merge、main 常綠

## 風險與決定記錄

- gift 連結的實際 hash 路由格式待 plan 階段對齊 `src/` 路由(目前 routing 由 hash 控);若站上沒有可深連的單賽道 URL,退化為連到首頁挑戰列表 anchor。
- `ADMIN_TOKEN` 與 GROQ key 同樣只進 Worker Secret + dev 筆記,不進 repo、不進記憶。
- D1 與既有 KV 並存:限流續用 KV,名單用 D1(goal-grid 的 KV 非原子教訓只影響配額類操作,單純 INSERT 去重用 D1 UNIQUE 即可)。
