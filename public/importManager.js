/**
 * importManager.js — CSV upload for drills and sequences
 *
 * Drill CSV format:  Name, Category, Description
 * Sequence CSV format: SEQUENCE/STEP blocks
 *
 * Each imported drill gets a category-based default formation so it
 * loads with players and arrows already in place.
 */

// ── Category formations ───────────────────────────────────────────────────────
// Each category gets a default player layout + arrows.
// Coordinates are fractional (0–1). bx=left→right, by=top→bottom.

const CATEGORY_FORMATIONS = {

  warmup: {
    player_positions: [
      { id:'r1', team:'red',  role:'gk',     bx:0.04, by:0.50 },
      { id:'r2', team:'red',  role:'player',  bx:0.12, by:0.15 },
      { id:'r3', team:'red',  role:'player',  bx:0.12, by:0.85 },
      { id:'r4', team:'red',  role:'player',  bx:0.30, by:0.15 },
      { id:'r5', team:'red',  role:'player',  bx:0.30, by:0.85 },
      { id:'r6', team:'red',  role:'player',  bx:0.50, by:0.50 },
      { id:'b1', team:'blue', role:'gk',     bx:0.96, by:0.50 },
      { id:'b2', team:'blue', role:'player',  bx:0.88, by:0.15 },
      { id:'b3', team:'blue', role:'player',  bx:0.88, by:0.85 },
      { id:'b4', team:'blue', role:'player',  bx:0.70, by:0.15 },
      { id:'b5', team:'blue', role:'player',  bx:0.70, by:0.85 },
      { id:'b6', team:'blue', role:'player',  bx:0.50, by:0.30 },
    ],
    arrows: [
      { pid:'r2', tbx:0.04, tby:0.15 },
      { pid:'r3', tbx:0.30, tby:0.85 },
      { pid:'r4', tbx:0.50, tby:0.15 },
      { pid:'b2', tbx:0.96, tby:0.15 },
      { pid:'b3', tbx:0.70, tby:0.85 },
      { pid:'b4', tbx:0.50, tby:0.15 },
    ]
  },

  skating: {
    player_positions: [
      { id:'r1', team:'red',  role:'gk',     bx:0.04, by:0.50 },
      { id:'r2', team:'red',  role:'player',  bx:0.20, by:0.20 },
      { id:'r3', team:'red',  role:'player',  bx:0.20, by:0.80 },
      { id:'r4', team:'red',  role:'player',  bx:0.35, by:0.50 },
      { id:'r5', team:'red',  role:'player',  bx:0.50, by:0.20 },
      { id:'r6', team:'red',  role:'player',  bx:0.50, by:0.80 },
      { id:'b1', team:'blue', role:'gk',     bx:0.96, by:0.50 },
      { id:'b2', team:'blue', role:'player',  bx:0.80, by:0.20 },
      { id:'b3', team:'blue', role:'player',  bx:0.80, by:0.80 },
      { id:'b4', team:'blue', role:'player',  bx:0.65, by:0.50 },
      { id:'b5', team:'blue', role:'player',  bx:0.50, by:0.35 },
      { id:'b6', team:'blue', role:'player',  bx:0.50, by:0.65 },
    ],
    arrows: [
      { pid:'r2', tbx:0.35, tby:0.20 },
      { pid:'r3', tbx:0.35, tby:0.80 },
      { pid:'r4', tbx:0.50, tby:0.50 },
      { pid:'b2', tbx:0.65, tby:0.20 },
      { pid:'b3', tbx:0.65, tby:0.80 },
      { pid:'b4', tbx:0.50, tby:0.50 },
    ]
  },

  passing: {
    player_positions: [
      { id:'r1', team:'red',  role:'gk',     bx:0.04, by:0.50 },
      { id:'r2', team:'red',  role:'player',  bx:0.35, by:0.20 },
      { id:'r3', team:'red',  role:'player',  bx:0.35, by:0.40 },
      { id:'r4', team:'red',  role:'player',  bx:0.35, by:0.60 },
      { id:'r5', team:'red',  role:'player',  bx:0.35, by:0.80 },
      { id:'r6', team:'red',  role:'player',  bx:0.20, by:0.50 },
      { id:'b1', team:'blue', role:'gk',     bx:0.96, by:0.50 },
      { id:'b2', team:'blue', role:'player',  bx:0.65, by:0.20 },
      { id:'b3', team:'blue', role:'player',  bx:0.65, by:0.40 },
      { id:'b4', team:'blue', role:'player',  bx:0.65, by:0.60 },
      { id:'b5', team:'blue', role:'player',  bx:0.65, by:0.80 },
      { id:'b6', team:'blue', role:'player',  bx:0.80, by:0.50 },
    ],
    arrows: [
      { pid:'r2', tbx:0.65, tby:0.20 },
      { pid:'r3', tbx:0.65, tby:0.40 },
      { pid:'r4', tbx:0.65, tby:0.60 },
      { pid:'r5', tbx:0.65, tby:0.80 },
      { pid:'b2', tbx:0.35, tby:0.20 },
      { pid:'b3', tbx:0.35, tby:0.40 },
    ]
  },

  shooting: {
    player_positions: [
      { id:'r1', team:'red',  role:'gk',     bx:0.04, by:0.50 },
      { id:'r2', team:'red',  role:'player',  bx:0.60, by:0.25 },
      { id:'r3', team:'red',  role:'player',  bx:0.60, by:0.45 },
      { id:'r4', team:'red',  role:'player',  bx:0.60, by:0.65 },
      { id:'r5', team:'red',  role:'player',  bx:0.45, by:0.35 },
      { id:'r6', team:'red',  role:'player',  bx:0.45, by:0.65 },
      { id:'b1', team:'blue', role:'gk',     bx:0.96, by:0.50 },
      { id:'b2', team:'blue', role:'player',  bx:0.80, by:0.35 },
      { id:'b3', team:'blue', role:'player',  bx:0.80, by:0.65 },
      { id:'b4', team:'blue', role:'player',  bx:0.72, by:0.50 },
      { id:'b5', team:'blue', role:'player',  bx:0.50, by:0.30 },
      { id:'b6', team:'blue', role:'player',  bx:0.50, by:0.70 },
    ],
    arrows: [
      { pid:'r2', tbx:0.88, tby:0.30 },
      { pid:'r3', tbx:0.90, tby:0.50 },
      { pid:'r4', tbx:0.88, tby:0.70 },
      { pid:'r5', tbx:0.70, tby:0.30 },
      { pid:'r6', tbx:0.70, tby:0.70 },
    ]
  },

  defensive: {
    player_positions: [
      { id:'r1', team:'red',  role:'gk',     bx:0.04, by:0.50 },
      { id:'r2', team:'red',  role:'player',  bx:0.18, by:0.28 },
      { id:'r3', team:'red',  role:'player',  bx:0.18, by:0.72 },
      { id:'r4', team:'red',  role:'player',  bx:0.12, by:0.40 },
      { id:'r5', team:'red',  role:'player',  bx:0.12, by:0.60 },
      { id:'r6', team:'red',  role:'player',  bx:0.28, by:0.50 },
      { id:'b1', team:'blue', role:'gk',     bx:0.96, by:0.50 },
      { id:'b2', team:'blue', role:'player',  bx:0.35, by:0.25 },
      { id:'b3', team:'blue', role:'player',  bx:0.35, by:0.75 },
      { id:'b4', team:'blue', role:'player',  bx:0.28, by:0.38 },
      { id:'b5', team:'blue', role:'player',  bx:0.28, by:0.62 },
      { id:'b6', team:'blue', role:'player',  bx:0.42, by:0.50 },
    ],
    arrows: [
      { pid:'r2', tbx:0.22, tby:0.28 },
      { pid:'r3', tbx:0.22, tby:0.72 },
      { pid:'r4', tbx:0.18, tby:0.38 },
      { pid:'r5', tbx:0.18, tby:0.62 },
      { pid:'b2', tbx:0.28, tby:0.25 },
      { pid:'b3', tbx:0.28, tby:0.75 },
    ]
  },

  offensive: {
    player_positions: [
      { id:'r1', team:'red',  role:'gk',     bx:0.04, by:0.50 },
      { id:'r2', team:'red',  role:'player',  bx:0.65, by:0.18 },
      { id:'r3', team:'red',  role:'player',  bx:0.65, by:0.82 },
      { id:'r4', team:'red',  role:'player',  bx:0.58, by:0.38 },
      { id:'r5', team:'red',  role:'player',  bx:0.58, by:0.62 },
      { id:'r6', team:'red',  role:'player',  bx:0.55, by:0.50 },
      { id:'b1', team:'blue', role:'gk',     bx:0.96, by:0.50 },
      { id:'b2', team:'blue', role:'player',  bx:0.78, by:0.35 },
      { id:'b3', team:'blue', role:'player',  bx:0.78, by:0.65 },
      { id:'b4', team:'blue', role:'player',  bx:0.70, by:0.50 },
      { id:'b5', team:'blue', role:'player',  bx:0.85, by:0.40 },
      { id:'b6', team:'blue', role:'player',  bx:0.85, by:0.60 },
    ],
    arrows: [
      { pid:'r2', tbx:0.85, tby:0.22 },
      { pid:'r3', tbx:0.85, tby:0.78 },
      { pid:'r4', tbx:0.75, tby:0.38 },
      { pid:'r5', tbx:0.75, tby:0.62 },
      { pid:'r6', tbx:0.70, tby:0.50 },
    ]
  },

  conditioning: {
    player_positions: [
      { id:'r1', team:'red',  role:'gk',     bx:0.04, by:0.50 },
      { id:'r2', team:'red',  role:'player',  bx:0.08, by:0.15 },
      { id:'r3', team:'red',  role:'player',  bx:0.08, by:0.40 },
      { id:'r4', team:'red',  role:'player',  bx:0.08, by:0.65 },
      { id:'r5', team:'red',  role:'player',  bx:0.08, by:0.88 },
      { id:'r6', team:'red',  role:'player',  bx:0.50, by:0.50 },
      { id:'b1', team:'blue', role:'gk',     bx:0.96, by:0.50 },
      { id:'b2', team:'blue', role:'player',  bx:0.92, by:0.15 },
      { id:'b3', team:'blue', role:'player',  bx:0.92, by:0.40 },
      { id:'b4', team:'blue', role:'player',  bx:0.92, by:0.65 },
      { id:'b5', team:'blue', role:'player',  bx:0.92, by:0.88 },
      { id:'b6', team:'blue', role:'player',  bx:0.50, by:0.25 },
    ],
    arrows: [
      { pid:'r2', tbx:0.04, tby:0.12 },
      { pid:'r3', tbx:0.04, tby:0.88 },
      { pid:'r4', tbx:0.50, tby:0.90 },
      { pid:'r5', tbx:0.92, tby:0.88 },
      { pid:'b2', tbx:0.96, tby:0.12 },
      { pid:'b3', tbx:0.96, tby:0.88 },
    ]
  },

  custom: {
    player_positions: [
      { id:'r1', team:'red',  role:'gk',     bx:0.04, by:0.50 },
      { id:'r2', team:'red',  role:'player',  bx:0.15, by:0.25 },
      { id:'r3', team:'red',  role:'player',  bx:0.15, by:0.75 },
      { id:'r4', team:'red',  role:'player',  bx:0.25, by:0.35 },
      { id:'r5', team:'red',  role:'player',  bx:0.25, by:0.65 },
      { id:'r6', team:'red',  role:'player',  bx:0.20, by:0.50 },
      { id:'b1', team:'blue', role:'gk',     bx:0.96, by:0.50 },
      { id:'b2', team:'blue', role:'player',  bx:0.85, by:0.25 },
      { id:'b3', team:'blue', role:'player',  bx:0.85, by:0.75 },
      { id:'b4', team:'blue', role:'player',  bx:0.75, by:0.35 },
      { id:'b5', team:'blue', role:'player',  bx:0.75, by:0.65 },
      { id:'b6', team:'blue', role:'player',  bx:0.80, by:0.50 },
    ],
    arrows: []
  }
};

