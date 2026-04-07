const express = require('express');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Helpers ───────────────────────────────────────────────────────────────────
function generateToken() {
  return crypto.randomBytes(16).toString('hex');
}

function buildICS(s) {
  const uid = `session-${s.id}@iceboard`;
  const now = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';
  let dtstart = now;
  if (s.date) {
    const d = s.date.replace(/-/g, '');
    const t = (s.start_time || '09:00').replace(':', '') + '00';
    dtstart = `${d}T${t}`;
  }
  const dur = `PT${s.duration_mins || 60}M`;
  const desc = [s.focus, s.team_age].filter(Boolean).join(' — ').replace(/[\\;,]/g, '\\$&');
  const loc = (s.location || '').replace(/[\\;,]/g, '\\$&');
  const name = (s.name || '').replace(/[\\;,]/g, '\\$&');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//IceBoard//Hockey Practice//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${dtstart}`,
    `DURATION:${dur}`,
    `SUMMARY:${name}`,
    loc ? `LOCATION:${loc}` : '',
    desc ? `DESCRIPTION:${desc}` : '',
    'END:VEVENT',
    'END:VCALENDAR'
  ].filter(Boolean).join('\r\n');
}

// ── DB init ──────────────────────────────────────────────────────────────────
db.init();
seedPresets();

