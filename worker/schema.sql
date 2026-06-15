-- K-Rider email 留資名單(D1)
CREATE TABLE IF NOT EXISTS signups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  source TEXT,            -- 'result' | 'about':辨識留資位置
  ip TEXT
);
