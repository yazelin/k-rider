# K 線騎手 K-Rider

騎機車衝真實股價 K 線的網頁小遊戲。台股紅漲綠跌、美股綠漲紅跌，騎過歷史大波動日的事件路牌，摔車後被 AI 嘴一句。

Ride a motocross bike across real stock charts. Taiwan tracks use red-up/green-down, US tracks the opposite. Pass AI-generated event signposts on big-move days, and get roasted by AI when you crash.

**Play: https://yazelin.github.io/k-rider/**

## 玩法 How to play

| 鍵 Key | 動作 Action |
|---|---|
| `↑` / `W` | 油門 gas |
| `←` / `→` | 空中旋轉、地面翹孤輪/壓車頭 lean / wheelie / nose-dive |
| `Space` | 跳躍 jump |
| `Shift` / `N` | 氮氣 nitro（量表有限，沿途回充） |
| `R` | 重來 reset |

手機以畫面下方觸控按鈕操作。計分：前進過點、騰空、空翻、翹孤輪、氮氣加成、完賽加成。每日挑戰（台北時間換日）可提交分數上排行榜。

賽道區間：1D（5 分 K）/ 5D（15 分 K）/ 3M / 6M / 1Y（日 K）/ 5Y（週 K）/ ALL（月 K），可開「平滑」模式。除了 12 檔精選股，搜尋框可輸入任何 Yahoo Finance 代號（如 `MSFT`、`2317.TW`、`BTC-USD`）。

## 架構 Architecture

```
GitHub Pages（純前端 SPA：Vite + vanilla JS + Matter.js）
  ├─ public/data/   ← GitHub Actions 每日多 cron 抓 Yahoo Finance 寫入（冪等，沒變不 commit）
  │    ├─ tickers/<symbol>.json   12 檔精選股：5 年日 K + 盤中 5m/15m
  │    ├─ featured.json           名稱、波動度、難度、漲跌%
  │    ├─ events/<symbol>.json    AI 生成的大波動日路牌（增量）
  │    └─ daily-copy.json         AI 生成的每日挑戰文案
  └─ Cloudflare Worker + KV（k-rider-api）
       ├─ GET  /daily   今日挑戰（日期 hash 選股，前後端同一份演算法）+ 排行榜
       ├─ POST /score   收分（理論上限重算、暱稱清洗、限流、同人留最高、top100）
       ├─ GET  /quote   任意 ticker proxy（白名單 + edge cache）
       ├─ POST /roast   AI 賽後賽評（Groq + KV 快取 + 限流，掛掉退罐頭句庫）
       └─ /stats /event 全站統計
```

共用純邏輯（計分、每日選股、K 線聚合、地形生成）放 `src/shared/`，前端、Node 腳本、Worker 三方 import 同一份。

## 本地開發 Development

```bash
npm install
npm run dev          # http://localhost:5173/k-rider/
npm test             # vitest（57 tests）
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
