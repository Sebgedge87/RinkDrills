/**
 * sequencePlayer.js — Sequence loading, timer, auto-advance
 */

const SequencePlayer = (() => {
  let sequence      = null;    // resolved sequence object
  let currentStep   = 0;
  let totalSeconds  = 0;
  let elapsed       = 0;
  let paused        = false;
  let timerHandle   = null;
  let active        = false;

  const bar           = document.getElementById('sequence-bar');
  const seqLabel      = document.getElementById('seq-label');
  const seqTimer      = document.getElementById('seq-timer');
  const seqFill       = document.getElementById('seq-progress-fill');
  const prevBtn       = document.getElementById('seq-prev-btn');
  const nextBtn       = document.getElementById('seq-next-btn');
  const pauseBtn      = document.getElementById('seq-pause-btn');
  const closeBtn      = document.getElementById('seq-close-btn');
  const overlay       = document.getElementById('transition-overlay');
  const overTitle     = document.getElementById('transition-title');
  const overNote      = document.getElementById('transition-note');
  const overCount     = document.getElementById('transition-count');

  // ── Controls ───────────────────────────────────────────────────────────────
  prevBtn.addEventListener('click', () => {
    if (!active) return;
    if (currentStep > 0) gotoStep(currentStep - 1, false);
  });

  nextBtn.addEventListener('click', () => {
    if (!active) return;
    advanceStep();
  });

  pauseBtn.addEventListener('click', () => {
    if (!active) return;
    paused = !paused;
    pauseBtn.textContent = paused ? '▶ Resume' : '⏸ Pause';
    if (paused) {
      App.stopAnimation();
    } else {
      App.startAnimation();
    }
  });

  closeBtn.addEventListener('click', stop);

  // ── Play ───────────────────────────────────────────────────────────────────
  async function play(seqId) {
    try {
      const res  = await fetch(`/api/sequences/${seqId}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      sequence = json.data;
      if (!sequence.steps || sequence.steps.length === 0) {
        showToast('Sequence has no steps', 'error');
        return;
      }
      active = true;
      currentStep = 0;
      paused = false;
      bar.classList.add('visible');
      gotoStep(0, false);
    } catch (e) {
      showToast('Failed to load sequence: ' + e.message, 'error');
    }
  }

  function stop() {
    clearInterval(timerHandle);
    timerHandle = null;
    active = false;
    sequence = null;
    bar.classList.remove('visible');
    overlay.classList.remove('visible');
    App.stopAnimation();
    pauseBtn.textContent = '⏸ Pause';
    paused = false;
  }

  // ── Step navigation ────────────────────────────────────────────────────────
  function gotoStep(index, showTransition) {
    if (!sequence) return;
    clearInterval(timerHandle);

    if (showTransition) {
      const prevStep = sequence.steps[index];
      const note = prevStep && prevStep.transition_note ? prevStep.transition_note : 'Next drill starting…';
      const nextStepData = sequence.steps[index];
      showTransitionOverlay(nextStepData ? nextStepData.drill && nextStepData.drill.name || `Drill ${index + 1}` : '', note, () => {
        loadStep(index);
      });
    } else {
      loadStep(index);
    }
  }

  function loadStep(index) {
    currentStep = index;
    overlay.classList.remove('visible');

    const step = sequence.steps[index];
    if (!step) return;

    // Load drill onto canvas
    if (step.drill) {
      App.loadDrill(step.drill);
    }

    // Start animation
    if (!paused) App.startAnimation();

    // Update UI
    const name = step.drill ? step.drill.name : `Step ${index + 1}`;
    seqLabel.innerHTML = `Drill ${index + 1} of ${sequence.steps.length} — ${name} <span class="loop-badge">↻ loop</span>`;
    totalSeconds = step.duration_seconds || 120;
    elapsed = 0;
    updateTimerUI();

    prevBtn.disabled = index === 0;
    nextBtn.disabled = false; // always enabled — sequence loops

    // Start countdown
    timerHandle = setInterval(() => {
      if (paused) return;
      elapsed++;
      updateTimerUI();
      if (elapsed >= totalSeconds) {
        clearInterval(timerHandle);
        advanceStep();
      }
    }, 1000);
  }

  function advanceStep() {
    const next = currentStep + 1;
    if (next >= sequence.steps.length) {
      // Loop back to start
      gotoStep(0, true);
      return;
    }
    gotoStep(next, true);
  }

  function updateTimerUI() {
    const remaining = Math.max(0, totalSeconds - elapsed);
    const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
    const ss = String(remaining % 60).padStart(2, '0');
    seqTimer.textContent = `${mm}:${ss}`;
    const pct = totalSeconds > 0 ? (elapsed / totalSeconds) * 100 : 0;
    seqFill.style.width = pct + '%';
  }

  // ── Transition overlay ─────────────────────────────────────────────────────
  function showTransitionOverlay(drillName, note, callback) {
    App.stopAnimation();
    overTitle.textContent = drillName ? `Next: ${drillName}` : 'Next Drill';
    overNote.textContent = note || '';
    overlay.classList.add('visible');

    let count = 3;
    overCount.textContent = count;

    const countdown = setInterval(() => {
      count--;
      overCount.textContent = count;
      if (count <= 0) {
        clearInterval(countdown);
        overlay.classList.remove('visible');
        callback();
      }
    }, 1000);
  }

  return { play, stop };
})();
