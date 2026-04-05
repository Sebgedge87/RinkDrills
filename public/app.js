/**
 * app.js — Main canvas controller for IceBoard
 * Handles: player rendering, drag, arrow draw/erase/animate, undo, keyboard, export/import
 */

const App = (() => {
  // ── Canvas setup ───────────────────────────────────────────────────────────
  const canvas = document.getElementById('rink-canvas');
  const ctx    = canvas.getContext('2d');

  // Sizing: maintain 200:85 ratio
  function resizeCanvas() {
    const wrapper = document.getElementById('canvas-wrapper');
    const maxW = wrapper.clientWidth  - 32;
    const maxH = wrapper.clientHeight - 32;
    const ratio = 200 / 85;

    let w = maxW;
    let h = w / ratio;
    if (h > maxH) { h = maxH; w = h * ratio; }

    canvas.width  = Math.round(w);
    canvas.height = Math.round(h);
    render();
  }

  window.addEventListener('resize', resizeCanvas);

  // ── Player colours ─────────────────────────────────────────────────────────
  const COLOURS = {
    red:    { player: '#e63946', gk: '#ff8fa3', label: '#fff' },
    blue:   { player: '#1d6fa0', gk: '#74c0fc', label: '#fff' }
  };
  const PLAYER_R = 10; // base radius in pixels, scaled

  // ── State ──────────────────────────────────────────────────────────────────
  let players = [];
  let puck    = { bx: 0.5, by: 0.5 };  // single puck, fractional coords
  let arrows  = [];       // [{pid, tbx, tby}] — fractional destination
  let undoStack = [];     // max 20 arrow states

  let mode = 'select';    // 'select' | 'arrow' | 'erase'

  // Arrow placement state
  let arrowSrcPid   = null;
  let previewEnd    = null;  // {x, y} canvas coords

  // Drag state
  let dragging      = null;  // {pid, offBx, offBy}
  let dragMoved     = false;

  // Animation state
  let animating     = false;
  let animFrame     = null;
  let animProgress  = {};    // {pid: 0-1}
  let ANIM_SPEED  = 0.0008; // fraction per ms (default ~slow)

  // ── Default player layout ──────────────────────────────────────────────────
  function defaultPlayers() {
    return [
      { id: 'r1', team: 'red',  role: 'gk',     bx: 0.04, by: 0.5 },
      { id: 'r2', team: 'red',  role: 'player',  bx: 0.15, by: 0.25 },
      { id: 'r3', team: 'red',  role: 'player',  bx: 0.15, by: 0.75 },
      { id: 'r4', team: 'red',  role: 'player',  bx: 0.25, by: 0.35 },
      { id: 'r5', team: 'red',  role: 'player',  bx: 0.25, by: 0.65 },
      { id: 'r6', team: 'red',  role: 'player',  bx: 0.20, by: 0.5  },
      { id: 'b1', team: 'blue', role: 'gk',     bx: 0.96, by: 0.5 },
      { id: 'b2', team: 'blue', role: 'player',  bx: 0.85, by: 0.25 },
      { id: 'b3', team: 'blue', role: 'player',  bx: 0.85, by: 0.75 },
      { id: 'b4', team: 'blue', role: 'player',  bx: 0.75, by: 0.35 },
      { id: 'b5', team: 'blue', role: 'player',  bx: 0.75, by: 0.65 },
      { id: 'b6', team: 'blue', role: 'player',  bx: 0.80, by: 0.5  }
    ];
  }

  function init() {
    players = defaultPlayers();
    puck    = { bx: 0.5, by: 0.5 };
    arrows  = [];
    resizeCanvas();
    bindCanvasEvents();
    bindToolbarEvents();
    bindKeyboard();
    bindExportImport();
    setMode('select');
    DrillManager.init();
    ScheduleManager.init();
    ImportManager.init();
  }

  // ── Coordinate helpers ─────────────────────────────────────────────────────
  function pxFromFrac(bx, by) {
    return fracToCanvas(bx, by, canvas.width, canvas.height);
  }

  function fracFromPx(px, py) {
    return canvasToFrac(px, py, canvas.width, canvas.height);
  }

  function getCanvasXY(ev) {
    const rect = canvas.getBoundingClientRect();
    const touch = ev.touches ? ev.touches[0] : ev;
    return {
      x: (touch.clientX - rect.left) * (canvas.width  / rect.width),
      y: (touch.clientY - rect.top)  * (canvas.height / rect.height)
    };
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  function render() {
    drawRink(ctx, canvas.width, canvas.height);
    drawArrows();
    drawPuck();
    drawPlayers();
    if (mode === 'arrow' && arrowSrcPid && previewEnd) {
      drawPreviewArrow();
    }
  }

  function drawPuck() {
    const pos = pxFromFrac(puck.bx, puck.by);
    const scale = Math.min(canvas.width / 200, canvas.height / 85);
    const rx = Math.max(5, scale * 0.55);
    const ry = Math.max(3, scale * 0.32);

    ctx.save();
    ctx.translate(pos.x, pos.y);

    // Shadow
    ctx.beginPath();
    ctx.ellipse(1.5, 2, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fill();

    // Puck body
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#111';
    ctx.fill();

    // Edge highlight
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    ctx.restore();
  }

  function drawPlayers() {
    const scale = Math.min(canvas.width / 200, canvas.height / 85);
    const r = Math.max(9, scale * 1.1);

    players.forEach(p => {
      let pos;
      if (animating && animProgress[p.id] !== undefined) {
        const arr = arrows.find(a => a.pid === p.id);
        if (arr) {
          const t = animProgress[p.id];
          const start = pxFromFrac(p.bx, p.by);
          const end   = pxFromFrac(arr.tbx, arr.tby);
          pos = {
            x: start.x + (end.x - start.x) * t,
            y: start.y + (end.y - start.y) * t
          };
        } else {
          pos = pxFromFrac(p.bx, p.by);
        }
      } else {
        pos = pxFromFrac(p.bx, p.by);
      }

      const color = COLOURS[p.team][p.role === 'gk' ? 'gk' : 'player'];

      // Shadow
      ctx.beginPath();
      ctx.arc(pos.x + 1.5, pos.y + 1.5, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fill();

      // Body
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Border
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Label
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.max(8, r * 0.72)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.id.toUpperCase(), pos.x, pos.y);

      // Arrow mode highlight
      if (mode === 'arrow' && arrowSrcPid === p.id) {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r + 3, 0, Math.PI * 2);
        ctx.strokeStyle = '#f4a261';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });
  }

  function drawArrows() {
    arrows.forEach(arr => {
      const player = players.find(p => p.id === arr.pid);
      if (!player) return;
      const start = pxFromFrac(player.bx, player.by);
      const end   = pxFromFrac(arr.tbx, arr.tby);
      drawArrowLine(ctx, start.x, start.y, end.x, end.y, '#f4a261', false);
    });
  }

  function drawPreviewArrow() {
    const player = players.find(p => p.id === arrowSrcPid);
    if (!player) return;
    const start = pxFromFrac(player.bx, player.by);
    drawArrowLine(ctx, start.x, start.y, previewEnd.x, previewEnd.y, 'rgba(244,162,97,0.55)', true);
  }

  function drawArrowLine(ctx, x1, y1, x2, y2, color, dashed) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 2) return;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle   = color;
    ctx.lineWidth   = 2;
    if (dashed) ctx.setLineDash([5, 5]);
    else        ctx.setLineDash([6, 4]);

    // Line (shortened to not overlap arrowhead)
    const headLen = 12;
    const angle   = Math.atan2(dy, dx);
    const ex = x2 - Math.cos(angle) * headLen * 0.5;
    const ey = y2 - Math.sin(angle) * headLen * 0.5;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.setLineDash([]);

    // Arrowhead
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(
      x2 - headLen * Math.cos(angle - Math.PI / 7),
      y2 - headLen * Math.sin(angle - Math.PI / 7)
    );
    ctx.lineTo(
      x2 - headLen * Math.cos(angle + Math.PI / 7),
      y2 - headLen * Math.sin(angle + Math.PI / 7)
    );
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // ── Animation ──────────────────────────────────────────────────────────────
  let lastAnimTime = null;

  function startAnimation() {
    if (animating) return;
    animating = true;
    animProgress = {};
    arrows.forEach(a => { animProgress[a.pid] = 0; });
    lastAnimTime = null;
    animFrame = requestAnimationFrame(animStep);
    document.getElementById('animate-btn').classList.add('active');
    document.getElementById('animate-btn').textContent = '⏹ Stop';
  }

  function stopAnimation() {
    if (!animating) return;
    animating = false;
    if (animFrame) cancelAnimationFrame(animFrame);
    animFrame = null;
    animProgress = {};
    document.getElementById('animate-btn').classList.remove('active');
    document.getElementById('animate-btn').textContent = '▶ Animate';
    render();
  }

  function animStep(ts) {
    if (!animating) return;
    if (lastAnimTime === null) lastAnimTime = ts;
    const dt = ts - lastAnimTime;
    lastAnimTime = ts;

    let allDone = true;
    arrows.forEach(a => {
      animProgress[a.pid] = (animProgress[a.pid] || 0) + ANIM_SPEED * dt;
      if (animProgress[a.pid] < 1) allDone = false;
      if (animProgress[a.pid] >= 1) animProgress[a.pid] = 1;
    });

    render();

    if (allDone) {
      // Reset and loop
      arrows.forEach(a => { animProgress[a.pid] = 0; });
      lastAnimTime = null;
    }

    animFrame = requestAnimationFrame(animStep);
  }

  // ── Mode ───────────────────────────────────────────────────────────────────
  function setMode(m) {
    mode = m;
    arrowSrcPid = null;
    previewEnd  = null;
    canvas.className = `mode-${m}`;

    ['select','arrow','erase'].forEach(id => {
      const btn = document.getElementById(`mode-${id}`);
      if (btn) btn.classList.toggle('active', id === m);
    });
    render();
  }

  // ── Hit testing ────────────────────────────────────────────────────────────
  function getPuckAt(x, y) {
    const scale = Math.min(canvas.width / 200, canvas.height / 85);
    const rx = Math.max(9, scale * 0.85);
    const ry = Math.max(6, scale * 0.6);
    const pos = pxFromFrac(puck.bx, puck.by);
    const nx = (x - pos.x) / rx;
    const ny = (y - pos.y) / ry;
    return (nx * nx + ny * ny) <= 1;
  }

  function getPlayerAt(x, y) {
    const scale = Math.min(canvas.width / 200, canvas.height / 85);
    const r = Math.max(9, scale * 1.1) + 4; // slightly larger hit area

    for (let i = players.length - 1; i >= 0; i--) {
      const p   = players[i];
      const pos = pxFromFrac(p.bx, p.by);
      const dx  = x - pos.x;
      const dy  = y - pos.y;
      if (dx * dx + dy * dy <= r * r) return p;
    }
    return null;
  }

  function getArrowAt(x, y) {
    const THRESHOLD = 8;
    for (let i = arrows.length - 1; i >= 0; i--) {
      const arr = arrows[i];
      const p   = players.find(pl => pl.id === arr.pid);
      if (!p) continue;
      const start = pxFromFrac(p.bx, p.by);
      const end   = pxFromFrac(arr.tbx, arr.tby);
      if (pointNearSegment(x, y, start.x, start.y, end.x, end.y, THRESHOLD)) return arr;
    }
    return null;
  }

  function pointNearSegment(px, py, x1, y1, x2, y2, threshold) {
    const dx = x2 - x1, dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return false;
    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const nx = x1 + t * dx;
    const ny = y1 + t * dy;
    const dist = Math.sqrt((px - nx) ** 2 + (py - ny) ** 2);
    return dist <= threshold;
  }

  // ── Canvas events ──────────────────────────────────────────────────────────
  function bindCanvasEvents() {
    canvas.addEventListener('mousedown', onDown);
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseup',   onUp);
    canvas.addEventListener('mouseleave', onLeave);

    // Touch support
    canvas.addEventListener('touchstart',  e => { e.preventDefault(); onDown(e); }, { passive: false });
    canvas.addEventListener('touchmove',   e => { e.preventDefault(); onMove(e); }, { passive: false });
    canvas.addEventListener('touchend',    e => { e.preventDefault(); onUp(e);   }, { passive: false });
  }

  function onDown(ev) {
    const { x, y } = getCanvasXY(ev);

    if (mode === 'select') {
      // Check puck first (it's small, check before players)
      if (getPuckAt(x, y)) {
        const frac = fracFromPx(x, y);
        dragging = { pid: '__puck__', offBx: puck.bx - frac.bx, offBy: puck.by - frac.by };
        dragMoved = false;
        return;
      }
      const p = getPlayerAt(x, y);
      if (p) {
        const frac = fracFromPx(x, y);
        dragging = { pid: p.id, offBx: p.bx - frac.bx, offBy: p.by - frac.by };
        dragMoved = false;
      }
    } else if (mode === 'arrow') {
      if (!arrowSrcPid) {
        // First click: select source player
        const p = getPlayerAt(x, y);
        if (p) {
          arrowSrcPid = p.id;
          previewEnd = { x, y };
          render();
        }
      } else {
        // Second click: set destination
        const frac = fracFromPx(x, y);
        pushUndo();
        // Remove existing arrow for this player
        arrows = arrows.filter(a => a.pid !== arrowSrcPid);
        arrows.push({ pid: arrowSrcPid, tbx: frac.bx, tby: frac.by });
        arrowSrcPid = null;
        previewEnd  = null;
        render();
      }
    } else if (mode === 'erase') {
      const arr = getArrowAt(x, y);
      if (arr) {
        pushUndo();
        arrows = arrows.filter(a => a !== arr);
        render();
      }
    }
  }

  function onMove(ev) {
    const { x, y } = getCanvasXY(ev);

    if (mode === 'select' && dragging) {
      const frac = fracFromPx(x, y);
      if (dragging.pid === '__puck__') {
        puck.bx = Math.max(0, Math.min(1, frac.bx + dragging.offBx));
        puck.by = Math.max(0, Math.min(1, frac.by + dragging.offBy));
        dragMoved = true;
        render();
      } else {
        const p = players.find(pl => pl.id === dragging.pid);
        if (p) {
          p.bx = Math.max(0, Math.min(1, frac.bx + dragging.offBx));
          p.by = Math.max(0, Math.min(1, frac.by + dragging.offBy));
          dragMoved = true;
          render();
        }
      }
    } else if (mode === 'arrow' && arrowSrcPid) {
      previewEnd = { x, y };
      render();
    }
  }

  function onUp(ev) {
    dragging = null;
  }

  function onLeave() {
    if (mode === 'arrow' && arrowSrcPid) {
      previewEnd = null;
      render();
    }
    dragging = null;
  }

  // ── Undo ───────────────────────────────────────────────────────────────────
  function pushUndo() {
    undoStack.push(JSON.stringify(arrows));
    if (undoStack.length > 20) undoStack.shift();
  }

  function undo() {
    if (undoStack.length === 0) return;
    arrows = JSON.parse(undoStack.pop());
    render();
    showToast('Undo', 'success');
  }

  // ── Toolbar events ─────────────────────────────────────────────────────────
  function bindToolbarEvents() {
    document.getElementById('mode-select').addEventListener('click', () => setMode('select'));
    document.getElementById('mode-arrow').addEventListener('click',  () => setMode('arrow'));
    document.getElementById('mode-erase').addEventListener('click',  () => setMode('erase'));

    document.getElementById('animate-btn').addEventListener('click', () => {
      if (animating) stopAnimation(); else startAnimation();
    });

    const speedSlider = document.getElementById('speed-slider');
    const speedLabel  = document.getElementById('speed-label');
    speedSlider.addEventListener('input', () => {
      ANIM_SPEED = parseFloat(speedSlider.value);
      speedLabel.textContent = Math.round(parseFloat(speedSlider.value) / 0.0008 * 100) + '%';
    });

    document.getElementById('reset-btn').addEventListener('click', () => {
      stopAnimation();
      players = defaultPlayers();
      puck    = { bx: 0.5, by: 0.5 };
      arrows  = [];
      undoStack = [];
      render();
    });

    document.getElementById('clear-arrows-btn').addEventListener('click', () => {
      pushUndo();
      arrows = [];
      render();
    });

    document.getElementById('save-drill-btn').addEventListener('click', () => {
      DrillManager.openDrillModal(null);
    });
  }

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  function bindKeyboard() {
    document.addEventListener('keydown', ev => {
      // Skip if typing in an input
      if (['INPUT','TEXTAREA','SELECT'].includes(ev.target.tagName)) return;

      switch (ev.key.toLowerCase()) {
        case 's': setMode('select'); break;
        case 'a': setMode('arrow');  break;
        case 'e': setMode('erase');  break;
        case ' ':
          ev.preventDefault();
          if (animating) stopAnimation(); else startAnimation();
          break;
        case 'escape':
          arrowSrcPid = null;
          previewEnd  = null;
          render();
          // Close any open modal
          document.querySelectorAll('.modal-backdrop.open').forEach(m => m.classList.remove('open'));
          break;
        case 'z':
          if (ev.ctrlKey || ev.metaKey) { ev.preventDefault(); undo(); }
          break;
      }
    });
  }

  // ── Export / Import ────────────────────────────────────────────────────────
  function bindExportImport() {
    document.getElementById('export-png-btn').addEventListener('click', exportPNG);
    document.getElementById('export-json-btn').addEventListener('click', exportJSON);
    document.getElementById('import-json-btn').addEventListener('click', () => {
      document.getElementById('import-file-input').click();
    });
    document.getElementById('import-file-input').addEventListener('change', importJSON);
  }

  function exportPNG() {
    stopAnimation();
    render();
    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'iceboard-drill.png';
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  }

  function exportJSON() {
    const state = getState();
    const blob  = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url   = URL.createObjectURL(blob);
    const a     = document.createElement('a');
    a.href      = url;
    a.download  = 'iceboard-drill.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function importJSON(ev) {
    const file = ev.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data.player_positions && !data.players) throw new Error('Invalid drill JSON');
        const imported = {
          player_positions: data.player_positions || data.players || [],
          arrows: data.arrows || []
        };
        loadDrill(imported);
        showToast('Drill imported (not saved) — use Save to persist', 'success');
      } catch (err) {
        showToast('Import failed: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
    ev.target.value = '';
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  function loadDrill(drill) {
    stopAnimation();
    const positions = drill.player_positions || drill.players || [];
    if (positions.length > 0) {
      players = positions.map(p => ({ ...p }));
    } else {
      players = defaultPlayers();
    }
    puck = drill.puck ? { ...drill.puck } : { bx: 0.5, by: 0.5 };
    arrows = (drill.arrows || []).map(a => ({ ...a }));
    undoStack = [];
    arrowSrcPid = null;
    previewEnd  = null;
    render();
  }

  function getState() {
    return {
      player_positions: players.map(p => ({ ...p })),
      players: players.map(p => ({ ...p })), // compat alias
      puck: { ...puck },
      arrows: arrows.map(a => ({ ...a }))
    };
  }

  return { init, loadDrill, getState, startAnimation, stopAnimation };
})();

// ── Toast utility ──────────────────────────────────────────────────────────
function showToast(msg, type = '') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 2900);
}

// ── Escape HTML ────────────────────────────────────────────────────────────
function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Bootstrap ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => App.init());
