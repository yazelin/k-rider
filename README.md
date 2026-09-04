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
       ├─ POST /register     通用活動報名（寫 D1 registrations 表，honeypot + KV 限流 + 同梯 email 去重）
       ├─ GET  /vote         主題投票現況（自己的選擇 + 各主題票數 + 投票人數）
       ├─ POST /vote         投票／用 AI 的程度／對過去場次按愛心（一人一列，三者分開寫互不覆蓋）
       ├─ POST /note         投票頁的文字回饋（想聽的不在上面／想來講一場／某一場的心得）
       ├─ GET  /admin/notes  讀上面那些（Bearer ADMIN_TOKEN，可 ?kind= 篩）
       ├─ GET  /admin/list   訂閱名單後台（Bearer ADMIN_TOKEN）
       ├─ GET  /admin/registrations  報名名單後台（Bearer ADMIN_TOKEN，可 ?batch= 篩梯次）
       └─ /stats /event      全站統計
```

排行榜、限流計數存 KV `KRIDER`；email 留資名單存 D1 `k-rider-signups`（`signups` 表，`email` 欄 UNIQUE 去重）。

共用純邏輯（計分、每日選股、K 線聚合、地形生成）放 `src/shared/`，前端、Node 腳本、Worker 三方 import 同一份。

## 留資漏斗 Signup funnel

遊戲免費玩，價值先給；結算頁與聲明頁（`#/about`）底部各有一個零依賴留資表單，留 email 立即領取《K-Rider 拆解手冊》（= case study），email 進名單供課程後續通知。不寄垃圾信、不寄每日信——當場兌現是唯一承諾，符合課程模組 9「免費價值先給、留資換加值、即時兌現、不依賴寄信」的教法：

- 送出 → `POST /signup`（KV 近似限流擋機器人、honeypot 只標記不擋、D1 `UNIQUE(email)` 去重），成功當場回拆解手冊連結（`GIFT_URL`，指向 `docs/case-study`）即時兌現；重複留資也照樣再給一次連結。
- 留資成功後同時顯示「加入社群」按鈕（`src/ui/signup.js` 的 `COMMUNITY_URL`，指 LINE「AI。許願池」）——把訂閱者導進社群當**單一公告渠道**，課程上線的通知走社群發，不依賴 email 寄信（D1 名單本身無 mailer）。
- 名單看後台：<https://yazelin.github.io/k-rider/admin.html>，貼 `ADMIN_TOKEN`（存瀏覽器 localStorage），頁面有「訂閱／報名／回饋」三個分頁——訂閱打 `GET /admin/list`、報名打 `GET /admin/registrations`（可下拉篩梯次）、回饋打 `GET /admin/notes`（可下拉篩種類：想聽這個／想來講／心得），各自匯出 CSV。後台頁 `noindex`，不進搜尋引擎。
- 分頁與下拉篩選都是從 `VIEWS` 長出來的，**要加第四個分頁只要在 `VIEWS` 加一筆**（`tab` 名稱、`path`、`cols`、`head`，要篩就加 `filter: { key, label }`），不用動其他地方。資料庫存代號的欄位（`kind`、`pace`）在 `LABEL` 裡對中文。
- 只想在終端機看名單／活動回饋，不開後台：`node scripts/registrations.mjs` 列出所有 batch（含筆數與最後一筆時間），`node scripts/registrations.mjs <batch>` 印出該梯次每一筆的姓名、email、時間（台北時間）與內容，加 `--all` 連 honeypot 標記的一起看。走 wrangler 直查 D1，不需要 `ADMIN_TOKEN`。活動回饋也存在同一張 `registrations`，batch 用 `<活動>-feedback`。週三直播的投票結果用 `node scripts/registrations.mjs --vote`：票數排行、程度分佈、已講場次的愛心，以及**程度 × 想聽什麼**的交叉表（會 agent 的人 vs 只到生圖聊天的人分兩欄），那張表才是收程度這件事的目的——深度使用者跟入門者想聽的不一樣，講深講淺才有依據。主題與場次的中文名從 `~/yazelin.github.io/vote/topics.js` 讀，讀不到就印 slug，不會因此跑不動。文字回饋在 `vote_notes`，`node scripts/registrations.mjs --notes` 印出全部（`--notes wish` / `offer` / `feedback` 只看一種）。訂閱名單在另一張 `signups`，`node scripts/registrations.mjs --signups` 印出全部（`source` 標留資點：`blog`＝部落格頁尾、`post`＝文章底、`home`＝本站首頁、`result`＝結算頁、`about`＝關於頁）。
- **honeypot 只標記不擋**（`flagged` 欄位）：命中一樣寫進 D1，由查詢端過濾。因為兩種誤判的代價不對稱——擋錯是真人以為送出成功、名單裡卻沒有他，而且他看不到那個隱形欄位、沒有自救路徑；收錯只是名單多幾筆要刪。真正在擋機器人的是每 IP 每日限流。
- 換 `ADMIN_TOKEN`（外洩或忘了就重產）：`bash scripts/rotate-admin-token.sh`——產新值、用管線餵進 Worker Secret（不經互動貼上、避免夾帶換行）、印出一次讓你存進密碼管理器、再驗證 `/admin/list` 回 200。Worker Secret 是 write-only，產生當下沒存就只能再 rotate。

