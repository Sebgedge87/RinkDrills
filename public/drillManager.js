/**
 * drillManager.js — Drill & Sequence CRUD, sidebar UI
 */

const DrillManager = (() => {
  let allDrills = [];
  let allSequences = [];
  let activeDrillId = null;

  const CATEGORIES = ['warmup','skating','passing','shooting','defensive','offensive','conditioning','custom'];
  const CAT_COLORS = {
    warmup: '#ff9800', skating: '#2196f3', passing: '#4caf50',
    shooting: '#f44336', defensive: '#9c27b0', offensive: '#e91e63',
    conditioning: '#ff5722', custom: '#607d8b'
  };

  // ── DOM refs ───────────────────────────────────────────────────────────────
  const drillSearch   = document.getElementById('drill-search');
  const drillCatFilter = document.getElementById('drill-cat-filter');
  const drillList     = document.getElementById('drill-list');
  const seqSearch     = document.getElementById('seq-search');
  const seqList       = document.getElementById('seq-list');

  const drillModal    = document.getElementById('drill-modal');
  const drillForm     = document.getElementById('drill-form');
  const drillModalTitle = document.getElementById('drill-modal-title');
  const drillNameInput  = document.getElementById('drill-name');
  const drillDescInput  = document.getElementById('drill-desc');
  const drillCatInput   = document.getElementById('drill-cat');
  const drillSaveBtn    = document.getElementById('drill-save-btn');

  const seqModal      = document.getElementById('seq-modal');
  const seqNameInput  = document.getElementById('seq-name');
  const seqDescInput  = document.getElementById('seq-desc');
  const seqDrillSearch = document.getElementById('seq-drill-search');
  const seqAvailList  = document.getElementById('seq-available-drills');
  const seqStepsList  = document.getElementById('seq-steps-list');
  const seqSaveBtn    = document.getElementById('seq-save-btn');

  let editingDrillId  = null;
  let editingSeqId    = null;
  let seqSteps        = []; // [{drill_id, drill_name, duration_seconds, transition_note}]

  // ── Init ───────────────────────────────────────────────────────────────────
  async function init() {
    await loadDrills();
    await loadSequences();
    bindEvents();
  }

  async function loadDrills() {
    try {
      const res = await fetch('/api/drills');
      const json = await res.json();
      if (json.success) {
        allDrills = json.data;
        renderDrillList();
      }
    } catch (e) {
      showToast('Failed to load drills', 'error');
    }
  }

  async function loadSequences() {
    try {
      const res = await fetch('/api/sequences');
      const json = await res.json();
      if (json.success) {
        allSequences = json.data;
        renderSeqList();
      }
    } catch (e) {
      showToast('Failed to load sequences', 'error');
    }
  }

  // ── Render drill list ──────────────────────────────────────────────────────
  function renderDrillList() {
    const query = (drillSearch.value || '').toLowerCase();
    const cat   = drillCatFilter.value;

    const filtered = allDrills.filter(d => {
      const matchName = d.name.toLowerCase().includes(query);
      const matchCat  = !cat || d.category === cat;
      return matchName && matchCat;
    });

    if (filtered.length === 0) {
      drillList.innerHTML = '<div class="empty-state">No drills found</div>';
      return;
    }

    drillList.innerHTML = '';
    filtered.forEach(d => {
      const el = document.createElement('div');
      el.className = 'drill-item' + (d.id === activeDrillId ? ' active' : '');
      el.dataset.id = d.id;

      const catColor = CAT_COLORS[d.category] || '#607d8b';
      el.innerHTML = `
        <span class="drill-name" title="${esc(d.name)}">${esc(d.name)}</span>
        <span class="cat-badge" style="border-color:${catColor};color:${catColor}">${esc(d.category)}</span>
        ${d.is_preset ? '<span class="preset-icon" title="Preset — cannot be edited">🔒</span>' : ''}
        <div class="item-actions">
          <button class="icon-btn edit-drill-btn" data-id="${d.id}" ${d.is_preset ? 'disabled title="Cannot edit preset"' : ''}>✏️</button>
          <button class="icon-btn danger delete-drill-btn" data-id="${d.id}" ${d.is_preset ? 'disabled title="Cannot delete preset"' : ''}>🗑️</button>
        </div>
      `;

      el.querySelector('.drill-name').addEventListener('click', () => loadDrillOntoCanvas(d.id));
      el.querySelector('.cat-badge').addEventListener('click', () => loadDrillOntoCanvas(d.id));

      const editBtn = el.querySelector('.edit-drill-btn');
      if (!d.is_preset) {
        editBtn.addEventListener('click', (ev) => { ev.stopPropagation(); openDrillModal(d.id); });
      }

      const delBtn = el.querySelector('.delete-drill-btn');
      if (!d.is_preset) {
        delBtn.addEventListener('click', (ev) => { ev.stopPropagation(); deleteDrill(d.id); });
      }

      drillList.appendChild(el);
    });
  }

  // ── Render sequence list ───────────────────────────────────────────────────
  function renderSeqList() {
    const query = (seqSearch.value || '').toLowerCase();
    const filtered = allSequences.filter(s => s.name.toLowerCase().includes(query));

    if (filtered.length === 0) {
      seqList.innerHTML = '<div class="empty-state">No sequences found</div>';
      return;
    }

    seqList.innerHTML = '';
    filtered.forEach(s => {
      const steps = Array.isArray(s.steps) ? s.steps : [];
      const el = document.createElement('div');
      el.className = 'seq-item';
      el.innerHTML = `
        <div style="flex:1;min-width:0">
          <div class="seq-name">${esc(s.name)}</div>
          <div class="seq-meta">${steps.length} drill${steps.length !== 1 ? 's' : ''}</div>
        </div>
        <div class="item-actions">
          <button class="icon-btn play-seq-btn" data-id="${s.id}" title="Play Sequence">▶️</button>
          <button class="icon-btn edit-seq-btn" data-id="${s.id}" title="Edit">✏️</button>
          <button class="icon-btn danger delete-seq-btn" data-id="${s.id}" title="Delete">🗑️</button>
        </div>
      `;

      el.querySelector('.play-seq-btn').addEventListener('click', (ev) => {
        ev.stopPropagation();
        SequencePlayer.play(s.id);
      });
      el.querySelector('.edit-seq-btn').addEventListener('click', (ev) => {
        ev.stopPropagation();
        openSeqModal(s.id);
      });
      el.querySelector('.delete-seq-btn').addEventListener('click', (ev) => {
        ev.stopPropagation();
        deleteSequence(s.id);
      });

      seqList.appendChild(el);
    });
  }

  // ── Load drill onto canvas ─────────────────────────────────────────────────
  async function loadDrillOntoCanvas(id) {
    try {
      const res = await fetch(`/api/drills/${id}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      activeDrillId = id;
      renderDrillList();
      App.loadDrill(json.data);
    } catch (e) {
      showToast('Failed to load drill: ' + e.message, 'error');
    }
  }

  // ── Drill modal ────────────────────────────────────────────────────────────
  function openDrillModal(drillId) {
    editingDrillId = drillId || null;
    drillModalTitle.textContent = drillId ? 'Edit Drill' : 'Save Drill';

    if (drillId) {
      const d = allDrills.find(x => x.id === drillId);
      if (d) {
        drillNameInput.value = d.name;
        drillDescInput.value = d.description || '';
        drillCatInput.value  = d.category || 'custom';
      }
    } else {
      drillNameInput.value = '';
      drillDescInput.value = '';
      drillCatInput.value  = 'custom';
    }
    drillModal.classList.add('open');
    drillNameInput.focus();
  }

  function closeDrillModal() {
    drillModal.classList.remove('open');
    editingDrillId = null;
  }

  async function saveDrill() {
    const name = drillNameInput.value.trim();
    if (!name) { showToast('Name is required', 'error'); return; }

    const state = App.getState();
    const body = {
      name,
      description: drillDescInput.value.trim(),
      category: drillCatInput.value,
      player_positions: state.players,
      arrows: state.arrows
    };

    try {
      let res;
      if (editingDrillId) {
        res = await fetch(`/api/drills/${editingDrillId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
      } else {
        res = await fetch('/api/drills', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
      }
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      closeDrillModal();
      await loadDrills();
      activeDrillId = json.data.id;
      renderDrillList();
      showToast(editingDrillId ? 'Drill updated!' : 'Drill saved!', 'success');
    } catch (e) {
      showToast('Save failed: ' + e.message, 'error');
    }
  }

  async function deleteDrill(id) {
    if (!confirm('Delete this drill?')) return;
    try {
      const res = await fetch(`/api/drills/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      if (activeDrillId === id) activeDrillId = null;
      await loadDrills();
      showToast('Drill deleted', 'success');
    } catch (e) {
      showToast('Delete failed: ' + e.message, 'error');
    }
  }

  // ── Sequence modal ─────────────────────────────────────────────────────────
  async function openSeqModal(seqId) {
    editingSeqId = seqId || null;
    seqSteps = [];

    if (seqId) {
      const s = allSequences.find(x => x.id === seqId);
      if (s) {
        seqNameInput.value = s.name;
        seqDescInput.value = s.description || '';
        const steps = Array.isArray(s.steps) ? s.steps : [];
        seqSteps = steps.map(step => ({
          drill_id: step.drill_id,
          drill_name: getDrillName(step.drill_id),
          duration_seconds: step.duration_seconds || 120,
          transition_note: step.transition_note || ''
        }));
      }
    } else {
      seqNameInput.value = '';
      seqDescInput.value = '';
    }

    renderSeqAvailDrills();
    renderSeqSteps();
    seqModal.classList.add('open');
    seqNameInput.focus();
  }

  function closeSeqModal() {
    seqModal.classList.remove('open');
    editingSeqId = null;
    seqSteps = [];
  }

  function getDrillName(drillId) {
    const d = allDrills.find(x => x.id === drillId);
    return d ? d.name : `Drill #${drillId}`;
  }

  function renderSeqAvailDrills() {
    const query = (seqDrillSearch.value || '').toLowerCase();
    const filtered = allDrills.filter(d => d.name.toLowerCase().includes(query));
    seqAvailList.innerHTML = '';
    filtered.forEach(d => {
      const el = document.createElement('div');
      el.className = 'avail-drill-item';
      const catColor = CAT_COLORS[d.category] || '#607d8b';
      el.innerHTML = `
        <span style="flex:1">${esc(d.name)}</span>
        <span class="cat-badge" style="border-color:${catColor};color:${catColor}">${esc(d.category)}</span>
      `;
      el.addEventListener('click', () => addStepToDrill(d));
      seqAvailList.appendChild(el);
    });
    if (filtered.length === 0) {
      seqAvailList.innerHTML = '<div class="empty-state">No drills</div>';
    }
  }

  function addStepToDrill(drill) {
    seqSteps.push({
      drill_id: drill.id,
      drill_name: drill.name,
      duration_seconds: 120,
      transition_note: ''
    });
    renderSeqSteps();
  }

  function renderSeqSteps() {
    seqStepsList.innerHTML = '';
    if (seqSteps.length === 0) {
      seqStepsList.innerHTML = '<div class="empty-state">Add drills from the list above</div>';
      return;
    }
    seqSteps.forEach((step, i) => {
      const el = document.createElement('div');
      el.className = 'step-item';
      el.draggable = true;
      el.dataset.idx = i;
      el.innerHTML = `
        <span class="step-drag-handle" title="Drag to reorder">⠿</span>
        <span class="step-drill-name">${esc(step.drill_name)}</span>
        <input type="number" class="step-duration" value="${step.duration_seconds}" min="10" max="3600" title="Duration (sec)">
        <input type="text" class="step-note" value="${esc(step.transition_note)}" placeholder="Transition note…">
        <button class="step-remove" title="Remove">✕</button>
      `;

      el.querySelector('.step-duration').addEventListener('change', (ev) => {
        seqSteps[i].duration_seconds = parseInt(ev.target.value) || 120;
      });
      el.querySelector('.step-note').addEventListener('input', (ev) => {
        seqSteps[i].transition_note = ev.target.value;
      });
      el.querySelector('.step-remove').addEventListener('click', () => {
        seqSteps.splice(i, 1);
        renderSeqSteps();
      });

      // Drag & drop reorder
      el.addEventListener('dragstart', (ev) => {
        ev.dataTransfer.setData('text/plain', i);
        el.style.opacity = '0.5';
      });
      el.addEventListener('dragend', () => { el.style.opacity = '1'; });
      el.addEventListener('dragover', (ev) => { ev.preventDefault(); el.style.background = 'var(--surface2)'; });
      el.addEventListener('dragleave', () => { el.style.background = ''; });
      el.addEventListener('drop', (ev) => {
        ev.preventDefault();
        el.style.background = '';
        const from = parseInt(ev.dataTransfer.getData('text/plain'));
        const to = i;
        if (from !== to) {
          const moved = seqSteps.splice(from, 1)[0];
          seqSteps.splice(to, 0, moved);
          renderSeqSteps();
        }
      });

      seqStepsList.appendChild(el);
    });
  }

  async function saveSequence() {
    const name = seqNameInput.value.trim();
    if (!name) { showToast('Name is required', 'error'); return; }
    if (seqSteps.length === 0) { showToast('Add at least one drill step', 'error'); return; }

    const body = {
      name,
      description: seqDescInput.value.trim(),
      steps: seqSteps.map(s => ({
        drill_id: s.drill_id,
        duration_seconds: s.duration_seconds || 120,
        transition_note: s.transition_note || ''
      }))
    };

    try {
      let res;
      if (editingSeqId) {
        res = await fetch(`/api/sequences/${editingSeqId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
      } else {
        res = await fetch('/api/sequences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
      }
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      closeSeqModal();
      await loadSequences();
      showToast(editingSeqId ? 'Sequence updated!' : 'Sequence saved!', 'success');
    } catch (e) {
      showToast('Save failed: ' + e.message, 'error');
    }
  }

  async function deleteSequence(id) {
    if (!confirm('Delete this sequence?')) return;
    try {
      const res = await fetch(`/api/sequences/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      await loadSequences();
      showToast('Sequence deleted', 'success');
    } catch (e) {
      showToast('Delete failed: ' + e.message, 'error');
    }
  }

  // ── Bind events ────────────────────────────────────────────────────────────
  function bindEvents() {
    drillSearch.addEventListener('input', renderDrillList);
    drillCatFilter.addEventListener('change', renderDrillList);
    seqSearch.addEventListener('input', renderSeqList);

    // Drill modal
    document.getElementById('save-drill-btn').addEventListener('click', () => openDrillModal(null));
    document.getElementById('drill-modal-close').addEventListener('click', closeDrillModal);
    document.getElementById('drill-cancel-btn').addEventListener('click', closeDrillModal);
    drillSaveBtn.addEventListener('click', saveDrill);
    drillModal.addEventListener('click', (ev) => { if (ev.target === drillModal) closeDrillModal(); });

    // Sequence modal
    document.getElementById('new-seq-btn').addEventListener('click', () => openSeqModal(null));
    document.getElementById('seq-modal-close').addEventListener('click', closeSeqModal);
    document.getElementById('seq-cancel-btn').addEventListener('click', closeSeqModal);
    seqSaveBtn.addEventListener('click', saveSequence);
    seqModal.addEventListener('click', (ev) => { if (ev.target === seqModal) closeSeqModal(); });
    seqDrillSearch.addEventListener('input', renderSeqAvailDrills);

    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.tab;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`tab-${target}`).classList.add('active');
      });
    });

    // Sidebar toggle
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    sidebarToggle.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      sidebarToggle.style.left = sidebar.classList.contains('collapsed') ? '0' : 'var(--sidebar-w)';
      sidebarToggle.textContent = sidebar.classList.contains('collapsed') ? '›' : '‹';
    });

    // Mobile hamburger
    const hamburger = document.getElementById('hamburger-btn');
    hamburger.addEventListener('click', () => {
      sidebar.classList.toggle('mobile-open');
    });
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  function getOpenSaveDrillModal() { openDrillModal(null); }

  return { init, loadDrills, loadSequences, getOpenSaveDrillModal, openDrillModal };
})();
