import Database from 'better-sqlite3';
import { config, ensureDataDirectories } from './config.js';

ensureDataDirectories();

export const db = new Database(config.dbFile);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS images (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    original_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    uploaded_at INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued'
  );

  CREATE TABLE IF NOT EXISTS queue (
    image_id TEXT PRIMARY KEY,
    ord INTEGER NOT NULL,
    FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS run_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS judges (
    id TEXT PRIMARY KEY,
    invite_code TEXT NOT NULL UNIQUE,
    secret TEXT NOT NULL UNIQUE,
    name TEXT,
    icon TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER NOT NULL,
    activated_at INTEGER,
    last_seen_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS votes (
    image_id TEXT NOT NULL,
    judge_id TEXT NOT NULL,
    score INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (image_id, judge_id),
    FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE,
    FOREIGN KEY (judge_id) REFERENCES judges(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS producer_auth (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
`);
