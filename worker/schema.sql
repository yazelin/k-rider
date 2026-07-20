-- K-Rider email 留資名單(D1)
CREATE TABLE IF NOT EXISTS signups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  source TEXT,            -- 'result' | 'about':辨識留資位置
  ip TEXT
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
  UNIQUE (email, batch)  -- 同人可報不同梯次;同一梯次不重複
);
