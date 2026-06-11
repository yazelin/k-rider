# K 線騎士 K-Rider — 設計規格

日期：2026-06-12
狀態：待使用者核可
參考：stonkrider.com（玩法參考，視覺與程式碼皆不抄襲；頁尾標注 inspired by）

## 1. 一句話定位

騎機車衝真實股價 K 線的網頁小遊戲：台股紅漲綠跌、美股綠漲紅跌，騎過歷史事件路牌，摔車後被 AI 嘴一句。

## 2. 範圍

### v1 包含

- 12 檔精選股（台股 6 + 美股 6）+ 任意 ticker 搜尋
- 多週期賽道：1D（5分K）/ 5D（15分K）/ 3M / 6M / 1Y（日K）/ 5Y（週K）/ ALL（月K）+ Smooth（移動平均）
- 每日挑戰 + 排行榜（Cloudflare Worker + KV）
- AI 三件套：賽道歷史事件路牌（離線）、每日挑戰文案（離線）、賽後 AI 賽評（執行期，Groq）
- 雙語 zh-TW / en，桌機鍵盤 + 手機觸控
- GitHub Pages 部署、GitHub Actions 資料管線

### v1 不包含（v2 backlog）

- 重度防作弊（重播驗證、伺服器端物理模擬）
- TWSE OpenAPI 備援資料源
- 玩家帳號系統、歷史成績頁
- 自訂車輛/皮膚

## 3. 精選股清單

| 市場 | 代號 | 名稱 |
|---|---|---|
| 台股 | 2330.TW | 台積電 TSMC |
| 台股 | 2317.TW | 鴻海 Hon Hai (Foxconn) |
| 台股 | 2454.TW | 聯發科 MediaTek |
| 台股 | 0050.TW | 元大台灣50 Yuanta Taiwan 50 ETF |
| 台股 | 2603.TW | 長榮 Evergreen Marine |
| 台股 | 3008.TW | 大立光 Largan Precision |
| 美股 | TSLA | Tesla |
| 美股 | NVDA | NVIDIA |
| 美股 | AAPL | Apple |
| 美股 | GME | GameStop |
| 美股 | SPY | S&P 500 ETF |
| 加密 | BTC-USD | Bitcoin |

清單存於 `src/shared/featured-list.js`（單一事實來源，抓資料腳本與前端共用）。

## 4. 遊戲機制

### 4.1 地形生成

- 輸入：`[{t, close}]` 陣列（任何週期通用）。
- 每個資料點一個頂點，水平等距；價格以該賽道 min/max 正規化映射到高度區間。
- 坡度上限 ~50°：若相鄰兩點原始斜率超過，整體垂直縮放壓回（保證可玩）。
- Smooth 模式：N 點移動平均（N 依資料點數自適應）。
- 染色：逐段依漲跌染色。`.TW` 結尾代號紅漲綠跌，其餘綠漲紅跌。
- 純函式 `buildTerrain(points, opts) -> {vertices, segments, meta}`，可單元測試。

### 4.2 機車物理（Matter.js）

- 車身剛體 + 前後輪圓形剛體，輪子以 constraint 連接模擬懸吊；騎士頭部為車身上的感測點。
- 操作：
  - `↑`/`W`：油門（後輪扭矩）
  - `←`/`→`：空中旋轉 / 地面翹孤輪、壓車頭
  - `Space`：跳躍（僅著地時）
  - `Shift`/`N`：氮氣（量表有限，沿途過資料點緩慢回充）
  - `R`：重來、`M`：靜音（v1 無音效，按鍵與狀態先預留，音效屬 v2）
- 手機：左半屏左右傾斜鈕、右半屏油門 + 跳躍 + 氮氣鈕。
- 墜毀判定：騎士頭部或車身底盤以超過閾值角度觸地 → 墜毀 → 結算畫面。
- 終點：抵達最後一個資料點 → 完賽結算。

### 4.3 計分

純函式 `score(events) -> number`，前端與 Worker 共用同一份（`src/shared/scoring.js`）：

- 前進：每通過一個資料點 +100
- 騰空：每秒 +50（連續騰空有 1.1x 疊乘）
- 空翻：每完整 360° +1000（前空翻/後空翻同價）
- 翹孤輪：每秒 +30
- 氮氣中通過資料點：該點分數 x2
- 完賽加成：+5000 + 剩餘氮氣比例 x 2000

