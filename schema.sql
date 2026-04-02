-- SQLite schema draft for local music manager
-- 说明：better-auth 的用户/会话表由其 adapter 管理；此处仅包含业务/索引/任务相关表。
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;

-- ========== Business ==========
CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT PRIMARY KEY,
  data_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS playlists (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_playlists_user_id ON playlists(user_id);

CREATE TABLE IF NOT EXISTS playlist_items (
  id TEXT PRIMARY KEY,
  playlist_id TEXT NOT NULL,
  track_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_playlist_items_playlist ON playlist_items(playlist_id, position);
CREATE INDEX IF NOT EXISTS idx_playlist_items_track ON playlist_items(track_id);

CREATE TABLE IF NOT EXISTS user_ignored_tracks (
  user_id TEXT NOT NULL,
  track_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, track_id)
);
CREATE INDEX IF NOT EXISTS idx_user_ignored_track ON user_ignored_tracks(track_id);

-- ========== Media index ==========
CREATE TABLE IF NOT EXISTS tracks (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL UNIQUE,
  dir_path TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mtime_ms INTEGER NOT NULL,
  container TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  bitrate_kbps INTEGER,
  sample_rate INTEGER,
  bit_depth INTEGER,
  channels INTEGER,
  title TEXT,
  artist TEXT,
  album TEXT,
  album_artist TEXT,
  track_no INTEGER,
  disc_no INTEGER,
  year INTEGER,
  genre TEXT,
  tags_json TEXT,
  artwork_kind TEXT,
  artwork_mime TEXT,
  artwork_hash TEXT,
  lyrics_kind TEXT,
  lyrics_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tracks_dir_path ON tracks(dir_path);
CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album, album_artist);
CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist);
CREATE INDEX IF NOT EXISTS idx_tracks_updated_at ON tracks(updated_at);

CREATE VIRTUAL TABLE IF NOT EXISTS tracks_fts
USING fts5(
  track_id UNINDEXED,
  title,
  artist,
  album,
  album_artist,
  path,
  content=''
);

CREATE TRIGGER IF NOT EXISTS trg_tracks_fts_insert AFTER INSERT ON tracks BEGIN
  INSERT INTO tracks_fts(track_id, title, artist, album, album_artist, path)
  VALUES (new.id, new.title, new.artist, new.album, new.album_artist, new.path);
END;
CREATE TRIGGER IF NOT EXISTS trg_tracks_fts_update AFTER UPDATE ON tracks BEGIN
  DELETE FROM tracks_fts WHERE track_id = old.id;
  INSERT INTO tracks_fts(track_id, title, artist, album, album_artist, path)
  VALUES (new.id, new.title, new.artist, new.album, new.album_artist, new.path);
END;
CREATE TRIGGER IF NOT EXISTS trg_tracks_fts_delete AFTER DELETE ON tracks BEGIN
  DELETE FROM tracks_fts WHERE track_id = old.id;
END;

-- ========== Plans ==========
CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  created_by TEXT NOT NULL,
  type TEXT NOT NULL,
  scope_json TEXT NOT NULL,
  params_json TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_plans_created_by ON plans(created_by, created_at);
CREATE INDEX IF NOT EXISTS idx_plans_status ON plans(status, updated_at);

CREATE TABLE IF NOT EXISTS plan_items (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  track_id TEXT,
  from_path TEXT,
  to_path TEXT,
  tag_diff_json TEXT,
  warnings_json TEXT,
  status TEXT NOT NULL,
  error_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_plan_items_plan ON plan_items(plan_id, status);
CREATE INDEX IF NOT EXISTS idx_plan_items_track ON plan_items(track_id);

-- ========== Jobs queue ==========
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  payload_json TEXT NOT NULL,
  progress REAL NOT NULL DEFAULT 0.0,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  locked_by TEXT,
  locked_at TEXT,
  heartbeat_at TEXT,
  error_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_jobs_status_pri ON jobs(status, priority, created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_locked ON jobs(locked_at, locked_by);

-- ========== Transcode cache ==========
CREATE TABLE IF NOT EXISTS transcode_cache (
  id TEXT PRIMARY KEY,
  track_id TEXT NOT NULL,
  profile TEXT NOT NULL,
  source_mtime_ms INTEGER NOT NULL,
  encoder_version TEXT NOT NULL,
  path TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  content_type TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_access_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_transcode_cache_key
ON transcode_cache(track_id, profile, source_mtime_ms, encoder_version);