物理：Matter.js，整台車是**單一剛體 compound**（車架/騎士/兩輪都是 parts——輪胎與車身相對位置在幾何上不可能變形），驅動為沿坡面純力模型＋角速度導引姿態控制，接地用法向距離幾何判定。手感參數（重力、跳力、坡度目標）皆以 headless 模擬實測定案，見 `docs/design/` 的設計稿與 git log。

## 本地開發 Development

```bash
npm install
npm run dev          # http://localhost:5173/k-rider/
npm test             # vitest（共用邏輯、物理不變量、Worker handlers、signup）
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

## 站台開啟計數 Site hits

promo footer 會對 `GET/POST /hit?s=<repo>` 送一發 `sendBeacon`，Worker 只往 D1 的
`site_hits` 記「哪一天、哪個站、幾次」——不存 IP、不設 cookie、不記 referrer，
所以它答得出次數、答不出人數。

公開儀表板：<https://k-rider-api.yazelinj303.workers.dev/hits>
（每日折線 + 各站排行，開頁即時查 D1，每 5 分鐘自動重新整理）

## 週三直播主題投票 Topic vote

`yazelin.github.io/vote/` 那頁的後端。取代原本的 Google 表單，因為表單做不到兩件事：
讓人隨時回來改答案（編輯連結只出現在提交後的確認畫面，關掉就找不回來，除非收 email），
以及把講過的主題下架而不弄亂舊回覆的統計。

資料模型是**一人一列**（D1 `topic_votes`，主鍵 `voter`），所以改答案是覆寫、不會多一筆票。
身分是前端 `crypto.randomUUID()` 產的匿名碼存 `localStorage`，不收 email、不設 cookie、不記 IP。
清掉瀏覽器資料就換一個身分，等於可以重複投——跟原本的表單一樣沒有防線，不值得為它收個資。

主題清單本身在前端的 `vote/topics.js`，講過的由人手動從 `open` 搬到 `done` 並補上錄影連結。
票是按 slug 算的，搬走就自然退出排行，所以 slug 一旦公開就不要改。

限選 3 項是伺服器端強制的（`MAX_PICKS`）。沒有限制的時候，前一份表單 35 筆回覆裡有 7 筆
把 12 個選項全部勾滿，佔兩成，那種票對排序沒有貢獻。

同一列還存兩件事，所以「程度 × 想聽什麼」「按過哪幾場愛心的人接下來想聽什麼」都是一句 SQL：
`uses`（用 AI 到什麼程度，複選 `chat`／`media`／`agent`／`build`——刻意做成工具清單而不是自評分級，
人對自己的程度判斷很不準，但「你用過 Suno 嗎」一秒答得出來）與 `likes`（對已講過場次按的愛心，
一人一場一顆）。三者用各自的 upsert 寫入，只送其中一個不會把另外兩個洗掉。

同一頁還收三種文字回饋（D1 `vote_notes`），共用同一個匿名 voter id，所以同一個人的票與心得
對得起來，而且不必收 email：

| kind | 是什麼 | 行為 |
| --- | --- | --- |
| `wish` | 想聽的不在上面 | 可以寫很多則 |
| `offer` | 想來講一場 | 附選填的稱呼與聯絡方式 |
| `feedback` | 某一場講完的心得 | 節奏（fast/ok/slow）加一段自由文字；一人一場一份，重送覆蓋 |

**這些內容一律不公開。** 提案沒有審核機制，公開等於開一個沒人顧的留言板；心得公開的話沒有人會
說實話。讀取走 `GET /admin/notes`，跟訂閱名單同一套 Bearer。

心得卡只在 `vote/topics.js` 裡某一場掛了 `feedback: true` 的時候出現，送過就用 `localStorage`
記住不再問。下一場開始前把那個旗標拿掉。

## 授權 License

MIT © 2026 林亞澤 (Yaze Lin)

玩法靈感來自 [stonkrider.com](https://stonkrider.com)（無程式碼或素材複製）。市場資料來自 Yahoo Finance，僅供娛樂，非投資建議。
