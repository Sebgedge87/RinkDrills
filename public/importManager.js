/**
 * importManager.js — CSV upload for drills and sequences
 *
 * Drill CSV format (coaches fill this in Excel/Google Sheets):
 *   Name,Category,Description
 *   Cone Weave,skating,Players weave through cones at full speed
 *
 * Sequence CSV format:
 *   SEQUENCE,My Sequence,Optional description
 *   STEP,Drill Name,3,Transition note
 *   STEP,Another Drill,2,
 *   SEQUENCE,Second Sequence,
 *   STEP,Horseshoe,4,Get water break
 */

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
      '# Category options: warmup, skating, passing, shooting, defensive, offensive, conditioning, custom',
      '#',
      'Name,Category,Description',
      'Cone Weave,skating,Players weave through cones at full speed focusing on edge work',
      'One-Timer Practice,shooting,Develop one-timer release and accuracy from the circle',
      'Neutral Zone Regroup,passing,Forwards regroup through neutral zone before attacking',
    ].join('\n');
    triggerDownload(content, 'iceboard-drills-template.csv', 'text/csv');
  }

  function downloadSeqTemplate() {
    const content = [
      '# IceBoard Sequence Import Template',
      '# Fill in your sequences below. Delete the example rows.',
      '# Format: SEQUENCE line followed by STEP lines.',
      '# Duration is in MINUTES. Drill Name must match an existing drill exactly.',
      '#',
      'SEQUENCE,Tuesday Morning Practice,Full warmup into skills work',
      'STEP,Horseshoe,3,Get water after this',
      'STEP,Figure-8,2,Focus on crossovers',
      'STEP,Breakout,4,',
      '#',
      'SEQUENCE,Game Day Warmup,Short pre-game activation',
      'STEP,Horseshoe,2,',
      'STEP,3-on-2 Rush,3,Last drill — finish strong',
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
      drills.push({ name, category: category || 'custom', description: description || '' });
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
        <thead><tr><th>Name</th><th>Category</th><th>Description</th></tr></thead>
        <tbody>${drills.map(d => `
          <tr>
            <td>${esc(d.name)}</td>
            <td><span class="cat-badge">${esc(d.category)}</span></td>
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