function getFormation(category) {
  return CATEGORY_FORMATIONS[category] || CATEGORY_FORMATIONS.custom;
}

const ImportManager = (() => {
  const modal      = document.getElementById('import-modal');
  const tabDrills  = document.getElementById('import-tab-drills');
  const tabSeqs    = document.getElementById('import-tab-seqs');
  const drillPane  = document.getElementById('import-drill-pane');
  const seqPane    = document.getElementById('import-seq-pane');
  const drillPreview = document.getElementById('import-drill-preview');
  const seqPreview   = document.getElementById('import-seq-preview');

  let parsedDrills = [];
  let parsedSeqs   = [];

  // ── Open / close ──────────────────────────────────────────────────────────
  function open(tab = 'drills') {
    parsedDrills = []; parsedSeqs = [];
    drillPreview.innerHTML = '';
    seqPreview.innerHTML   = '';
    document.getElementById('import-drill-file').value = '';
    document.getElementById('import-seq-file').value   = '';
    switchTab(tab);
    modal.classList.add('open');
  }

  function close() { modal.classList.remove('open'); }

  function switchTab(tab) {
    tabDrills.classList.toggle('active', tab === 'drills');
    tabSeqs.classList.toggle('active',   tab === 'seqs');
    drillPane.style.display = tab === 'drills' ? 'block' : 'none';
    seqPane.style.display   = tab === 'seqs'   ? 'block' : 'none';
  }

  // ── Template download ─────────────────────────────────────────────────────
  function downloadDrillTemplate() {
    const content = [
      '# IceBoard Drill Import Template',
      '# Fill in your drills below. Delete the example rows.',
      '# IMPORTANT: Category must be lowercase exactly as listed below — players and arrows are auto-assigned by category.',
      '# Category options: warmup, skating, passing, shooting, defensive, offensive, conditioning, custom',
      '#',
      'Name,Category,Description',
      'Warm-Up Laps,warmup,Players skate full ice laps incorporating forward backward and crossovers',
      'Dynamic Stretch Skate,warmup,Players perform dynamic stretching while skating to prepare muscles',
      'Edge Control Circles,skating,Players skate tight circles focusing on inside and outside edges',
      'Transition Skating Drill,skating,Quick transitions between forward and backward skating',
      'Crossover Acceleration,skating,Players accelerate using crossovers around cones',
      'Partner Passing,passing,Players pass back and forth focusing on accuracy and reception',
      'Triangle Passing,passing,Three players pass in a triangle formation while moving',
      'Breakout Passing,passing,Defencemen execute breakout passes under light pressure',
      'Wrist Shot Drill,shooting,Players practice wrist shots from various distances',
      'Slap Shot Accuracy,shooting,Focus on power and accuracy using slap shots',
      'Rebound Shooting,shooting,Players shoot and follow up on rebounds',
      '1v1 Gap Control,defensive,Defencemen maintain gap and angle attacker wide',
      'Shot Blocking Drill,defensive,Players practice positioning to block shots safely',
      'Defensive Zone Coverage,defensive,Team practices positioning in defensive zone',
      '2v1 Attack,offensive,Players practice decision making in odd-man rush',
      'Cycle Drill,offensive,Players cycle puck along boards maintaining possession',
      'Net Front Presence,offensive,Players screen goalie and look for deflections',
      'Suicide Skates,conditioning,High intensity stop-start skating drill',
      'Endurance Laps,conditioning,Continuous skating for stamina building',
      'Sprint Intervals,conditioning,Short bursts of maximum speed skating',
      'Power Play Setup,custom,Team practices puck movement in power play formation',
      'Penalty Kill Rotation,custom,Players practice penalty kill positioning and pressure',
      'Faceoff Plays,custom,Practice structured plays following faceoff wins',
    ].join('\n');
    triggerDownload(content, 'iceboard-drills-template.csv', 'text/csv');
  }

  function downloadSeqTemplate() {
    const content = [
      '# IceBoard Sequence Import Template',
      '# Format: SEQUENCE line followed by STEP lines.',
      '# Duration is in MINUTES. Drill Name must match an existing drill name exactly (case-sensitive).',
      '# Tip: import the Drill template first so all drill names exist before importing sequences.',
      '#',
      'SEQUENCE,Full Practice Session,Complete practice from warmup through to game situations',
      'STEP,Warm-Up Laps,3,Steady pace — get the legs going',
      'STEP,Dynamic Stretch Skate,2,',
      'STEP,Edge Control Circles,3,Focus on tight turns',
      'STEP,Partner Passing,4,Tape-to-tape only',
      'STEP,Wrist Shot Drill,4,Shoot off the pass',
      'STEP,2v1 Attack,5,Finish strong',
      '#',
      'SEQUENCE,Defensive Practice,Defensive zone structure and gap control',
      'STEP,Warm-Up Laps,2,',
      'STEP,1v1 Gap Control,5,Keep gap tight — no back-pedalling past the dots',
      'STEP,Shot Blocking Drill,4,Get in the shooting lanes',
      'STEP,Defensive Zone Coverage,6,Talk and communicate positions',
      'STEP,Penalty Kill Rotation,5,Diamond formation — stay tight',
      '#',
      'SEQUENCE,Game Day Warmup,Short pre-game activation — 15 minutes',
      'STEP,Warm-Up Laps,2,Easy pace',
      'STEP,Crossover Acceleration,2,Build speed gradually',
      'STEP,Breakout Passing,3,Clean breakouts only',
      'STEP,Wrist Shot Drill,3,Every player gets a shot on net',
      'STEP,2v1 Attack,3,Finish with pace — game ready',
    ].join('\n');
    triggerDownload(content, 'iceboard-sequences-template.csv', 'text/csv');
  }

  function triggerDownload(content, filename, type) {
    const blob = new Blob([content], { type });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  // ── Parse CSV ─────────────────────────────────────────────────────────────
  function parseCsvRow(line) {
    const result = [];
    let cur = '', inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuote = !inQuote;
      } else if (ch === ',' && !inQuote) {
        result.push(cur.trim()); cur = '';
      } else {
        cur += ch;
      }
    }
    result.push(cur.trim());
    return result;
  }

  function parseDrillCSV(text) {
    const lines = text.split(/\r?\n/);
    const drills = [];
    let headerFound = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const cols = parseCsvRow(trimmed);
      if (!headerFound && cols[0].toLowerCase() === 'name') { headerFound = true; continue; }
      if (!headerFound) continue; // skip until header
      const [name, category, description] = cols;
      if (!name) continue;
      const cat = (category || 'custom').toLowerCase().trim();
      const formation = getFormation(cat);
      drills.push({
        name,
        category: cat,
        description: description || '',
        player_positions: formation.player_positions,
        arrows: formation.arrows
      });
    }
    return drills;
  }

  function parseSequenceCSV(text) {
    const lines = text.split(/\r?\n/);
    const sequences = [];
    let current = null;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const cols = parseCsvRow(trimmed);
      const marker = (cols[0] || '').toUpperCase();
      if (marker === 'SEQUENCE') {
        if (current) sequences.push(current);
        current = { name: cols[1] || '', description: cols[2] || '', steps: [] };
      } else if (marker === 'STEP' && current) {
        const drillName = cols[1] || '';
        const durMins   = parseFloat(cols[2]) || 2;
        const note      = cols[3] || '';
        if (drillName) {
          current.steps.push({ drill_name: drillName, duration_seconds: Math.round(durMins * 60), transition_note: note });
        }
      }
    }
    if (current) sequences.push(current);
    return sequences.filter(s => s.name && s.steps.length > 0);
  }

  // ── Render previews ───────────────────────────────────────────────────────
  function renderDrillPreview(drills) {
    if (drills.length === 0) {
      drillPreview.innerHTML = '<div class="empty-state">No valid drills found in file. Check the format.</div>';
      return;
    }
    drillPreview.innerHTML = `
      <p class="import-count">${drills.length} drill${drills.length !== 1 ? 's' : ''} ready to import</p>
      <table class="import-table">
        <thead><tr><th>Name</th><th>Category</th><th>Layout</th><th>Description</th></tr></thead>
        <tbody>${drills.map(d => `
          <tr>
            <td>${esc(d.name)}</td>
            <td><span class="cat-badge">${esc(d.category)}</span></td>
            <td style="color:var(--green);font-size:0.75rem">✓ ${d.arrows.length} arrows</td>
            <td class="import-desc">${esc(d.description)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    `;
  }

  function renderSeqPreview(seqs) {
    if (seqs.length === 0) {
      seqPreview.innerHTML = '<div class="empty-state">No valid sequences found. Check the format and ensure drill names match existing drills.</div>';
      return;
    }
    seqPreview.innerHTML = `
      <p class="import-count">${seqs.length} sequence${seqs.length !== 1 ? 's' : ''} ready to import</p>
      ${seqs.map(s => `
        <div class="import-seq-block">
          <div class="import-seq-name">${esc(s.name)} <span class="seq-meta">${s.steps.length} steps</span></div>
          <ol class="import-seq-steps">${s.steps.map(st =>
            `<li><strong>${esc(st.drill_name)}</strong> — ${Math.round(st.duration_seconds / 60)} min${st.transition_note ? ` · <em>${esc(st.transition_note)}</em>` : ''}</li>`
          ).join('')}</ol>
        </div>`).join('')}
    `;
  }

  // ── Import to server ──────────────────────────────────────────────────────
  async function importDrills() {
    if (parsedDrills.length === 0) { showToast('No drills to import', 'error'); return; }
    try {
      const res  = await fetch('/api/import/drills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsedDrills)
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      close();
      await DrillManager.loadDrills();
      showToast(`Imported ${json.data.length} drill${json.data.length !== 1 ? 's' : ''}!`, 'success');
    } catch (e) {
      showToast('Import failed: ' + e.message, 'error');
    }
  }

  async function importSequences() {
    if (parsedSeqs.length === 0) { showToast('No sequences to import', 'error'); return; }
    try {
      const res  = await fetch('/api/import/sequences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsedSeqs)
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      close();
      await DrillManager.loadSequences();
      showToast(`Imported ${json.data.length} sequence${json.data.length !== 1 ? 's' : ''}!`, 'success');
    } catch (e) {
      showToast('Import failed: ' + e.message, 'error');
    }
  }

  // ── Bind events ───────────────────────────────────────────────────────────
  function init() {
    document.getElementById('open-import-btn').addEventListener('click', () => open('drills'));
    document.getElementById('import-modal-close').addEventListener('click', close);
    modal.addEventListener('click', e => { if (e.target === modal) close(); });

    tabDrills.addEventListener('click', () => switchTab('drills'));
    tabSeqs.addEventListener('click',   () => switchTab('seqs'));

    document.getElementById('dl-drill-template').addEventListener('click', downloadDrillTemplate);
    document.getElementById('dl-seq-template').addEventListener('click',   downloadSeqTemplate);

    document.getElementById('import-drill-file').addEventListener('change', e => {
      const file = e.target.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        parsedDrills = parseDrillCSV(ev.target.result);
        renderDrillPreview(parsedDrills);
      };
      reader.readAsText(file);
    });

    document.getElementById('import-seq-file').addEventListener('change', e => {
      const file = e.target.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        parsedSeqs = parseSequenceCSV(ev.target.result);
        renderSeqPreview(parsedSeqs);
      };
      reader.readAsText(file);
    });

    document.getElementById('confirm-import-drills').addEventListener('click', importDrills);
    document.getElementById('confirm-import-seqs').addEventListener('click',   importSequences);
  }

  return { init, open };
})();
