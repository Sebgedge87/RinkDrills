const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR || '/data';
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'iceboard.db');

// Ensure data directory exists
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (e) {
  // Fall back to local directory if /data is not writable
  console.warn('Could not create DATA_DIR, using local db:', e.message);
}

let db;
try {
  db = new Database(DB_PATH);
} catch (e) {
  const localPath = path.join(__dirname, 'iceboard.db');
  console.warn(`Could not open ${DB_PATH}, falling back to ${localPath}`);
  db = new Database(localPath);
}

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function init() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS drills (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      name             TEXT NOT NULL,
      description      TEXT DEFAULT '',
      category         TEXT NOT NULL DEFAULT 'custom',
      player_positions TEXT NOT NULL DEFAULT '[]',
      arrows           TEXT NOT NULL DEFAULT '[]',
      is_preset        INTEGER NOT NULL DEFAULT 0,
      created_at       TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sequences (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      description TEXT DEFAULT '',
      steps       TEXT NOT NULL DEFAULT '[]',
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      week_start  TEXT NOT NULL DEFAULT '',
      entries     TEXT NOT NULL DEFAULT '[]',
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS practice_sessions (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      name         TEXT NOT NULL,
      team_age     TEXT DEFAULT '',
      focus        TEXT DEFAULT '',
      duration_mins INTEGER NOT NULL DEFAULT 60,
      blocks       TEXT NOT NULL DEFAULT '[]',
      is_template  INTEGER NOT NULL DEFAULT 0,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

// Drill helpers
function listDrills() {
  return db.prepare(
    'SELECT id, name, category, description, is_preset, created_at, updated_at FROM drills ORDER BY is_preset DESC, id ASC'
  ).all();
}

function getDrill(id) {
  return db.prepare('SELECT * FROM drills WHERE id = ?').get(id);
}

function createDrill(data) {
  const stmt = db.prepare(`
    INSERT INTO drills (name, description, category, player_positions, arrows, is_preset)
    VALUES (@name, @description, @category, @player_positions, @arrows, @is_preset)
  `);
  const result = stmt.run({
    name: data.name,
    description: data.description || '',
    category: data.category || 'custom',
    player_positions: JSON.stringify(data.player_positions || []),
    arrows: JSON.stringify(data.arrows || []),
    is_preset: data.is_preset ? 1 : 0
  });
  return getDrill(result.lastInsertRowid);
}

function updateDrill(id, data) {
  const stmt = db.prepare(`
    UPDATE drills
    SET name = @name,
        description = @description,
        category = @category,
        player_positions = @player_positions,
        arrows = @arrows,
        updated_at = datetime('now')
    WHERE id = @id AND is_preset = 0
  `);
  const result = stmt.run({
    id,
    name: data.name,
    description: data.description || '',
    category: data.category || 'custom',
    player_positions: JSON.stringify(data.player_positions || []),
    arrows: JSON.stringify(data.arrows || [])
  });
  return result.changes > 0 ? getDrill(id) : null;
}

function deleteDrill(id) {
  const result = db.prepare('DELETE FROM drills WHERE id = ? AND is_preset = 0').run(id);
  return result.changes > 0;
}

function isDrillPreset(id) {
  const row = db.prepare('SELECT is_preset FROM drills WHERE id = ?').get(id);
  return row ? row.is_preset === 1 : false;
}

// Sequence helpers
function listSequences() {
  return db.prepare(
    'SELECT id, name, description, steps, created_at, updated_at FROM sequences ORDER BY id ASC'
  ).all();
}

function getSequence(id) {
  return db.prepare('SELECT * FROM sequences WHERE id = ?').get(id);
}

function createSequence(data) {
  const stmt = db.prepare(`
    INSERT INTO sequences (name, description, steps)
    VALUES (@name, @description, @steps)
  `);
  const result = stmt.run({
    name: data.name,
    description: data.description || '',
    steps: JSON.stringify(data.steps || [])
  });
  return getSequence(result.lastInsertRowid);
}

function updateSequence(id, data) {
  const stmt = db.prepare(`
    UPDATE sequences
    SET name = @name,
        description = @description,
        steps = @steps,
        updated_at = datetime('now')
    WHERE id = @id
  `);
  const result = stmt.run({
    id,
    name: data.name,
    description: data.description || '',
    steps: JSON.stringify(data.steps || [])
  });
  return result.changes > 0 ? getSequence(id) : null;
}

function deleteSequence(id) {
  const result = db.prepare('DELETE FROM sequences WHERE id = ?').run(id);
  return result.changes > 0;
}

// Settings helpers
function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

function setSetting(key, value) {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(value));
}

// Practice session helpers
function listSessions() {
  return db.prepare('SELECT id, name, team_age, focus, duration_mins, is_template, created_at, updated_at FROM practice_sessions ORDER BY is_template DESC, id DESC').all();
}
function getSession(id) {
  return db.prepare('SELECT * FROM practice_sessions WHERE id = ?').get(id);
}
function createSession(data) {
  const result = db.prepare(`
    INSERT INTO practice_sessions (name, team_age, focus, duration_mins, blocks, is_template)
    VALUES (@name, @team_age, @focus, @duration_mins, @blocks, @is_template)
  `).run({
    name: data.name, team_age: data.team_age || '', focus: data.focus || '',
    duration_mins: data.duration_mins || 60,
    blocks: JSON.stringify(data.blocks || []),
    is_template: data.is_template ? 1 : 0
  });
  return getSession(result.lastInsertRowid);
}
function updateSession(id, data) {
  const result = db.prepare(`
    UPDATE practice_sessions SET name=@name, team_age=@team_age, focus=@focus,
    duration_mins=@duration_mins, blocks=@blocks, is_template=@is_template,
    updated_at=datetime('now') WHERE id=@id
  `).run({
    id, name: data.name, team_age: data.team_age || '', focus: data.focus || '',
    duration_mins: data.duration_mins || 60,
    blocks: JSON.stringify(data.blocks || []),
    is_template: data.is_template ? 1 : 0
  });
  return result.changes > 0 ? getSession(id) : null;
}
function deleteSession(id) {
  return db.prepare('DELETE FROM practice_sessions WHERE id = ?').run(id).changes > 0;
}

// Schedule helpers
function listSchedules() {
  return db.prepare('SELECT id, name, week_start, entries, created_at, updated_at FROM schedules ORDER BY week_start DESC, id DESC').all();
}
function getSchedule(id) {
  return db.prepare('SELECT * FROM schedules WHERE id = ?').get(id);
}
function createSchedule(data) {
  const result = db.prepare(`
    INSERT INTO schedules (name, week_start, entries) VALUES (@name, @week_start, @entries)
  `).run({ name: data.name, week_start: data.week_start || '', entries: JSON.stringify(data.entries || []) });
  return getSchedule(result.lastInsertRowid);
}
function updateSchedule(id, data) {
  const result = db.prepare(`
    UPDATE schedules SET name=@name, week_start=@week_start, entries=@entries, updated_at=datetime('now') WHERE id=@id
  `).run({ id, name: data.name, week_start: data.week_start || '', entries: JSON.stringify(data.entries || []) });
  return result.changes > 0 ? getSchedule(id) : null;
}
function deleteSchedule(id) {
  return db.prepare('DELETE FROM schedules WHERE id = ?').run(id).changes > 0;
}

module.exports = {
  init,
  listDrills, getDrill, createDrill, updateDrill, deleteDrill, isDrillPreset,
  listSequences, getSequence, createSequence, updateSequence, deleteSequence,
  listSchedules, getSchedule, createSchedule, updateSchedule, deleteSchedule,
  listSessions, getSession, createSession, updateSession, deleteSession,
  getSetting, setSetting
};
