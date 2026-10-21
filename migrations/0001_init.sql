-- Bitcoin Gazete veritabanı şeması

CREATE TABLE sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  feed_url TEXT NOT NULL UNIQUE,
  site_url TEXT,
  lang TEXT NOT NULL DEFAULT 'en',
  weight REAL NOT NULL DEFAULT 1.0,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_fetched_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Kaynaklardan gelen ham haber sinyalleri (içerik kopyalanmaz, sadece başlık/özet/link)
CREATE TABLE feed_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  url TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT,
  published_at TEXT NOT NULL,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
  -- new: işlenmedi, used: bir habere kaynak oldu, skipped: elendi
  status TEXT NOT NULL DEFAULT 'new',
  article_id INTEGER
);
CREATE INDEX idx_feed_items_status_pub ON feed_items(status, published_at);

CREATE TABLE articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  meta_description TEXT NOT NULL DEFAULT '',
  body_md TEXT,
  body_html TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'bitcoin',
  tags TEXT NOT NULL DEFAULT '[]',          -- JSON dizi
  sources TEXT NOT NULL DEFAULT '[]',       -- JSON [{name,url}]
  image_key TEXT,                           -- R2 anahtarı
  image_alt TEXT,
  -- draft | needs_review | published | rejected | unpublished
  status TEXT NOT NULL DEFAULT 'draft',
  quality_score REAL,
  quality_report TEXT,                      -- JSON: kontroller + editör puanları + revizyon geçmişi
  topic_tokens TEXT,                        -- tekrar haber yazmamak için konu parmak izi
  word_count INTEGER NOT NULL DEFAULT 0,
  ai_generated INTEGER NOT NULL DEFAULT 1,
  model TEXT,
  legacy_path TEXT,                         -- eski WordPress adresi
  views INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  published_at TEXT
);
CREATE INDEX idx_articles_status_pub ON articles(status, published_at DESC);
CREATE INDEX idx_articles_category ON articles(category, status, published_at DESC);
CREATE INDEX idx_articles_legacy ON articles(legacy_path);

CREATE TABLE runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trigger TEXT NOT NULL,                    -- cron | manual
  status TEXT NOT NULL DEFAULT 'running',   -- running | ok | error
  stats TEXT,
  log TEXT,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT
);

CREATE TABLE redirects (
  from_path TEXT PRIMARY KEY,
  to_path TEXT NOT NULL
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT INTO sources (name, feed_url, site_url, lang, weight) VALUES
  ('CoinDesk', 'https://www.coindesk.com/arc/outboundfeeds/rss/', 'https://www.coindesk.com', 'en', 1.3),
  ('Cointelegraph', 'https://cointelegraph.com/rss', 'https://cointelegraph.com', 'en', 1.1),
  ('Decrypt', 'https://decrypt.co/feed', 'https://decrypt.co', 'en', 1.1),
  ('The Block', 'https://www.theblock.co/rss.xml', 'https://www.theblock.co', 'en', 1.3),
  ('Bitcoin Magazine', 'https://bitcoinmagazine.com/.rss/full/', 'https://bitcoinmagazine.com', 'en', 1.0),
  ('CryptoSlate', 'https://cryptoslate.com/feed/', 'https://cryptoslate.com', 'en', 0.9),
  ('Blockworks', 'https://blockworks.co/feed', 'https://blockworks.co', 'en', 1.1),
  ('SEC', 'https://www.sec.gov/news/pressreleases.rss', 'https://www.sec.gov', 'en', 0.8),
  ('Cointelegraph Türkçe', 'https://tr.cointelegraph.com/rss', 'https://tr.cointelegraph.com', 'tr', 0.9);
