const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '../database.db'));

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    queue_position INTEGER,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    shown_at DATETIME,
    locked_at DATETIME,
    final_score REAL
  );

  CREATE TABLE IF NOT EXISTS judges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_active DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    image_id INTEGER NOT NULL,
    judge_id INTEGER NOT NULL,
    score INTEGER NOT NULL CHECK(score >= 1 AND score <= 5),
    voted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (image_id) REFERENCES images(id),
    FOREIGN KEY (judge_id) REFERENCES judges(id)
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    image_id INTEGER,
    details TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (image_id) REFERENCES images(id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_votes_image ON votes(image_id);
  CREATE INDEX IF NOT EXISTS idx_votes_judge ON votes(judge_id);
  CREATE INDEX IF NOT EXISTS idx_images_queue ON images(queue_position);
`);

// Initialize default settings
const initSettings = db.prepare(`
  INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)
`);

initSettings.run('timer_duration', '30');
initSettings.run('current_image_id', 'null');
initSettings.run('timer_state', 'stopped'); // stopped, running, paused
initSettings.run('timer_remaining', '30');
initSettings.run('timer_started_at', 'null');

console.log('Database initialized successfully');

module.exports = db;