### 4.4 鏡頭與 HUD

- 鏡頭跟隨車身，前方視野偏移。
- HUD：累計分數、計時、氮氣條、右上小地圖（全賽道縮圖 + 目前位置）。

## 5. 前端

- Vite + vanilla JS（無框架）+ Matter.js。
- Hash routing：`#/`（首頁）、`#/ride/:symbol?p=1y`（遊戲）、`#/leaderboard`（排行榜）。
- 首頁：每日挑戰卡（股票、文案、榜首、人數）、精選賽道卡（台股區 / 美股區，漲跌% + 難度標籤）、任意 ticker 搜尋框、全站統計、頁尾。
- 難度標籤：依波動度（年化標準差）分 Easy / Medium / Hard / Insane，計算在抓資料腳本內完成。
- i18n：`src/i18n/`（zh-TW.js / en.js 字典 + `t()`），右上角切換，localStorage 記住；預設 zh-TW。股票名稱雙語存於 featured-list。
- 頁尾：Buy me a coffee / Facebook / GitHub 連結（placeholder，上線前補）+「真實市場資料 · 非投資建議」+ inspired by stonkrider.com。
- 視覺：暗色底 neon 風，自有配色與排版；車輛造型自繪（canvas 向量或 SVG）。不複製原站任何素材。

## 6. 資料管線（GitHub Actions）

### 6.1 抓資料腳本 `scripts/fetch-data.mjs`

- Node 20 原生 fetch，零依賴。
- 來源：Yahoo Finance v8 chart API（`query1.finance.yahoo.com/v8/finance/chart/`）。
- 對 12 檔精選股各抓：`5y/1d`（主資料，週K月K由其聚合）、`1d/5m`、`5d/15m`。
- 輸出：
  - `public/data/tickers/<symbol>.json`：`{symbol, updated, daily: [...], intraday5m: [...], intraday15m: [...]}`
  - `public/data/featured.json`：12 檔 meta（雙語名稱、波動度、難度、最新收盤、漲跌%）
- 驗證：資料點數下限、最新日期合理性；驗證不過 → 保留舊檔，該檔標記失敗。
- 冪等：輸出內容與現有檔案相同（忽略 `updated` 欄位）就不寫入；workflow 無 diff 就不 commit。

### 6.2 排程 `.github/workflows/update-data.yml`

cron（UTC，皆為冪等補抓）：

- 台股收盤後：`40 6 * * 1-5`、`10 7 * * 1-5`、`0 8 * * 1-5`
- 美股收盤後（涵蓋冬夏令）：`10 21 * * 1-5`、`40 21 * * 1-5`、`10 22 * * 1-6`、`0 23 * * 1-6`
- 任一次全部成功後，後續執行因無 diff 自動 no-op；GitHub cron 延遲 5-15 分鐘可接受。
- 支援 `workflow_dispatch` 手動觸發。
- commit 後觸發 Pages 部署 workflow。

### 6.3 AI 離線生成（同一條 workflow 內，接在抓價之後）

- **事件路牌**：掃描 12 檔日線，單日漲跌 |≥5%|（ETF/SPY 用 |≥3%|）的日期，對「尚無路牌」的日期呼叫 LLM（Groq API，secret 存 GitHub Secrets）生成一句雙語事件摘要，存 `public/data/events/<symbol>.json`。已生成過的日期不重打（增量）。
- **每日挑戰文案**：依當日挑戰股票與區間生成一句雙語開場白，存 `public/data/daily-copy.json`。
- LLM 失敗不擋 workflow：路牌缺就不顯示、文案缺用罐頭句。

## 7. Cloudflare Worker（`worker/`，wrangler 部署）

KV namespace：`KRIDER`。CORS 鎖定 Pages 網域 + localhost dev。

### 7.1 `GET /daily`

- 以 `Asia/Taipei` 日期字串為當日鍵。
- 選股：`hash(dateStr) % 12` 選股票、`hash(dateStr) % 3` 選區間（3M/6M/1Y，固定日K）。演算法與前端 `src/shared/daily-pick.js` 同一份，離線也能算出今日賽道。
- 回傳：`{symbol, period, date, copy, leaderboard: top10, totalPlayers}`。