// ── Preset seed data ─────────────────────────────────────────────────────────
function seedPresets() {
  if (db.getSetting('drills_seeded') === 'true') return;

  // Default player positions (both teams lined up symmetrically)
  const defaultRed = [
    { id: 'r1', team: 'red', role: 'gk', bx: 0.04, by: 0.5 },
    { id: 'r2', team: 'red', role: 'player', bx: 0.15, by: 0.25 },
    { id: 'r3', team: 'red', role: 'player', bx: 0.15, by: 0.75 },
    { id: 'r4', team: 'red', role: 'player', bx: 0.25, by: 0.35 },
    { id: 'r5', team: 'red', role: 'player', bx: 0.25, by: 0.65 },
    { id: 'r6', team: 'red', role: 'player', bx: 0.20, by: 0.5 }
  ];
  const defaultBlue = [
    { id: 'b1', team: 'blue', role: 'gk', bx: 0.96, by: 0.5 },
    { id: 'b2', team: 'blue', role: 'player', bx: 0.85, by: 0.25 },
    { id: 'b3', team: 'blue', role: 'player', bx: 0.85, by: 0.75 },
    { id: 'b4', team: 'blue', role: 'player', bx: 0.75, by: 0.35 },
    { id: 'b5', team: 'blue', role: 'player', bx: 0.75, by: 0.65 },
    { id: 'b6', team: 'blue', role: 'player', bx: 0.80, by: 0.5 }
  ];

  const presets = [
    {
      name: 'Horseshoe',
      description: 'Players skate from one corner, around the net, and back up the opposite wing. Classic conditioning and puck-handling drill.',
      category: 'conditioning',
      player_positions: [
        { id: 'r1', team: 'red', role: 'gk', bx: 0.04, by: 0.5 },
        { id: 'r2', team: 'red', role: 'player', bx: 0.08, by: 0.15 },
        { id: 'r3', team: 'red', role: 'player', bx: 0.08, by: 0.35 },
        { id: 'r4', team: 'red', role: 'player', bx: 0.08, by: 0.65 },
        { id: 'r5', team: 'red', role: 'player', bx: 0.08, by: 0.85 },
        { id: 'r6', team: 'red', role: 'player', bx: 0.5, by: 0.5 },
        { id: 'b1', team: 'blue', role: 'gk', bx: 0.96, by: 0.5 },
        { id: 'b2', team: 'blue', role: 'player', bx: 0.92, by: 0.15 },
        { id: 'b3', team: 'blue', role: 'player', bx: 0.92, by: 0.35 },
        { id: 'b4', team: 'blue', role: 'player', bx: 0.92, by: 0.65 },
        { id: 'b5', team: 'blue', role: 'player', bx: 0.92, by: 0.85 },
        { id: 'b6', team: 'blue', role: 'player', bx: 0.5, by: 0.3 }
      ],
      arrows: [
        { pid: 'r2', tbx: 0.04, tby: 0.12 },
        { pid: 'r3', tbx: 0.04, tby: 0.88 },
        { pid: 'r4', tbx: 0.08, tby: 0.92 },
        { pid: 'r5', tbx: 0.5, tby: 0.92 },
        { pid: 'b2', tbx: 0.96, tby: 0.12 },
        { pid: 'b3', tbx: 0.96, tby: 0.88 },
        { pid: 'b4', tbx: 0.92, tby: 0.92 },
        { pid: 'b5', tbx: 0.5, tby: 0.92 }
      ]
    },
    {
      name: '3-on-2 Rush',
      description: 'Three attackers rush against two defenders plus a goalie. Develops offensive creativity and defensive positioning.',
      category: 'offensive',
      player_positions: [
        { id: 'r1', team: 'red', role: 'gk', bx: 0.04, by: 0.5 },
        { id: 'r2', team: 'red', role: 'player', bx: 0.35, by: 0.3 },
        { id: 'r3', team: 'red', role: 'player', bx: 0.35, by: 0.5 },
        { id: 'r4', team: 'red', role: 'player', bx: 0.35, by: 0.7 },
        { id: 'r5', team: 'red', role: 'player', bx: 0.20, by: 0.4 },
        { id: 'r6', team: 'red', role: 'player', bx: 0.20, by: 0.6 },
        { id: 'b1', team: 'blue', role: 'gk', bx: 0.96, by: 0.5 },
        { id: 'b2', team: 'blue', role: 'player', bx: 0.65, by: 0.38 },
        { id: 'b3', team: 'blue', role: 'player', bx: 0.65, by: 0.62 },
        { id: 'b4', team: 'blue', role: 'player', bx: 0.80, by: 0.4 },
        { id: 'b5', team: 'blue', role: 'player', bx: 0.80, by: 0.6 },
        { id: 'b6', team: 'blue', role: 'player', bx: 0.50, by: 0.5 }
      ],
      arrows: [
        { pid: 'r2', tbx: 0.70, tby: 0.25 },
        { pid: 'r3', tbx: 0.75, tby: 0.5 },
        { pid: 'r4', tbx: 0.70, tby: 0.75 },
        { pid: 'b2', tbx: 0.55, tby: 0.35 },
        { pid: 'b3', tbx: 0.55, tby: 0.65 }
      ]
    },
    {
      name: 'Breakout',
      description: 'D-to-D pass initiates a breakout with wingers stretching the ice. Essential team play for exiting the defensive zone.',
      category: 'skating',
      player_positions: [
        { id: 'r1', team: 'red', role: 'gk', bx: 0.04, by: 0.5 },
        { id: 'r2', team: 'red', role: 'player', bx: 0.15, by: 0.22 },
        { id: 'r3', team: 'red', role: 'player', bx: 0.15, by: 0.78 },
        { id: 'r4', team: 'red', role: 'player', bx: 0.12, by: 0.38 },
        { id: 'r5', team: 'red', role: 'player', bx: 0.12, by: 0.62 },
        { id: 'r6', team: 'red', role: 'player', bx: 0.20, by: 0.5 },
        { id: 'b1', team: 'blue', role: 'gk', bx: 0.96, by: 0.5 },
        { id: 'b2', team: 'blue', role: 'player', bx: 0.60, by: 0.25 },
        { id: 'b3', team: 'blue', role: 'player', bx: 0.60, by: 0.75 },
        { id: 'b4', team: 'blue', role: 'player', bx: 0.72, by: 0.38 },
        { id: 'b5', team: 'blue', role: 'player', bx: 0.72, by: 0.62 },
        { id: 'b6', team: 'blue', role: 'player', bx: 0.80, by: 0.5 }
      ],
      arrows: [
        { pid: 'r4', tbx: 0.12, tby: 0.62 },
        { pid: 'r5', tbx: 0.12, tby: 0.38 },
        { pid: 'r2', tbx: 0.40, tby: 0.10 },
        { pid: 'r3', tbx: 0.40, tby: 0.90 },
        { pid: 'r6', tbx: 0.40, tby: 0.5 }
      ]
    },
    {
      name: 'Figure-8',
      description: 'Skaters loop through centre ice in a figure-8 pattern. Classic edge work and crossover training.',
      category: 'skating',
      player_positions: [
        { id: 'r1', team: 'red', role: 'gk', bx: 0.04, by: 0.5 },
        { id: 'r2', team: 'red', role: 'player', bx: 0.30, by: 0.25 },
        { id: 'r3', team: 'red', role: 'player', bx: 0.50, by: 0.50 },
        { id: 'r4', team: 'red', role: 'player', bx: 0.70, by: 0.25 },
        { id: 'r5', team: 'red', role: 'player', bx: 0.30, by: 0.75 },
        { id: 'r6', team: 'red', role: 'player', bx: 0.70, by: 0.75 },
        { id: 'b1', team: 'blue', role: 'gk', bx: 0.96, by: 0.5 },
        { id: 'b2', team: 'blue', role: 'player', bx: 0.25, by: 0.50 },
        { id: 'b3', team: 'blue', role: 'player', bx: 0.75, by: 0.50 },
        { id: 'b4', team: 'blue', role: 'player', bx: 0.50, by: 0.25 },
        { id: 'b5', team: 'blue', role: 'player', bx: 0.50, by: 0.75 },
        { id: 'b6', team: 'blue', role: 'player', bx: 0.45, by: 0.50 }
      ],
      arrows: [
        { pid: 'r2', tbx: 0.50, tby: 0.50 },
        { pid: 'r3', tbx: 0.70, tby: 0.75 },
        { pid: 'r4', tbx: 0.50, tby: 0.50 },
        { pid: 'r5', tbx: 0.50, tby: 0.50 },
        { pid: 'r6', tbx: 0.50, tby: 0.50 }
      ]
    },
    {
      name: 'Power Play',
      description: 'Five attackers exploit numerical advantage with umbrella formation. Focuses on passing lanes and one-timer opportunities.',
      category: 'offensive',
      player_positions: [
        { id: 'r1', team: 'red', role: 'gk', bx: 0.04, by: 0.5 },
        { id: 'r2', team: 'red', role: 'player', bx: 0.72, by: 0.15 },
        { id: 'r3', team: 'red', role: 'player', bx: 0.72, by: 0.85 },
        { id: 'r4', team: 'red', role: 'player', bx: 0.62, by: 0.30 },
        { id: 'r5', team: 'red', role: 'player', bx: 0.62, by: 0.70 },
        { id: 'r6', team: 'red', role: 'player', bx: 0.58, by: 0.50 },
        { id: 'b1', team: 'blue', role: 'gk', bx: 0.96, by: 0.5 },
        { id: 'b2', team: 'blue', role: 'player', bx: 0.78, by: 0.35 },
        { id: 'b3', team: 'blue', role: 'player', bx: 0.78, by: 0.65 },
        { id: 'b4', team: 'blue', role: 'player', bx: 0.70, by: 0.50 },
        { id: 'b5', team: 'blue', role: 'player', bx: 0.50, by: 0.30 },
        { id: 'b6', team: 'blue', role: 'player', bx: 0.50, by: 0.70 }
      ],
      arrows: [
        { pid: 'r2', tbx: 0.85, tby: 0.30 },
        { pid: 'r4', tbx: 0.80, tby: 0.50 },
        { pid: 'r5', tbx: 0.85, tby: 0.65 },
        { pid: 'r6', tbx: 0.72, tby: 0.50 },
        { pid: 'r3', tbx: 0.85, tby: 0.70 }
      ]
    },
    {
      name: 'Penalty Kill',
      description: 'Four skaters in diamond formation kill a penalty. Focuses on shot blocking, collapsing to the slot, and clears.',
      category: 'defensive',
      player_positions: [
        { id: 'r1', team: 'red', role: 'gk', bx: 0.04, by: 0.5 },
        { id: 'r2', team: 'red', role: 'player', bx: 0.22, by: 0.50 },
        { id: 'r3', team: 'red', role: 'player', bx: 0.14, by: 0.35 },
        { id: 'r4', team: 'red', role: 'player', bx: 0.14, by: 0.65 },
        { id: 'r5', team: 'red', role: 'player', bx: 0.10, by: 0.50 },
        { id: 'r6', team: 'red', role: 'player', bx: 0.28, by: 0.50 },
        { id: 'b1', team: 'blue', role: 'gk', bx: 0.96, by: 0.5 },
        { id: 'b2', team: 'blue', role: 'player', bx: 0.30, by: 0.20 },
        { id: 'b3', team: 'blue', role: 'player', bx: 0.30, by: 0.80 },
        { id: 'b4', team: 'blue', role: 'player', bx: 0.22, by: 0.35 },
        { id: 'b5', team: 'blue', role: 'player', bx: 0.22, by: 0.65 },
        { id: 'b6', team: 'blue', role: 'player', bx: 0.38, by: 0.50 }
      ],
      arrows: [
        { pid: 'r3', tbx: 0.20, tby: 0.35 },
        { pid: 'r4', tbx: 0.20, tby: 0.65 },
        { pid: 'r2', tbx: 0.12, tby: 0.50 },
        { pid: 'b2', tbx: 0.25, tby: 0.30 },
        { pid: 'b3', tbx: 0.25, tby: 0.70 }
      ]
    },
    {
      name: '2-on-1',
      description: 'Two attackers challenge a lone defender and goalie. Develops decision-making for the shooter and passer.',
      category: 'offensive',
      player_positions: [
        { id: 'r1', team: 'red', role: 'gk', bx: 0.04, by: 0.5 },
        { id: 'r2', team: 'red', role: 'player', bx: 0.40, by: 0.30 },
        { id: 'r3', team: 'red', role: 'player', bx: 0.40, by: 0.70 },
        { id: 'r4', team: 'red', role: 'player', bx: 0.25, by: 0.30 },
        { id: 'r5', team: 'red', role: 'player', bx: 0.25, by: 0.70 },
        { id: 'r6', team: 'red', role: 'player', bx: 0.30, by: 0.50 },
        { id: 'b1', team: 'blue', role: 'gk', bx: 0.96, by: 0.5 },
        { id: 'b2', team: 'blue', role: 'player', bx: 0.65, by: 0.50 },
        { id: 'b3', team: 'blue', role: 'player', bx: 0.78, by: 0.35 },
        { id: 'b4', team: 'blue', role: 'player', bx: 0.78, by: 0.65 },
        { id: 'b5', team: 'blue', role: 'player', bx: 0.85, by: 0.40 },
        { id: 'b6', team: 'blue', role: 'player', bx: 0.85, by: 0.60 }
      ],
      arrows: [
        { pid: 'r2', tbx: 0.75, tby: 0.25 },
        { pid: 'r3', tbx: 0.75, tby: 0.75 },
        { pid: 'b2', tbx: 0.60, tby: 0.50 }
      ]
    }
  ];

  for (const preset of presets) {
    db.createDrill({ ...preset, is_preset: true });
  }
  db.setSetting('drills_seeded', 'true');
  console.log('Seeded 7 preset drills.');
}

