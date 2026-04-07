const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR || '/data';
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'iceboard.db');

try {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
} catch (e) {
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
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      team_age      TEXT DEFAULT '',
      focus         TEXT DEFAULT '',
      duration_mins INTEGER NOT NULL DEFAULT 60,
      blocks        TEXT NOT NULL DEFAULT '[]',
      is_template   INTEGER NOT NULL DEFAULT 0,
      date          TEXT DEFAULT '',
      start_time    TEXT DEFAULT '',
      location      TEXT DEFAULT '',
      status        TEXT NOT NULL DEFAULT 'draft',
      share_token   TEXT DEFAULT NULL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS teams (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      age_group  TEXT DEFAULT '',
      season     TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS players (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id    INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      name       TEXT NOT NULL,
      number     TEXT DEFAULT '',
      position   TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS session_roster (
      session_id INTEGER NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
      player_id  INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      PRIMARY KEY (session_id, player_id)
    );
  `);

  // Migrate existing practice_sessions table (adds columns if missing)
  const migrations = [
    "ALTER TABLE practice_sessions ADD COLUMN date TEXT DEFAULT ''",
    "ALTER TABLE practice_sessions ADD COLUMN start_time TEXT DEFAULT ''",
    "ALTER TABLE practice_sessions ADD COLUMN location TEXT DEFAULT ''",
    "ALTER TABLE practice_sessions ADD COLUMN status TEXT NOT NULL DEFAULT 'draft'",
    "ALTER TABLE practice_sessions ADD COLUMN share_token TEXT DEFAULT NULL",
  ];
  for (const sql of migrations) {
    try { db.exec(sql); } catch (_) { /* column already exists */ }
  }
}

// ── Drill helpers ──────────────────────────────────────────────────────────────
function listDrills() {
  return db.prepare(
    'SELECT id, name, category, description, is_preset, created_at, updated_at FROM drills ORDER BY is_preset DESC, id ASC'
  ).all();
}
function getDrill(id) {
  return db.prepare('SELECT * FROM drills WHERE id = ?').get(id);
}
function createDrill(data) {
  const result = db.prepare(`
    INSERT INTO drills (name, description, category, player_positions, arrows, is_preset)
    VALUES (@name, @description, @category, @player_positions, @arrows, @is_preset)
  `).run({
    name: data.name, description: data.description || '',
    category: data.category || 'custom',
    player_positions: JSON.stringify(data.player_positions || []),
    arrows: JSON.stringify(data.arrows || []),
    is_preset: data.is_preset ? 1 : 0
  });
  return getDrill(result.lastInsertRowid);
}
function updateDrill(id, data) {
  const result = db.prepare(`
    UPDATE drills SET name=@name, description=@description, category=@category,
    player_positions=@player_positions, arrows=@arrows, updated_at=datetime('now')
    WHERE id=@id AND is_preset=0
  `).run({
    id, name: data.name, description: data.description || '',
    category: data.category || 'custom',
    player_positions: JSON.stringify(data.player_positions || []),
    arrows: JSON.stringify(data.arrows || [])
  });
  return result.changes > 0 ? getDrill(id) : null;
}
function deleteDrill(id) {
  return db.prepare('DELETE FROM drills WHERE id=? AND is_preset=0').run(id).changes > 0;
}
function isDrillPreset(id) {
  const row = db.prepare('SELECT is_preset FROM drills WHERE id=?').get(id);
  return row ? row.is_preset === 1 : false;
}

// ── Sequence helpers ───────────────────────────────────────────────────────────
function listSequences() {
  return db.prepare(
    'SELECT id, name, description, steps, created_at, updated_at FROM sequences ORDER BY id ASC'
  ).all();
}
function getSequence(id) {
  return db.prepare('SELECT * FROM sequences WHERE id=?').get(id);
}
function createSequence(data) {
  const result = db.prepare(`
    INSERT INTO sequences (name, description, steps) VALUES (@name, @description, @steps)
  `).run({ name: data.name, description: data.description || '', steps: JSON.stringify(data.steps || []) });
  return getSequence(result.lastInsertRowid);
}
function updateSequence(id, data) {
  const result = db.prepare(`
    UPDATE sequences SET name=@name, description=@description, steps=@steps,
    updated_at=datetime('now') WHERE id=@id
  `).run({ id, name: data.name, description: data.description || '', steps: JSON.stringify(data.steps || []) });
  return result.changes > 0 ? getSequence(id) : null;
}
function deleteSequence(id) {
  return db.prepare('DELETE FROM sequences WHERE id=?').run(id).changes > 0;
}

// ── Settings helpers ───────────────────────────────────────────────────────────
function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key=?').get(key);
  return row ? row.value : null;
}
function setSetting(key, value) {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(value));
}

// ── Practice session helpers ───────────────────────────────────────────────────
function listSessions() {
  return db.prepare(`
    SELECT id, name, team_age, focus, duration_mins, is_template,
           date, start_time, location, status, share_token, created_at, updated_at
    FROM practice_sessions ORDER BY is_template DESC, date DESC, id DESC
  `).all();
}
function getSession(id) {
  return db.prepare('SELECT * FROM practice_sessions WHERE id=?').get(id);
}
function getSessionByToken(token) {
  return db.prepare('SELECT * FROM practice_sessions WHERE share_token=? AND status=?').get(token, 'published');
}
function createSession(data) {
  const result = db.prepare(`
    INSERT INTO practice_sessions (name, team_age, focus, duration_mins, blocks, is_template,
                                   date, start_time, location, status)
    VALUES (@name, @team_age, @focus, @duration_mins, @blocks, @is_template,
            @date, @start_time, @location, @status)
  `).run({
    name: data.name, team_age: data.team_age || '', focus: data.focus || '',
    duration_mins: data.duration_mins || 60,
    blocks: JSON.stringify(data.blocks || []),
    is_template: data.is_template ? 1 : 0,
    date: data.date || '', start_time: data.start_time || '',
    location: data.location || '', status: data.status || 'draft'
  });
  return getSession(result.lastInsertRowid);
}
function updateSession(id, data) {
  const result = db.prepare(`
    UPDATE practice_sessions SET name=@name, team_age=@team_age, focus=@focus,
    duration_mins=@duration_mins, blocks=@blocks, is_template=@is_template,
    date=@date, start_time=@start_time, location=@location, status=@status,
    updated_at=datetime('now') WHERE id=@id
  `).run({
    id, name: data.name, team_age: data.team_age || '', focus: data.focus || '',
    duration_mins: data.duration_mins || 60,
    blocks: JSON.stringify(data.blocks || []),
    is_template: data.is_template ? 1 : 0,
    date: data.date || '', start_time: data.start_time || '',
    location: data.location || '', status: data.status || 'draft'
  });
  return result.changes > 0 ? getSession(id) : null;
}
function publishSession(id, token) {
  db.prepare(`
    UPDATE practice_sessions SET status='published', share_token=@token,
    updated_at=datetime('now') WHERE id=@id
  `).run({ id, token });
  return getSession(id);
}
function deleteSession(id) {
  return db.prepare('DELETE FROM practice_sessions WHERE id=?').run(id).changes > 0;
}

// ── Session roster helpers ─────────────────────────────────────────────────────
function getSessionRoster(sessionId) {
  return db.prepare(`
    SELECT p.id, p.name, p.number, p.position, t.name AS team_name
    FROM session_roster sr
    JOIN players p ON p.id = sr.player_id
    JOIN teams t ON t.id = p.team_id
    WHERE sr.session_id = ?
    ORDER BY p.name ASC
  `).all(sessionId);
}
function setSessionRoster(sessionId, playerIds) {
  const del = db.prepare('DELETE FROM session_roster WHERE session_id=?');
  const ins = db.prepare('INSERT OR IGNORE INTO session_roster (session_id, player_id) VALUES (?, ?)');
  db.transaction(() => {
    del.run(sessionId);
    for (const pid of playerIds) ins.run(sessionId, pid);
  })();
}

// ── Team helpers ───────────────────────────────────────────────────────────────
function listTeams() {
  return db.prepare('SELECT * FROM teams ORDER BY name ASC').all();
}
function getTeam(id) {
  return db.prepare('SELECT * FROM teams WHERE id=?').get(id);
}
function createTeam(data) {
  const result = db.prepare(`
    INSERT INTO teams (name, age_group, season) VALUES (@name, @age_group, @season)
  `).run({ name: data.name, age_group: data.age_group || '', season: data.season || '' });
  return getTeam(result.lastInsertRowid);
}
function updateTeam(id, data) {
  const result = db.prepare(`
    UPDATE teams SET name=@name, age_group=@age_group, season=@season WHERE id=@id
  `).run({ id, name: data.name, age_group: data.age_group || '', season: data.season || '' });
  return result.changes > 0 ? getTeam(id) : null;
}
function deleteTeam(id) {
  return db.prepare('DELETE FROM teams WHERE id=?').run(id).changes > 0;
}

// ── Player helpers ─────────────────────────────────────────────────────────────
function listPlayers(teamId) {
  const sql = teamId
    ? 'SELECT * FROM players WHERE team_id=? ORDER BY name ASC'
    : 'SELECT p.*, t.name AS team_name FROM players p JOIN teams t ON t.id=p.team_id ORDER BY t.name, p.name ASC';
  return teamId
    ? db.prepare(sql).all(teamId)
    : db.prepare(sql).all();
}
function getPlayer(id) {
  return db.prepare('SELECT * FROM players WHERE id=?').get(id);
}
function createPlayer(data) {
  const result = db.prepare(`
    INSERT INTO players (team_id, name, number, position)
    VALUES (@team_id, @name, @number, @position)
  `).run({ team_id: data.team_id, name: data.name, number: data.number || '', position: data.position || '' });
  return getPlayer(result.lastInsertRowid);
}
function updatePlayer(id, data) {
  const result = db.prepare(`
    UPDATE players SET name=@name, number=@number, position=@position WHERE id=@id
  `).run({ id, name: data.name, number: data.number || '', position: data.position || '' });
  return result.changes > 0 ? getPlayer(id) : null;
}
function deletePlayer(id) {
  return db.prepare('DELETE FROM players WHERE id=?').run(id).changes > 0;
}

// ── Schedule helpers ───────────────────────────────────────────────────────────
function listSchedules() {
  return db.prepare('SELECT id, name, week_start, entries, created_at, updated_at FROM schedules ORDER BY week_start DESC, id DESC').all();
}
function getSchedule(id) {
  return db.prepare('SELECT * FROM schedules WHERE id=?').get(id);
}
function createSchedule(data) {
  const result = db.prepare(`
    INSERT INTO schedules (name, week_start, entries) VALUES (@name, @week_start, @entries)
  `).run({ name: data.name, week_start: data.week_start || '', entries: JSON.stringify(data.entries || []) });
  return getSchedule(result.lastInsertRowid);
}
function updateSchedule(id, data) {
  const result = db.prepare(`
    UPDATE schedules SET name=@name, week_start=@week_start, entries=@entries,
    updated_at=datetime('now') WHERE id=@id
  `).run({ id, name: data.name, week_start: data.week_start || '', entries: JSON.stringify(data.entries || []) });
  return result.changes > 0 ? getSchedule(id) : null;
}
function deleteSchedule(id) {
  return db.prepare('DELETE FROM schedules WHERE id=?').run(id).changes > 0;
}

module.exports = {
  init,
  listDrills, getDrill, createDrill, updateDrill, deleteDrill, isDrillPreset,
  listSequences, getSequence, createSequence, updateSequence, deleteSequence,
  listSchedules, getSchedule, createSchedule, updateSchedule, deleteSchedule,
  listSessions, getSession, getSessionByToken, createSession, updateSession,
  publishSession, deleteSession,
  getSessionRoster, setSessionRoster,
  listTeams, getTeam, createTeam, updateTeam, deleteTeam,
  listPlayers, getPlayer, createPlayer, updatePlayer, deletePlayer,
  getSetting, setSetting
};
