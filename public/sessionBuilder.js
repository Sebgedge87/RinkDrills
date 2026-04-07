/**
 * sessionBuilder.js — Practice Builder
 * Timeline view with zones, drag-and-drop blocks, auto time distribution,
 * date/time/location scheduling, publish + share link generation
 */

const SessionBuilder = (() => {

  const ZONES = [
    { id: 'warmup',         label: 'Warmup',        color: '#ff9800' },
    { id: 'skills',         label: 'Skills',         color: '#2196f3' },
    { id: 'game_situation', label: 'Game Situation', color: '#9c27b0' },
    { id: 'conditioning',   label: 'Conditioning',   color: '#f44336' },
    { id: 'cooldown',       label: 'Cooldown',       color: '#4caf50' },
  ];

  let sessions     = [];
  let editingId    = null;
  let blocks       = [];
  let activePicker = null;
  let dragSrcIdx   = null;

  // ── DOM ───────────────────────────────────────────────────────────────────
  const modal         = document.getElementById('session-modal');
  const sessionList   = document.getElementById('session-list');
  const nameInput     = document.getElementById('session-name');
  const teamInput     = document.getElementById('session-team');
  const focusInput    = document.getElementById('session-focus');
  const durInput      = document.getElementById('session-duration');
  const dateInput     = document.getElementById('session-date');
  const timeInput     = document.getElementById('session-time');
  const locationInput = document.getElementById('session-location');
  const statusSelect  = document.getElementById('session-status');
  const timelineBar   = document.getElementById('session-timeline-bar');
  const timelineStats = document.getElementById('session-timeline-stats');
  const zonesEl       = document.getElementById('session-zones-list');
  const shareBanner   = document.getElementById('session-share-banner');
  const shareLink     = document.getElementById('session-share-link');

  // ── Init ──────────────────────────────────────────────────────────────────
  async function init() {
    await load();
    bindEvents();
  }

  async function load() {
    try {
      const res  = await fetch('/api/sessions');
      const json = await res.json();
      if (json.success) { sessions = json.data; renderList(); }
    } catch (e) { showToast('Failed to load sessions', 'error'); }
  }

  // ── Sidebar list ──────────────────────────────────────────────────────────
  function renderList() {
    if (sessions.length === 0) {
      sessionList.innerHTML = '<div class="empty-state">No sessions yet</div>';
      return;
    }
    sessionList.innerHTML = '';
    sessions.forEach(s => {
      const el = document.createElement('div');
      el.className = 'seq-item';
      const statusDot = `<span class="status-dot status-${s.status || 'draft'}" title="${s.status || 'draft'}"></span>`;
      el.innerHTML = `
        <div class="seq-item-body" style="flex:1;min-width:0">
          <div class="seq-name">${statusDot}${esc(s.name)}</div>
          <div class="seq-meta">
            ${s.date ? esc(s.date) + ' ' : ''}${s.start_time ? esc(s.start_time) + ' · ' : ''}${s.duration_mins} min
            ${s.team_age ? ' · ' + esc(s.team_age) : ''}
            ${s.is_template ? ' · <span style="color:var(--accent)">template</span>' : ''}
          </div>
        </div>
        <div class="item-actions">
          ${s.share_token ? `<button class="icon-btn share-copy-btn" title="Copy share link" data-token="${s.share_token}">🔗</button>` : ''}
          <button class="icon-btn ics-btn" title="Download .ics calendar file" data-id="${s.id}">📅</button>
          <button class="icon-btn" title="Open in Builder" data-id="${s.id}">✏</button>
          <button class="icon-btn danger del-session-btn" title="Delete" data-id="${s.id}">✕</button>
        </div>
      `;
      el.querySelector('.icon-btn:not(.del-session-btn):not(.ics-btn):not(.share-copy-btn)')
        .addEventListener('click', e => { e.stopPropagation(); openModal(s.id); });
      el.querySelector('.del-session-btn')
        .addEventListener('click', e => { e.stopPropagation(); deleteSession(s.id); });
      el.querySelector('.ics-btn')
        .addEventListener('click', e => { e.stopPropagation(); downloadICS(s.id); });
      const copyBtn = el.querySelector('.share-copy-btn');
      if (copyBtn) copyBtn.addEventListener('click', e => { e.stopPropagation(); copyShareLink(s.share_token); });
      sessionList.appendChild(el);
    });
  }

  // ── Open / close modal ────────────────────────────────────────────────────
  function openModal(sessionId) {
    editingId    = sessionId || null;
    activePicker = null;
    shareBanner.style.display = 'none';

    if (sessionId) {
      const s = sessions.find(x => x.id === sessionId);
      if (s) {
        nameInput.value     = s.name;
        teamInput.value     = s.team_age || '';
        focusInput.value    = s.focus || '';
        durInput.value      = s.duration_mins || 60;
        dateInput.value     = s.date || '';
        timeInput.value     = s.start_time || '';
        locationInput.value = s.location || '';
        statusSelect.value  = s.status || 'draft';
        blocks = (Array.isArray(s.blocks) ? s.blocks : []).map(b => ({ ...b }));
        if (s.share_token) showShareBanner(s.share_token);
      }
    } else {
      nameInput.value     = '';
      teamInput.value     = '';
      focusInput.value    = '';
      durInput.value      = 60;
      dateInput.value     = '';
      timeInput.value     = '';
      locationInput.value = '';
      statusSelect.value  = 'draft';
      blocks = [];
    }

    renderZones();
    renderTimeline();
    modal.classList.add('open');
    nameInput.focus();
  }

  function closeModal() {
    modal.classList.remove('open');
    editingId = null;
    blocks    = [];
    activePicker = null;
  }

  function showShareBanner(token) {
    const url = `${location.origin}/session/${token}`;
    shareLink.value = url;
    shareBanner.style.display = 'flex';
  }

  // ── Timeline bar ──────────────────────────────────────────────────────────
  function renderTimeline() {
    const totalMins = parseInt(durInput.value) || 60;
    const usedMins  = blocks.reduce((s, b) => s + (parseInt(b.duration_mins) || 0), 0);
    const remaining = totalMins - usedMins;

    const zoneMins = {};
    ZONES.forEach(z => { zoneMins[z.id] = 0; });
    blocks.forEach(b => { zoneMins[b.zone] = (zoneMins[b.zone] || 0) + (parseInt(b.duration_mins) || 0); });

    timelineBar.innerHTML = '';
    ZONES.forEach(z => {
      if (!zoneMins[z.id]) return;
      const pct = (zoneMins[z.id] / totalMins) * 100;
      const seg = document.createElement('div');
      seg.className = 'timeline-segment';
      seg.style.cssText = `width:${pct}%;background:${z.color}`;
      seg.title = `${z.label}: ${zoneMins[z.id]} min`;
      seg.innerHTML = `<span>${z.label.split(' ')[0]} ${zoneMins[z.id]}m</span>`;
      timelineBar.appendChild(seg);
    });

    if (remaining > 0) {
      const pct = (remaining / totalMins) * 100;
      const seg = document.createElement('div');
      seg.className = 'timeline-segment timeline-remaining';
      seg.style.width = pct + '%';
      seg.innerHTML = `<span>${remaining}m free</span>`;
      timelineBar.appendChild(seg);
    }

    const overClass = remaining < 0 ? 'style="color:var(--danger)"' : '';
    timelineStats.innerHTML = `
      <span><strong>${totalMins}</strong> min session</span>
      <span style="color:var(--text-dim)">·</span>
      <span><strong>${usedMins}</strong> min planned</span>
      <span style="color:var(--text-dim)">·</span>
      <span ${overClass}><strong>${Math.abs(remaining)}</strong> min ${remaining >= 0 ? 'free' : 'over'}</span>
    `;
  }

  // ── Zone sections ─────────────────────────────────────────────────────────
  function renderZones() {
    zonesEl.innerHTML = '';
    ZONES.forEach(zone => {
      const zoneBlocks = blocks.filter(b => b.zone === zone.id);
      const zoneMins   = zoneBlocks.reduce((s, b) => s + (parseInt(b.duration_mins) || 0), 0);

      const section = document.createElement('div');
      section.className = 'zone-section';
      section.dataset.zone = zone.id;

      section.innerHTML = `
        <div class="zone-header" style="border-left-color:${zone.color}">
          <span class="zone-dot" style="background:${zone.color}"></span>
          <span class="zone-label">${zone.label}</span>
          <span class="zone-mins">${zoneMins ? zoneMins + ' min' : 'empty'}</span>
          <button class="zone-add-btn" data-zone="${zone.id}">＋ Add</button>
        </div>
        <div class="zone-blocks" id="zone-blocks-${zone.id}">
          ${zoneBlocks.length === 0 ? '<div class="zone-empty">Click ＋ Add to add a drill or sequence</div>' : ''}
        </div>
        <div class="zone-picker" id="zone-picker-${zone.id}" style="display:none"></div>
      `;

      const blocksEl = section.querySelector(`#zone-blocks-${zone.id}`);
      zoneBlocks.forEach(block => {
        const globalIdx = blocks.indexOf(block);
        blocksEl.appendChild(buildBlockCard(block, globalIdx, zone.color));
      });

      section.querySelector('.zone-add-btn').addEventListener('click', e => {
        e.stopPropagation();
        togglePicker(zone.id, section.querySelector(`#zone-picker-${zone.id}`));
      });

      zonesEl.appendChild(section);
    });
  }

  // ── Block card ────────────────────────────────────────────────────────────
  function buildBlockCard(block, idx, zoneColor) {
    const card = document.createElement('div');
    card.className = 'block-card';
    card.draggable = true;
    card.dataset.idx = idx;
    card.style.borderTopColor = zoneColor;

    const typeIcon = block.type === 'sequence' ? '📋' : '🏒';
    card.innerHTML = `
      <div class="block-card-header">
        <span class="block-drag-handle" title="Drag to reorder">⠿</span>
        <span class="block-type-icon">${typeIcon}</span>
        <span class="block-name" title="${esc(block.ref_name)}">${esc(block.ref_name)}</span>
        <button class="block-remove" data-idx="${idx}" title="Remove">✕</button>
      </div>
      <div class="block-card-body">
        <label class="block-dur-label">
          <input type="number" class="block-dur-input" value="${block.duration_mins || 5}" min="1" max="120" data-idx="${idx}">
          <span>min</span>
        </label>
        <input type="text" class="block-notes-input" value="${esc(block.notes || '')}" placeholder="Coach note…" data-idx="${idx}">
      </div>
    `;

    card.querySelector('.block-dur-input').addEventListener('change', e => {
      blocks[idx].duration_mins = parseInt(e.target.value) || 5;
      renderTimeline();
      refreshZoneMins();
    });
    card.querySelector('.block-notes-input').addEventListener('input', e => {
      blocks[idx].notes = e.target.value;
    });
    card.querySelector('.block-remove').addEventListener('click', e => {
      e.stopPropagation();
      blocks.splice(idx, 1);
      renderZones();
      renderTimeline();
    });

    card.addEventListener('dragstart', e => {
      dragSrcIdx = idx;
      card.style.opacity = '0.4';
      e.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragend', () => { card.style.opacity = '1'; });
    card.addEventListener('dragover', e => { e.preventDefault(); card.classList.add('drag-over'); });
    card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
    card.addEventListener('drop', e => {
      e.preventDefault();
      card.classList.remove('drag-over');
      if (dragSrcIdx === null || dragSrcIdx === idx) return;
      const moved = blocks.splice(dragSrcIdx, 1)[0];
      blocks.splice(dragSrcIdx < idx ? idx - 1 : idx, 0, moved);
      dragSrcIdx = null;
      renderZones();
      renderTimeline();
    });

    return card;
  }

  // ── Picker ────────────────────────────────────────────────────────────────
  function togglePicker(zoneId, pickerEl) {
    document.querySelectorAll('.zone-picker').forEach(p => {
      if (p.id !== `zone-picker-${zoneId}`) p.style.display = 'none';
    });
    if (activePicker === zoneId) { pickerEl.style.display = 'none'; activePicker = null; return; }
    activePicker = zoneId;
    renderPicker(zoneId, pickerEl);
    pickerEl.style.display = 'block';
  }

  function renderPicker(zoneId, pickerEl) {
    const allDrills    = DrillManager.getAllDrills();
    const allSequences = DrillManager.getAllSequences();

    pickerEl.innerHTML = `
      <div class="picker-inner">
        <div class="picker-tabs">
          <button class="picker-tab active" data-type="drill">🏒 Drills</button>
          <button class="picker-tab" data-type="sequence">📋 Sequences</button>
        </div>
        <input class="picker-search" type="text" placeholder="Search…">
        <div class="picker-list"></div>
      </div>
    `;

    let currentType = 'drill';

    function renderPickerList(type, query) {
      const items    = type === 'drill' ? allDrills : allSequences;
      const filtered = items.filter(i => i.name.toLowerCase().includes((query || '').toLowerCase()));
      const listEl   = pickerEl.querySelector('.picker-list');
      listEl.innerHTML = '';
      if (filtered.length === 0) {
        listEl.innerHTML = '<div class="empty-state" style="padding:10px">Nothing found</div>';
        return;
      }
      filtered.forEach(item => {
        const row = document.createElement('div');
        row.className = 'picker-item';
        row.innerHTML = `<span>${esc(item.name)}</span>${item.category ? `<span class="cat-badge">${esc(item.category)}</span>` : ''}`;
        row.addEventListener('click', () => {
          addBlock(zoneId, type, item.id, item.name);
          pickerEl.style.display = 'none';
          activePicker = null;
        });
        listEl.appendChild(row);
      });
    }

    pickerEl.querySelectorAll('.picker-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        pickerEl.querySelectorAll('.picker-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentType = tab.dataset.type;
        renderPickerList(currentType, pickerEl.querySelector('.picker-search').value);
      });
    });
    pickerEl.querySelector('.picker-search').addEventListener('input', e => {
      renderPickerList(currentType, e.target.value);
    });
    renderPickerList('drill', '');
  }

  function addBlock(zoneId, type, refId, refName) {
    blocks.push({ id: Date.now() + Math.random(), zone: zoneId, type, ref_id: refId, ref_name: refName, duration_mins: 5, notes: '' });
    renderZones();
    renderTimeline();
  }

  // ── Auto-distribute ───────────────────────────────────────────────────────
  function autoDistribute() {
    if (blocks.length === 0) { showToast('Add some drills first', 'error'); return; }
    const totalMins = parseInt(durInput.value) || 60;
    const perBlock  = Math.floor(totalMins / blocks.length);
    const remainder = totalMins - (perBlock * blocks.length);
    blocks.forEach((b, i) => { b.duration_mins = perBlock + (i === 0 ? remainder : 0); });
    renderZones();
    renderTimeline();
    showToast('Time distributed evenly', 'success');
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function saveSession(asTemplate) {
    const name = nameInput.value.trim();
    if (!name) { showToast('Session name is required', 'error'); return; }
    if (blocks.length === 0) { showToast('Add at least one drill', 'error'); return; }

    const body = {
      name,
      team_age:      teamInput.value.trim(),
      focus:         focusInput.value.trim(),
      duration_mins: parseInt(durInput.value) || 60,
      date:          dateInput.value,
      start_time:    timeInput.value,
      location:      locationInput.value.trim(),
      status:        statusSelect.value,
      blocks,
      is_template:   asTemplate ? 1 : 0
    };

    try {
      const res  = await fetch(editingId ? `/api/sessions/${editingId}` : '/api/sessions', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      editingId = json.data.id;
      await load();
      // If status is published and no token yet, publish it
      if (body.status === 'published' && !json.data.share_token) {
        await publishSession();
      } else if (json.data.share_token) {
        showShareBanner(json.data.share_token);
      }
      showToast(asTemplate ? 'Saved as template!' : 'Session saved!', 'success');
    } catch (e) {
      showToast('Save failed: ' + e.message, 'error');
    }
  }

  async function publishSession() {
    if (!editingId) { showToast('Save the session first', 'error'); return; }
    try {
      const res  = await fetch(`/api/sessions/${editingId}/publish`, { method: 'POST' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      await load();
      showShareBanner(json.data.share_token);
      showToast('Session published! Share link ready.', 'success');
    } catch (e) { showToast('Publish failed: ' + e.message, 'error'); }
  }

  async function deleteSession(id) {
    if (!confirm('Delete this session?')) return;
    try {
      const res  = await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      await load();
      showToast('Session deleted', 'success');
    } catch (e) { showToast('Delete failed: ' + e.message, 'error'); }
  }

  function downloadICS(id) {
    window.location.href = `/api/sessions/${id}/ics`;
  }

  function copyShareLink(token) {
    const url = `${location.origin}/session/${token}`;
    navigator.clipboard.writeText(url).then(() => showToast('Share link copied!', 'success'));
  }

  function refreshZoneMins() {
    ZONES.forEach(zone => {
      const mins = blocks.filter(b => b.zone === zone.id).reduce((s, b) => s + (parseInt(b.duration_mins) || 0), 0);
      const header = document.querySelector(`[data-zone="${zone.id}"] .zone-mins`);
      if (header) header.textContent = mins ? mins + ' min' : 'empty';
    });
  }

  // ── Bind events ───────────────────────────────────────────────────────────
  function bindEvents() {
    document.getElementById('new-session-btn').addEventListener('click', () => openModal(null));
    document.getElementById('session-modal-close').addEventListener('click', closeModal);
    document.getElementById('session-cancel-btn').addEventListener('click', closeModal);
    document.getElementById('session-save-btn').addEventListener('click', () => saveSession(false));
    document.getElementById('session-template-btn').addEventListener('click', () => saveSession(true));
    document.getElementById('session-publish-btn').addEventListener('click', publishSession);
    document.getElementById('session-auto-btn').addEventListener('click', autoDistribute);
    document.getElementById('session-share-copy').addEventListener('click', () => {
      copyShareLink(shareLink.value.split('/session/')[1]);
    });
    durInput.addEventListener('input', renderTimeline);
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

    document.addEventListener('click', e => {
      if (activePicker && !e.target.closest('.zone-picker') && !e.target.closest('.zone-add-btn')) {
        document.querySelectorAll('.zone-picker').forEach(p => p.style.display = 'none');
        activePicker = null;
      }
    });
  }

  return { init, load };
})();
