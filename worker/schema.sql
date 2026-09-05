-- K-Rider email 留資名單(D1)
CREATE TABLE IF NOT EXISTS signups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  source TEXT,            -- 'result' | 'about':辨識留資位置
  ip TEXT,
  flagged INTEGER NOT NULL DEFAULT 0  -- honeypot 命中:照收不擋,查詢時預設濾掉
);

-- 通用免費活動報名名單(D1);與 signups 完全分離,不共用 UNIQUE
-- 一張表服務未來任何免費活動,用 batch(梯次 slug)區分場次
CREATE TABLE IF NOT EXISTS registrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  note TEXT,             -- 自由文字(想學什麼),可空
  batch TEXT NOT NULL,   -- 活動梯次 slug,如 sticker-2026-08-05
  created_at TEXT NOT NULL,
  ip TEXT,
  flagged INTEGER NOT NULL DEFAULT 0,  -- honeypot 命中:照收不擋,查詢時預設濾掉
  UNIQUE (email, batch)  -- 同人可報不同梯次;同一梯次不重複
);

-- 8/5 貼圖實作營已額滿。資料庫層封鎖可防舊版 Worker 或直接 API 呼叫繼續寫入；
-- 回饋表使用 sticker-2026-08-05-feedback，不受這個 trigger 影響。
CREATE TRIGGER IF NOT EXISTS registrations_close_sticker_2026_08_05
BEFORE INSERT ON registrations
WHEN NEW.batch = 'sticker-2026-08-05'
BEGIN
  SELECT RAISE(ABORT, 'registration_closed');
END;

-- 週三直播主題投票。一人一列:改答案是覆寫,不會產生第二筆票。
-- voter 是前端產的匿名 id(localStorage),不收 email、不存 IP。
-- topics 存 JSON 陣列的主題代號;主題清單本身在前端頁面裡,講過的由人搬到「已講」區。
CREATE TABLE IF NOT EXISTS topic_votes (
  voter TEXT PRIMARY KEY,
  topics TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 投票頁的文字回饋。跟 topic_votes 共用同一個匿名 voter id。
-- kind: 'wish'(想聽的不在上面) | 'offer'(想來講一場) | 'feedback'(某一場的心得)
-- feedback 一人一場一份,重送覆蓋;內容一律不公開,讀取走 /admin/notes。
CREATE TABLE IF NOT EXISTS vote_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  voter TEXT NOT NULL,
  kind TEXT NOT NULL,
  ref TEXT,
  pace TEXT,
  text TEXT NOT NULL DEFAULT '',
  contact TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS vote_notes_kind ON vote_notes (kind, id DESC);

-- 現場共同創作的即時投票。一場(event)同時只有一題 state='open'。
-- 關票時把當下最高票凍結進 winner,故事才走得下去。
-- 提議借用 vote_notes:kind='idea'、ref=round id(<event>-r<seq>)。
CREATE TABLE IF NOT EXISTS live_rounds (
  id TEXT PRIMARY KEY,
  event TEXT NOT NULL,
  seq INTEGER NOT NULL,
  question TEXT NOT NULL,
  options TEXT NOT NULL,
  state TEXT NOT NULL,
  winner INTEGER,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS live_rounds_event ON live_rounds (event, seq DESC);
CREATE TABLE IF NOT EXISTS live_votes (
  round_id TEXT NOT NULL,
  voter TEXT NOT NULL,
  choice INTEGER NOT NULL,
  PRIMARY KEY (round_id, voter)
);