// ── API: Drills ───────────────────────────────────────────────────────────────
app.get('/api/drills', (req, res) => {
  try {
    const drills = db.listDrills();
    res.json({ success: true, data: drills });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/drills/:id', (req, res) => {
  try {
    const drill = db.getDrill(Number(req.params.id));
    if (!drill) return res.status(404).json({ success: false, error: 'Drill not found' });
    drill.player_positions = JSON.parse(drill.player_positions || '[]');
    drill.arrows = JSON.parse(drill.arrows || '[]');
    res.json({ success: true, data: drill });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

const VALID_CATEGORIES = ['warmup','skating','passing','shooting','defensive','offensive','conditioning','custom'];

app.post('/api/drills', (req, res) => {
  try {
    const { name, description, category, player_positions, arrows } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ success: false, error: 'name is required' });
    if (category && !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ success: false, error: 'invalid category' });
    }
    const drill = db.createDrill({ name: name.trim(), description, category, player_positions, arrows, is_preset: false });
    drill.player_positions = JSON.parse(drill.player_positions || '[]');
    drill.arrows = JSON.parse(drill.arrows || '[]');
    res.status(201).json({ success: true, data: drill });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.put('/api/drills/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    if (db.isDrillPreset(id)) return res.status(403).json({ success: false, error: 'Cannot modify a preset drill' });
    const { name, description, category, player_positions, arrows } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ success: false, error: 'name is required' });
    if (category && !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ success: false, error: 'invalid category' });
    }
    const drill = db.updateDrill(id, { name: name.trim(), description, category, player_positions, arrows });
    if (!drill) return res.status(404).json({ success: false, error: 'Drill not found' });
    drill.player_positions = JSON.parse(drill.player_positions || '[]');
    drill.arrows = JSON.parse(drill.arrows || '[]');
    res.json({ success: true, data: drill });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.delete('/api/drills/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    if (db.isDrillPreset(id)) return res.status(403).json({ success: false, error: 'Cannot delete a preset drill' });
    const ok = db.deleteDrill(id);
    if (!ok) return res.status(404).json({ success: false, error: 'Drill not found' });
    res.json({ success: true, data: { id } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── API: Sequences ────────────────────────────────────────────────────────────
app.get('/api/sequences', (req, res) => {
  try {
    const seqs = db.listSequences().map(s => ({
      ...s,
      steps: JSON.parse(s.steps || '[]')
    }));
    res.json({ success: true, data: seqs });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/sequences/:id', (req, res) => {
  try {
    const seq = db.getSequence(Number(req.params.id));
    if (!seq) return res.status(404).json({ success: false, error: 'Sequence not found' });
    const steps = JSON.parse(seq.steps || '[]');
    // Resolve each step's drill
    const resolvedSteps = steps.map(step => {
      const drill = db.getDrill(step.drill_id);
      if (drill) {
        drill.player_positions = JSON.parse(drill.player_positions || '[]');
        drill.arrows = JSON.parse(drill.arrows || '[]');
      }
      return { ...step, drill: drill || null };
    });
    res.json({ success: true, data: { ...seq, steps: resolvedSteps } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/sequences', (req, res) => {
  try {
    const { name, description, steps } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ success: false, error: 'name is required' });
    const seq = db.createSequence({ name: name.trim(), description, steps });
    seq.steps = JSON.parse(seq.steps || '[]');
    res.status(201).json({ success: true, data: seq });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.put('/api/sequences/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, description, steps } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ success: false, error: 'name is required' });
    const seq = db.updateSequence(id, { name: name.trim(), description, steps });
    if (!seq) return res.status(404).json({ success: false, error: 'Sequence not found' });
    seq.steps = JSON.parse(seq.steps || '[]');
    res.json({ success: true, data: seq });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.delete('/api/sequences/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const ok = db.deleteSequence(id);
    if (!ok) return res.status(404).json({ success: false, error: 'Sequence not found' });
    res.json({ success: true, data: { id } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── API: Practice Sessions ────────────────────────────────────────────────────
function parseSession(s) {
  s.blocks = JSON.parse(s.blocks || '[]');
  return s;
}

app.get('/api/sessions', (req, res) => {
  try {
    res.json({ success: true, data: db.listSessions() });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.get('/api/sessions/:id', (req, res) => {
  try {
    const s = db.getSession(Number(req.params.id));
    if (!s) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: parseSession(s) });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/api/sessions', (req, res) => {
  try {
    const { name, team_age, focus, duration_mins, blocks, is_template, date, start_time, location, status } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ success: false, error: 'name is required' });
    const s = db.createSession({ name: name.trim(), team_age, focus, duration_mins, blocks, is_template, date, start_time, location, status });
    res.status(201).json({ success: true, data: parseSession(s) });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.put('/api/sessions/:id', (req, res) => {
  try {
    const { name, team_age, focus, duration_mins, blocks, is_template, date, start_time, location, status } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ success: false, error: 'name is required' });
    const s = db.updateSession(Number(req.params.id), { name: name.trim(), team_age, focus, duration_mins, blocks, is_template, date, start_time, location, status });
    if (!s) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: parseSession(s) });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.delete('/api/sessions/:id', (req, res) => {
  try {
    const ok = db.deleteSession(Number(req.params.id));
    if (!ok) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: { id: Number(req.params.id) } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Publish a session — generates share token
app.post('/api/sessions/:id/publish', (req, res) => {
  try {
    const id = Number(req.params.id);
    const s = db.getSession(id);
    if (!s) return res.status(404).json({ success: false, error: 'Not found' });
    const token = s.share_token || generateToken();
    const updated = db.publishSession(id, token);
    res.json({ success: true, data: parseSession(updated) });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Public share endpoint — no auth needed
app.get('/api/share/:token', (req, res) => {
  try {
    const s = db.getSessionByToken(req.params.token);
    if (!s) return res.status(404).json({ success: false, error: 'Session not found or not published' });
    parseSession(s);
    // Resolve drill details for each block so the player view can render them
    s.blocks = s.blocks.map(b => {
      if (b.type === 'drill') {
        const drill = db.getDrill(b.ref_id);
        if (drill) {
          b.drill = {
            name: drill.name,
            description: drill.description,
            category: drill.category,
            player_positions: JSON.parse(drill.player_positions || '[]'),
            arrows: JSON.parse(drill.arrows || '[]')
          };
        }
      }
      return b;
    });
    res.json({ success: true, data: s });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// .ics calendar export
app.get('/api/sessions/:id/ics', (req, res) => {
  try {
    const s = db.getSession(Number(req.params.id));
    if (!s) return res.status(404).json({ success: false, error: 'Not found' });
    const ics = buildICS(s);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="session-${s.id}.ics"`);
    res.send(ics);
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Session roster
app.get('/api/sessions/:id/roster', (req, res) => {
  try {
    res.json({ success: true, data: db.getSessionRoster(Number(req.params.id)) });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.put('/api/sessions/:id/roster', (req, res) => {
  try {
    const playerIds = req.body.player_ids || [];
    db.setSessionRoster(Number(req.params.id), playerIds);
    res.json({ success: true, data: db.getSessionRoster(Number(req.params.id)) });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ── API: Teams ────────────────────────────────────────────────────────────────
app.get('/api/teams', (req, res) => {
  try { res.json({ success: true, data: db.listTeams() }); }
  catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/api/teams', (req, res) => {
  try {
    const { name, age_group, season } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ success: false, error: 'name is required' });
    res.status(201).json({ success: true, data: db.createTeam({ name: name.trim(), age_group, season }) });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.put('/api/teams/:id', (req, res) => {
  try {
    const { name, age_group, season } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ success: false, error: 'name is required' });
    const t = db.updateTeam(Number(req.params.id), { name: name.trim(), age_group, season });
    if (!t) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: t });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.delete('/api/teams/:id', (req, res) => {
  try {
    const ok = db.deleteTeam(Number(req.params.id));
    if (!ok) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: { id: Number(req.params.id) } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ── API: Players ──────────────────────────────────────────────────────────────
app.get('/api/players', (req, res) => {
  try {
    const teamId = req.query.team_id ? Number(req.query.team_id) : null;
    res.json({ success: true, data: db.listPlayers(teamId) });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/api/players', (req, res) => {
  try {
    const { team_id, name, number, position } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ success: false, error: 'name is required' });
    if (!team_id) return res.status(400).json({ success: false, error: 'team_id is required' });
    res.status(201).json({ success: true, data: db.createPlayer({ team_id: Number(team_id), name: name.trim(), number, position }) });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.put('/api/players/:id', (req, res) => {
  try {
    const { name, number, position } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ success: false, error: 'name is required' });
    const p = db.updatePlayer(Number(req.params.id), { name: name.trim(), number, position });
    if (!p) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: p });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.delete('/api/players/:id', (req, res) => {
  try {
    const ok = db.deletePlayer(Number(req.params.id));
    if (!ok) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: { id: Number(req.params.id) } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ── API: Schedules ────────────────────────────────────────────────────────────
app.get('/api/schedules', (req, res) => {
  try {
    const rows = db.listSchedules().map(s => ({ ...s, entries: JSON.parse(s.entries || '[]') }));
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.get('/api/schedules/:id', (req, res) => {
  try {
    const s = db.getSchedule(Number(req.params.id));
    if (!s) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: { ...s, entries: JSON.parse(s.entries || '[]') } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/api/schedules', (req, res) => {
  try {
    const { name, week_start, entries } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ success: false, error: 'name is required' });
    const s = db.createSchedule({ name: name.trim(), week_start, entries });
    res.status(201).json({ success: true, data: { ...s, entries: JSON.parse(s.entries || '[]') } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.put('/api/schedules/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, week_start, entries } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ success: false, error: 'name is required' });
    const s = db.updateSchedule(id, { name: name.trim(), week_start, entries });
    if (!s) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: { ...s, entries: JSON.parse(s.entries || '[]') } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.delete('/api/schedules/:id', (req, res) => {
  try {
    const ok = db.deleteSchedule(Number(req.params.id));
    if (!ok) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: { id: Number(req.params.id) } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ── API: Bulk import ──────────────────────────────────────────────────────────
// POST /api/import/drills  — body: [{name,category,description}, ...]
app.post('/api/import/drills', (req, res) => {
  try {
    const rows = req.body;
    if (!Array.isArray(rows) || rows.length === 0)
      return res.status(400).json({ success: false, error: 'Expected array of drills' });
    const created = [];
    for (const row of rows) {
      if (!row.name || !row.name.trim()) continue;
      const drill = db.createDrill({
        name: row.name.trim(),
        description: row.description || '',
        category: VALID_CATEGORIES.includes(row.category) ? row.category : 'custom',
        player_positions: row.player_positions || [],
        arrows: row.arrows || [],
        is_preset: false
      });
      drill.player_positions = JSON.parse(drill.player_positions || '[]');
      drill.arrows = JSON.parse(drill.arrows || '[]');
      created.push(drill);
    }
    res.status(201).json({ success: true, data: created });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// POST /api/import/sequences — body: [{name, description, steps:[{drill_name,duration_seconds,transition_note}]}]
app.post('/api/import/sequences', (req, res) => {
  try {
    const rows = req.body;
    if (!Array.isArray(rows) || rows.length === 0)
      return res.status(400).json({ success: false, error: 'Expected array of sequences' });

    // Build a name→id lookup for drills
    const allDrills = db.listDrills();
    const drillByName = {};
    allDrills.forEach(d => { drillByName[d.name.toLowerCase()] = d.id; });

    const created = [];
    for (const row of rows) {
      if (!row.name || !row.name.trim()) continue;
      const steps = (row.steps || []).map(s => {
        const did = drillByName[(s.drill_name || '').toLowerCase()];
        return did ? { drill_id: did, duration_seconds: Number(s.duration_seconds) || 120, transition_note: s.transition_note || '' } : null;
      }).filter(Boolean);
      const seq = db.createSequence({ name: row.name.trim(), description: row.description || '', steps });
      seq.steps = JSON.parse(seq.steps || '[]');
      created.push(seq);
    }
    res.status(201).json({ success: true, data: created });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ── Player experience view ────────────────────────────────────────────────────
app.get('/session/:token', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'view.html'));
});

// ── SPA fallback ──────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`IceBoard running on port ${PORT}`);
});
