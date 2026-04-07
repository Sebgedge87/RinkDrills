/**
 * rosterManager.js — Teams & Players management
 * Lightweight roster: who is on the ice for sessions?
 */

const RosterManager = (() => {

  let teams   = [];
  let players = [];
  let activeTeamId = null;

  const teamChips  = document.getElementById('roster-team-chips');
  const playerList = document.getElementById('roster-player-list');
  const playersLabel = document.getElementById('roster-players-label');
  const modal      = document.getElementById('roster-modal');
  const modalTitle = document.getElementById('roster-modal-title');
  const modalBody  = document.getElementById('roster-modal-body');

  // ── Init ──────────────────────────────────────────────────────────────────
  async function init() {
    await loadTeams();
    bindEvents();
  }

  async function loadTeams() {
    try {
      const res  = await fetch('/api/teams');
      const json = await res.json();
      if (json.success) { teams = json.data; renderTeams(); }
    } catch (e) { showToast('Failed to load teams', 'error'); }
  }

  async function loadPlayers(teamId) {
    try {
      const res  = await fetch(`/api/players?team_id=${teamId}`);
      const json = await res.json();
      if (json.success) { players = json.data; renderPlayers(teamId); }
    } catch (e) { showToast('Failed to load players', 'error'); }
  }

  // ── Render teams as chips ─────────────────────────────────────────────────
  function renderTeams() {
    teamChips.innerHTML = '';
    if (teams.length === 0) {
      teamChips.innerHTML = '<span style="font-size:0.72rem;color:var(--text-dim);padding:4px 2px">No teams</span>';
      playerList.innerHTML = '<div class="empty-state">Add a team first</div>';
      if (playersLabel) playersLabel.style.display = 'none';
      return;
    }
    teams.forEach(t => {
      const chip = document.createElement('button');
      chip.className = 'team-chip' + (t.id === activeTeamId ? ' active' : '');
      const meta = [t.age_group, t.season].filter(Boolean).join(' ');
      chip.title = [t.name, meta].filter(Boolean).join(' — ');
      chip.innerHTML = esc(t.name);
      chip.addEventListener('click', () => selectTeam(t.id));
      chip.addEventListener('contextmenu', e => {
        e.preventDefault();
        openTeamModal(t);
      });
      // Long-press edit on active chip
      if (t.id === activeTeamId) {
        const editBtn = document.createElement('span');
        editBtn.className = 'chip-edit';
        editBtn.textContent = '✏';
        editBtn.addEventListener('click', ev => { ev.stopPropagation(); openTeamModal(t); });
        chip.appendChild(editBtn);
      }
      teamChips.appendChild(chip);
    });

    if (activeTeamId) loadPlayers(activeTeamId);
  }

  function selectTeam(teamId) {
    activeTeamId = teamId;
    renderTeams();
    loadPlayers(teamId);
  }

  // ── Render players ────────────────────────────────────────────────────────
  function renderPlayers(teamId) {
    const addBtn = document.getElementById('add-player-btn');
    if (addBtn) addBtn.style.display = 'block';
    if (playersLabel) playersLabel.style.display = 'block';

    const team = teams.find(t => t.id === teamId);
    if (playersLabel && team) {
      const meta = [team.age_group, team.season].filter(Boolean).join(' · ');
      playersLabel.textContent = team.name + (meta ? ` — ${meta}` : '');
    }

    if (players.length === 0) {
      playerList.innerHTML = '<div class="empty-state">No players — add one below</div>';
      return;
    }
    playerList.innerHTML = '';

    // Sort by number then name
    const sorted = [...players].sort((a, b) => {
      const na = parseInt(a.number) || 999, nb = parseInt(b.number) || 999;
      return na !== nb ? na - nb : a.name.localeCompare(b.name);
    });

    sorted.forEach(p => {
      const el = document.createElement('div');
      el.className = 'player-item';
      const posColor = { F: '#4f9cf7', D: '#e63946', G: '#f4a261' }[p.position] || 'var(--text-dim)';
      // Show initials if name is long
      const nameParts = p.name.trim().split(/\s+/);
      const displayName = nameParts.length > 1
        ? `${nameParts[0]} ${nameParts.slice(1).map(n => n[0] + '.').join(' ')}`
        : p.name;
      el.innerHTML = `
        <div class="player-number">${esc(p.number || '—')}</div>
        <div class="player-info">
          <span class="player-name" title="${esc(p.name)}">${esc(displayName)}</span>
          ${p.position ? `<span class="player-pos" style="color:${posColor}">${esc(p.position)}</span>` : ''}
        </div>
        <div class="item-actions">
          <button class="icon-btn edit-player-btn" data-id="${p.id}" title="Edit">✏</button>
          <button class="icon-btn danger del-player-btn" data-id="${p.id}" title="Remove">✕</button>
        </div>
      `;
      el.querySelector('.edit-player-btn').addEventListener('click', e => { e.stopPropagation(); openPlayerModal(p); });
      el.querySelector('.del-player-btn').addEventListener('click', e => { e.stopPropagation(); deletePlayer(p.id); });
      playerList.appendChild(el);
    });
  }

  // ── Team modal ────────────────────────────────────────────────────────────
  function openTeamModal(team) {
    modalTitle.textContent = team ? 'Edit Team' : 'New Team';
    modalBody.innerHTML = `
      <div class="form-group">
        <label>Team Name *</label>
        <input id="rm-team-name" type="text" value="${esc(team?.name || '')}" placeholder="e.g. Falcons U14 A" maxlength="100">
      </div>
      <div class="form-group">
        <label>Age Group</label>
        <input id="rm-team-age" type="text" value="${esc(team?.age_group || '')}" placeholder="e.g. U14, U16, Senior" maxlength="40">
      </div>
      <div class="form-group">
        <label>Season</label>
        <input id="rm-team-season" type="text" value="${esc(team?.season || '')}" placeholder="e.g. 2025–26" maxlength="40">
      </div>
      <div class="modal-footer" style="padding:0;border:none;margin-top:4px">
        <button class="btn btn-secondary" id="rm-cancel-btn">Cancel</button>
        <button class="btn btn-primary" id="rm-save-btn">Save Team</button>
      </div>
    `;
    document.getElementById('rm-cancel-btn').addEventListener('click', closeModal);
    document.getElementById('rm-save-btn').addEventListener('click', async () => {
      const name = document.getElementById('rm-team-name').value.trim();
      if (!name) { showToast('Team name is required', 'error'); return; }
      const body = { name, age_group: document.getElementById('rm-team-age').value.trim(), season: document.getElementById('rm-team-season').value.trim() };
      try {
        const res  = await fetch(team ? `/api/teams/${team.id}` : '/api/teams', {
          method: team ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);
        closeModal();
        await loadTeams();
        if (!team) selectTeam(json.data.id);
        showToast(team ? 'Team updated!' : 'Team created!', 'success');
      } catch (e) { showToast('Save failed: ' + e.message, 'error'); }
    });
    modal.classList.add('open');
    document.getElementById('rm-team-name').focus();
  }

  // ── Player modal ──────────────────────────────────────────────────────────
  function openPlayerModal(player) {
    modalTitle.textContent = player ? 'Edit Player' : 'Add Player';
    modalBody.innerHTML = `
      <div class="form-group">
        <label>Player Name *</label>
        <input id="rm-player-name" type="text" value="${esc(player?.name || '')}" placeholder="e.g. Jamie Smith" maxlength="80">
      </div>
      <div style="display:flex;gap:10px">
        <div class="form-group" style="width:80px;flex-shrink:0">
          <label>#</label>
          <input id="rm-player-num" type="text" value="${esc(player?.number || '')}" placeholder="14" maxlength="4">
        </div>
        <div class="form-group" style="flex:1">
          <label>Position</label>
          <select id="rm-player-pos">
            <option value="">—</option>
            <option value="F" ${player?.position === 'F' ? 'selected' : ''}>Forward (F)</option>
            <option value="D" ${player?.position === 'D' ? 'selected' : ''}>Defence (D)</option>
            <option value="G" ${player?.position === 'G' ? 'selected' : ''}>Goalie (G)</option>
          </select>
        </div>
      </div>
      <div class="modal-footer" style="padding:0;border:none;margin-top:4px">
        <button class="btn btn-secondary" id="rm-cancel-btn">Cancel</button>
        <button class="btn btn-primary" id="rm-save-btn">${player ? 'Save' : 'Add Player'}</button>
      </div>
    `;
    document.getElementById('rm-cancel-btn').addEventListener('click', closeModal);
    document.getElementById('rm-save-btn').addEventListener('click', async () => {
      const name = document.getElementById('rm-player-name').value.trim();
      if (!name) { showToast('Player name is required', 'error'); return; }
      const body = { team_id: activeTeamId, name, number: document.getElementById('rm-player-num').value.trim(), position: document.getElementById('rm-player-pos').value };
      try {
        const res  = await fetch(player ? `/api/players/${player.id}` : '/api/players', {
          method: player ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);
        closeModal();
        await loadPlayers(activeTeamId);
        showToast(player ? 'Player updated!' : 'Player added!', 'success');
      } catch (e) { showToast('Save failed: ' + e.message, 'error'); }
    });
    modal.classList.add('open');
    document.getElementById('rm-player-name').focus();
  }

  function closeModal() { modal.classList.remove('open'); }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function deleteTeam(id) {
    if (!confirm('Delete this team and all its players?')) return;
    try {
      const res  = await fetch(`/api/teams/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      if (activeTeamId === id) {
        activeTeamId = null;
        playerList.innerHTML = '<div class="empty-state">Select a team above</div>';
        if (playersLabel) playersLabel.style.display = 'none';
        const addBtn = document.getElementById('add-player-btn');
        if (addBtn) addBtn.style.display = 'none';
      }
      await loadTeams();
      showToast('Team deleted', 'success');
    } catch (e) { showToast('Delete failed: ' + e.message, 'error'); }
  }

  async function deletePlayer(id) {
    if (!confirm('Remove this player?')) return;
    try {
      const res  = await fetch(`/api/players/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      await loadPlayers(activeTeamId);
      showToast('Player removed', 'success');
    } catch (e) { showToast('Delete failed: ' + e.message, 'error'); }
  }

  // ── Bind events ───────────────────────────────────────────────────────────
  function bindEvents() {
    document.getElementById('new-team-btn').addEventListener('click', () => openTeamModal(null));
    document.getElementById('add-player-btn').addEventListener('click', () => {
      if (!activeTeamId) { showToast('Select a team first', 'error'); return; }
      openPlayerModal(null);
    });
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

    // Right-click on chips area: edit active team
    teamChips.addEventListener('contextmenu', e => {
      // handled per-chip above, stop propagation to avoid bubbling
      e.preventDefault();
    });
  }

  return { init, loadTeams, getTeams: () => teams, getPlayers: () => players };
})();
