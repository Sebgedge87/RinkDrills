/**
 * scheduleManager.js — Weekly drill schedule: create, view, edit
 */

const ScheduleManager = (() => {
  let schedules = [];
  let editingScheduleId = null;
  let currentEntries = [];   // entries for the schedule being edited
  let viewWeekStart  = null; // Date (Monday) currently shown in editor

  const DAY_NAMES  = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const DAY_FULL   = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

  // ── DOM ───────────────────────────────────────────────────────────────────
  const scheduleList  = document.getElementById('schedule-list');
  const scheduleModal = document.getElementById('schedule-modal');
  const schNameInput  = document.getElementById('sch-name');
  const weekLabel     = document.getElementById('sch-week-label');
  const weekGrid      = document.getElementById('sch-week-grid');

  // ── Init ──────────────────────────────────────────────────────────────────
  async function init() {
    await load();
    bindEvents();
  }

  async function load() {
    try {
      const res  = await fetch('/api/schedules');
      const json = await res.json();
      if (json.success) { schedules = json.data; renderList(); }
    } catch (e) { showToast('Failed to load schedules', 'error'); }
  }

  // ── Render sidebar list ───────────────────────────────────────────────────
  function renderList() {
    if (schedules.length === 0) {
      scheduleList.innerHTML = '<div class="empty-state">No schedules yet</div>';
      return;
    }
    scheduleList.innerHTML = '';
    schedules.forEach(s => {
      const entries = Array.isArray(s.entries) ? s.entries : [];
      const el = document.createElement('div');
      el.className = 'seq-item';
      const weekStr = s.week_start ? formatWeekRange(s.week_start) : 'No date set';
      el.innerHTML = `
        <div style="flex:1;min-width:0">
          <div class="seq-name">${esc(s.name)}</div>
          <div class="seq-meta">${weekStr} · ${entries.length} session${entries.length !== 1 ? 's' : ''}</div>
        </div>
        <div class="item-actions">
          <button class="icon-btn view-sch-btn" data-id="${s.id}" title="View / Edit">📅</button>
          <button class="icon-btn danger del-sch-btn" data-id="${s.id}" title="Delete">🗑️</button>
        </div>
      `;
      el.querySelector('.view-sch-btn').addEventListener('click', e => { e.stopPropagation(); openModal(s.id); });
      el.querySelector('.del-sch-btn').addEventListener('click',  e => { e.stopPropagation(); deleteSchedule(s.id); });
      scheduleList.appendChild(el);
    });
  }

  function formatWeekRange(weekStart) {
    const d = new Date(weekStart + 'T00:00:00');
    const end = new Date(d); end.setDate(d.getDate() + 6);
    const opts = { month: 'short', day: 'numeric' };
    return `${d.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, opts)}`;
  }

  // ── Open modal ────────────────────────────────────────────────────────────
  function openModal(scheduleId) {
    editingScheduleId = scheduleId || null;

    if (scheduleId) {
      const s = schedules.find(x => x.id === scheduleId);
      if (s) {
        schNameInput.value = s.name;
        currentEntries = (s.entries || []).map(e => ({ ...e }));
        viewWeekStart = s.week_start ? mondayOf(new Date(s.week_start + 'T00:00:00')) : mondayOf(new Date());
      }
    } else {
      schNameInput.value = '';
      currentEntries = [];
      viewWeekStart = mondayOf(new Date());
    }

    renderWeekGrid();
    scheduleModal.classList.add('open');
    schNameInput.focus();
  }

  function closeModal() {
    scheduleModal.classList.remove('open');
    editingScheduleId = null;
    currentEntries = [];
    // Close any open add-entry forms
    document.querySelectorAll('.day-add-form').forEach(f => f.remove());
  }

  // ── Week grid ─────────────────────────────────────────────────────────────
  function mondayOf(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = (day === 0 ? -6 : 1 - day);
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function isoDate(d) {
    return d.toISOString().slice(0, 10);
  }

  function renderWeekGrid() {
    const ws = viewWeekStart;
    const endDate = new Date(ws); endDate.setDate(ws.getDate() + 6);
    weekLabel.textContent = formatWeekRange(isoDate(ws));

    weekGrid.innerHTML = '';

    for (let d = 0; d < 7; d++) {
      const date = new Date(ws); date.setDate(ws.getDate() + d);
      const dateStr = isoDate(date);
      const dayEntries = currentEntries.filter(e => e.date === dateStr)
        .sort((a, b) => (a.time || '').localeCompare(b.time || ''));

      const col = document.createElement('div');
      col.className = 'day-col';
      col.dataset.date = dateStr;

      const dateNum = date.getDate();
      const monthAbbr = date.toLocaleDateString(undefined, { month: 'short' });

      col.innerHTML = `
        <div class="day-header">
          <span class="day-name">${DAY_NAMES[d]}</span>
          <span class="day-date">${monthAbbr} ${dateNum}</span>
        </div>
        <div class="day-entries" id="day-entries-${dateStr}"></div>
        <button class="day-add-btn" data-date="${dateStr}">＋ Add</button>
      `;

      // Render entries
      const entriesEl = col.querySelector(`#day-entries-${dateStr}`);
      dayEntries.forEach((entry, idx) => {
        const card = buildEntryCard(entry, dateStr, idx);
        entriesEl.appendChild(card);
      });

      col.querySelector('.day-add-btn').addEventListener('click', () => openAddEntryForm(col, dateStr));
      weekGrid.appendChild(col);
    }
  }

  function buildEntryCard(entry, dateStr, idx) {
    const card = document.createElement('div');
    card.className = `entry-card entry-${entry.type}`;
    const label = entry.type === 'drill' ? '🏒' : entry.type === 'session' ? '⚡' : '📋';
    card.innerHTML = `
      <div class="entry-card-inner">
        <span class="entry-time">${entry.time || ''}</span>
        <span class="entry-icon">${label}</span>
        <span class="entry-name">${esc(entry.ref_name || '')}</span>
        ${entry.note ? `<span class="entry-note" title="${esc(entry.note)}">💬</span>` : ''}
        <button class="entry-remove" data-date="${dateStr}" data-idx="${idx}" title="Remove">✕</button>
      </div>
    `;
    card.querySelector('.entry-remove').addEventListener('click', e => {
      e.stopPropagation();
      removeEntry(dateStr, idx);
    });
    return card;
  }

  async function openAddEntryForm(col, dateStr) {
    col.querySelectorAll('.day-add-form').forEach(f => f.remove());

    const allDrills = DrillManager.getAllDrills();
    const allSeqs   = DrillManager.getAllSequences();

    // Fetch sessions for the dropdown
    let allSessions = [];
    try {
      const res = await fetch('/api/sessions');
      const json = await res.json();
      if (json.success) allSessions = json.data;
    } catch (_) {}

    const form = document.createElement('div');
    form.className = 'day-add-form';
    form.innerHTML = `
      <select class="add-entry-type">
        <option value="session">Practice Session</option>
        <option value="drill">Drill</option>
        <option value="sequence">Sequence</option>
      </select>
      <select class="add-entry-ref"></select>
      <input type="time" class="add-entry-time" placeholder="Time">
      <input type="text" class="add-entry-note" placeholder="Coach note…">
      <div class="add-entry-btns">
        <button class="btn btn-primary add-entry-save" style="padding:4px 10px;font-size:0.78rem">Add</button>
        <button class="btn btn-secondary add-entry-cancel" style="padding:4px 10px;font-size:0.78rem">✕</button>
      </div>
    `;

    function populateRef(type) {
      const refSel = form.querySelector('.add-entry-ref');
      refSel.innerHTML = '';
      const items = type === 'drill' ? allDrills : type === 'sequence' ? allSeqs : allSessions;
      if (items.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = type === 'session' ? '— No sessions yet —' : '— None —';
        refSel.appendChild(opt);
        return;
      }
      items.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item.id;
        const meta = type === 'session'
          ? [item.date, item.start_time, item.team_age].filter(Boolean).join(' · ')
          : '';
        opt.textContent = item.name + (meta ? ` (${meta})` : '');
        refSel.appendChild(opt);
      });
    }

    const typeSel = form.querySelector('.add-entry-type');
    populateRef('session');
    typeSel.addEventListener('change', () => populateRef(typeSel.value));

    form.querySelector('.add-entry-save').addEventListener('click', () => {
      const type    = typeSel.value;
      const refSel  = form.querySelector('.add-entry-ref');
      const refId   = Number(refSel.value) || refSel.value;
      const refName = refSel.options[refSel.selectedIndex]?.text || '';
      const time    = form.querySelector('.add-entry-time').value;
      const note    = form.querySelector('.add-entry-note').value.trim();
      if (!refId) return;
      currentEntries.push({ date: dateStr, type, ref_id: refId, ref_name: refName, time, note });
      renderWeekGrid();
    });

    form.querySelector('.add-entry-cancel').addEventListener('click', () => form.remove());
    col.appendChild(form);
    typeSel.focus();
  }

  function removeEntry(dateStr, idx) {
    const dayEntries = currentEntries.filter(e => e.date === dateStr);
    const entry = dayEntries[idx];
    if (entry) {
      const globalIdx = currentEntries.indexOf(entry);
      if (globalIdx !== -1) currentEntries.splice(globalIdx, 1);
      renderWeekGrid();
    }
  }

  // ── Save schedule ─────────────────────────────────────────────────────────
  async function saveSchedule() {
    const name = schNameInput.value.trim();
    if (!name) { showToast('Schedule name is required', 'error'); return; }

    const body = {
      name,
      week_start: isoDate(viewWeekStart),
      entries: currentEntries
    };

    try {
      let res;
      if (editingScheduleId) {
        res = await fetch(`/api/schedules/${editingScheduleId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
      } else {
        res = await fetch('/api/schedules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
      }
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      closeModal();
      await load();
      showToast(editingScheduleId ? 'Schedule updated!' : 'Schedule saved!', 'success');
    } catch (e) {
      showToast('Save failed: ' + e.message, 'error');
    }
  }

  async function deleteSchedule(id) {
    if (!confirm('Delete this schedule?')) return;
    try {
      const res  = await fetch(`/api/schedules/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      await load();
      showToast('Schedule deleted', 'success');
    } catch (e) {
      showToast('Delete failed: ' + e.message, 'error');
    }
  }

  // ── Week navigation ───────────────────────────────────────────────────────
  function shiftWeek(delta) {
    viewWeekStart = new Date(viewWeekStart);
    viewWeekStart.setDate(viewWeekStart.getDate() + delta * 7);
    renderWeekGrid();
  }

  // ── Bind events ───────────────────────────────────────────────────────────
  function bindEvents() {
    document.getElementById('new-schedule-btn').addEventListener('click', () => openModal(null));
    document.getElementById('sch-modal-close').addEventListener('click', closeModal);
    document.getElementById('sch-cancel-btn').addEventListener('click', closeModal);
    document.getElementById('sch-save-btn').addEventListener('click', saveSchedule);
    document.getElementById('sch-prev-week').addEventListener('click', () => shiftWeek(-1));
    document.getElementById('sch-next-week').addEventListener('click', () => shiftWeek(1));
    scheduleModal.addEventListener('click', e => { if (e.target === scheduleModal) closeModal(); });
  }

  return { init, load };
})();
