# K 線騎手 K-Rider

騎機車衝真實股價 K 線的網頁小遊戲。台股紅漲綠跌、美股綠漲紅跌，騎過歷史大波動日的事件路牌，摔車後被 AI 嘴一句。

Ride a motocross bike across real stock charts. Taiwan tracks use red-up/green-down, US tracks the opposite. Pass AI-generated event signposts on big-move days, and get roasted by AI when you crash.

**Play: https://yazelin.github.io/k-rider/**

本作是 [AI 互動行銷頁實作課](https://yazelin.github.io/ai-marketing-pages-course/) 的「天花板案例」——把課程各進階模組（視覺素材、特效、部署排程、AI Worker、名單漏斗）堆到產品級。完整拆解（規格書 / prompt 鏈 / 驗收清單 / 模組對應）見 [docs/case-study](docs/case-study/README.md)。

## 玩法 How to play

| 鍵 Key | 動作 Action |
|---|---|
| `↑` / `W` | 油門 gas |
| `←` / `→` | 空中旋轉、地面翹孤輪/壓車頭 lean / wheelie / nose-dive |
| `Space` | 跳躍 jump |
| `Shift` / `N` | 氮氣 nitro（量表有限，沿途回充；50° 大波動陡坡靠它攻克） |
| `R` | 重來 reset |
| `M` | 靜音 mute（音效為 WebAudio 即時合成） |

手機以畫面下方觸控按鈕操作。**翻車不會結束**：記一次翻車、退回兩根 K 棒重生繼續騎，騎到終點才結算（翻車每次 -500 分）。

計分：前進過點、騰空、空翻、翹孤輪、氮氣加成、完賽加成，再加**特技字典**——連續特技疊 COMBO 倍率（最高 ×5，翻車歸 1）：

| 特技 | 條件 |
|---|---|
| 跳空缺口 Gap Up | 騰空 2 秒以上 |
| 躺平 Diamond Hands | 長滯空幾乎不旋轉 |
| 軋空行情 Short Squeeze | 連續孤輪 2.5 秒 |
| 急殺止跌 Hard Stop | 前輪平衡 1.5 秒 |
| 登月 To the Moon | 騰空實際爬升 480px 以上且飛越全賽道最高峰 |

**排行榜**：騎「今日挑戰」賽道（台北時間換日輪替，同檔同區間、未開平滑）即可提交分數，不限入口；結算卡可產生戰績梗圖（虛擬本金 10 萬的損益卡）分享到 LINE / Threads / X / FB / Reddit。

賽道區間：1D（5 分 K）/ 5D（15 分 K）/ 3M / 6M / 1Y（日 K）/ 5Y（週 K）/ ALL（月 K），可開「平滑」模式（不計入排行榜）。每關開始前有選關預覽（實際地形、所見即所騎）。除了 12 檔精選股，搜尋框可輸入任何 Yahoo Finance 代號（如 `MSFT`、`2317.TW`、`BTC-USD`）。英文介面入口：https://yazelin.github.io/k-rider/en.html ，聲明頁：`#/about`。

## 架構 Architecture

```
GitHub Pages（純前端 SPA：Vite + vanilla JS + Matter.js）
  ├─ public/data/   ← GitHub Actions 每日多 cron 抓 Yahoo Finance 寫入（冪等，沒變不 commit）
  │    ├─ tickers/<symbol>.json   12 檔精選股：5 年日 K + 盤中 5m/15m
  │    ├─ featured.json           名稱、波動度、難度、漲跌%
  │    ├─ events/<symbol>.json    AI 生成的大波動日路牌（增量）
  │    └─ daily-copy.json         AI 生成的每日挑戰文案
  └─ Cloudflare Worker + KV + D1（k-rider-api）
       ├─ GET  /daily        今日挑戰（日期 hash 選股，前後端同一份演算法）+ 排行榜
       ├─ POST /score        收分（理論上限重算、暱稱清洗、限流、同人留最高、top100）
       ├─ GET  /quote        任意 ticker proxy（白名單 + edge cache）
       ├─ POST /roast        AI 賽後賽評（Groq + KV 快取 + 限流，掛掉退罐頭句庫）
       ├─ POST /signup       email 留資（honeypot + KV 限流 + D1 UNIQUE 去重，回拆解手冊連結）
       ├─ GET  /admin/list   名單後台（Bearer ADMIN_TOKEN）
       └─ /stats /event      全站統計
```

排行榜、限流計數存 KV `KRIDER`；email 留資名單存 D1 `k-rider-signups`（`signups` 表，`email` 欄 UNIQUE 去重）。

共用純邏輯（計分、每日選股、K 線聚合、地形生成）放 `src/shared/`，前端、Node 腳本、Worker 三方 import 同一份。

## 留資漏斗 Signup funnel

遊戲免費玩，價值先給；結算頁與聲明頁（`#/about`）底部各有一個零依賴留資表單，留 email 立即領取《K-Rider 拆解手冊》（= case study），email 進名單供課程後續通知。不寄垃圾信、不寄每日信——當場兌現是唯一承諾，符合課程模組 9「免費價值先給、留資換加值、即時兌現、不依賴寄信」的教法：

- 送出 → `POST /signup`（honeypot 擋機器人、KV 近似限流、D1 `UNIQUE(email)` 去重），成功當場回拆解手冊連結（`GIFT_URL`，指向 `docs/case-study`）即時兌現；重複留資也照樣再給一次連結。
- 名單看後台：開 `admin.html`，貼 `ADMIN_TOKEN`（存瀏覽器 localStorage），憑 Bearer token 打 `GET /admin/list` 拉名單。後台頁 `noindex`，不進搜尋引擎。

物理：Matter.js，整台車是**單一剛體 compound**（車架/騎士/兩輪都是 parts——輪胎與車身相對位置在幾何上不可能變形），驅動為沿坡面純力模型＋角速度導引姿態控制，接地用法向距離幾何判定。手感參數（重力、跳力、坡度目標）皆以 headless 模擬實測定案，見 `docs/design/` 的設計稿與 git log。

## 本地開發 Development

```bash
npm install
npm run dev          # http://localhost:5173/k-rider/
npm test             # vitest（78 tests：共用邏輯、物理不變量、Worker handlers、signup）
npm run fetch-data   # 手動抓一次市場資料

cd worker
npx wrangler dev     # 本地跑 Worker
```

## 部署 Deployment

- **前端**：push `main` → GitHub Actions 跑測試、build、部署 Pages（`.github/workflows/deploy.yml`）
- **資料**：`.github/workflows/update-data.yml` 在台股/美股收盤後多個 cron 時段執行，冪等補抓；有更新才 commit，並以 `gh workflow run` 觸發重新部署
- **Worker**：
  ```bash
  cd worker
  npx wrangler kv namespace create KRIDER   # 把 id 填入 wrangler.toml
  npx wrangler secret put GROQ_API_KEY      # AI 賽評用（可不設，前端退罐頭句）
  npx wrangler deploy
  ```
  部署後把 Worker 網址填入 `src/config.js` 的 `WORKER_URL`
- **AI 生成**：GitHub repo secret 設 `GROQ_API_KEY` 後，資料 workflow 會順帶生成事件路牌與每日文案；不設則跳過，遊戲功能不受影響

## 授權 License

MIT © 2026 林亞澤 (Yaze Lin)

玩法靈感來自 [stonkrider.com](https://stonkrider.com)（無程式碼或素材複製）。市場資料來自 Yahoo Finance，僅供娛樂，非投資建議。