### 7.2 `POST /score`

- Body：`{nickname, score, playerId, stats: {crashes, airtimeMs, flips, finished}, sessionId?}`。
- 驗證：暱稱清洗（去 HTML、≤16 字）、`score` 通過 `scoring.js` 合理上限重算檢查（以該賽道資料點數推得理論最大值）、每 IP 每日提交次數上限（KV 計數）。
- 同 playerId 當日只留最高分；KV 以日期為鍵存當日榜（JSON blob，保留 top 100）。
- 防作弊定位：基本盤（上限 + 限流 + 清洗），不做重播驗證；`sessionId` 欄位先留。

### 7.3 `GET /quote?symbol=&range=&interval=`

- 任意 ticker 報價 proxy → Yahoo v8。
- symbol 白名單 regex：`^[A-Z0-9.\-=^]{1,12}$`（涵蓋 .TW/.TWO/BTC-USD/^TWII）。
- `caches.default` 快取：日K 1 小時、盤中 5 分鐘。

### 7.4 `POST /roast`（賽後 AI 賽評）

- Body：`{symbol, period, score, crashedAtIndex?, stats, lang}`。
- Worker 呼叫 Groq（API key 存 wrangler secret），prompt 結合表現數據 + 該賽段真實行情（漲跌%），生成一句嘴砲賽評。
- 快取：`hash(symbol, period, 結果分桶)` 為鍵存 KV（TTL 7 天）——同股票同表現級距共用，省 API 額度。
- 限流：每 IP 每日 20 次；超限或 LLM 失敗 → 回前端內建罐頭嘴砲句庫（雙語各 ~20 句，依表現分桶選）。

### 7.5 `GET /stats` + `POST /event`

- 全站統計：完賽數、墜毀數、虛擬交易額（完賽時以股價區間估算）。KV 計數器，`POST /event` 帶基本限流。

## 8. Repo 結構

```
k-rider/
├── index.html
├── src/
│   ├── game/        # 物理、地形、鏡頭、HUD、輸入
│   ├── ui/          # 首頁、結算、排行榜、路由
│   ├── i18n/        # zh-TW.js, en.js
│   └── shared/      # featured-list, scoring, daily-pick, terrain（前端/Worker/腳本共用）
├── public/data/     # Actions 產出的靜態資料
├── scripts/fetch-data.mjs
├── worker/          # src/index.js, wrangler.toml
├── .github/workflows/  # update-data.yml, deploy.yml
├── docs/superpowers/specs/
├── LICENSE          # MIT, 林亞澤
└── README.md
```

部署：GitHub Pages（Actions 構建 Vite），網址 `yazelin.github.io/k-rider`。

## 9. 測試

- vitest 單元測試：`buildTerrain`（含坡度上限、染色規則）、`scoring`（含上限重算）、`daily-pick`（hash 穩定性、與 Worker 同結果）、fetch-data 驗證邏輯（fixture JSON）。
- Worker：vitest + miniflare 跑路由邏輯（score 驗證、限流、quote 白名單）。
- 遊戲手感：實玩調參；headless 煙霧測試（頁面載入、canvas 非透明像素數 > 閾值）。

## 10. 風險與對策

| 風險 | 對策 |
|---|---|
| Yahoo 非官方 API 擋 GitHub Actions IP | 多 cron 重試 + 驗證失敗保留舊資料，站不會壞；長期被擋 → v2 接 TWSE OpenAPI |
| GitHub cron 延遲 | 對日更資料無實質影響 |
| Groq 額度耗盡 / 掛掉 | 賽評退罐頭句庫；路牌/文案增量生成，缺就不顯示 |
| 排行榜灌分 | 基本盤防護；個人小遊戲，接受殘餘風險，sessionId 留擴充位 |
| Matter.js 手機效能 | 地形 body 用 chain 簡化、資料點多時抽稀渲染 |

## 11. 名稱與授權

- 名稱：K 線騎士 / K-Rider，repo `k-rider`。
- 授權：MIT（林亞澤）。遊戲玩法概念參考 stonkrider.com，無程式碼或素材複製。
