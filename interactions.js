/* ─── interactions.js — Drag/Drop, Stepper, Animations, Toast ─── */

const Interactions = {
  drag: null,

  init() {
    this._sidebarToggle();
    this._keyboard();
    this._toast();
  },

  /* Sidebar spring toggle */
  _sidebarToggle() {
    const btn = document.getElementById('btn-toggle-sidebar');
    const sb  = document.getElementById('sidebar');
    // Sidebar starts open → button starts active (amber)
    btn?.classList.add('active');
    btn?.addEventListener('click', () => {
      sb.classList.toggle('collapsed');
      btn.classList.toggle('active');
    });
    document.getElementById('total-timer')?.addEventListener('click', () => UI.toggleOverview());
  },


  /* Keyboard nav */
  _keyboard() {
    document.addEventListener('keydown', e => {
      const recMode = document.getElementById('recording-mode');
      const inRec = recMode && !recMode.classList.contains('hidden');
      if (inRec) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown')  { e.preventDefault(); UI.recNext(); }
        if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')    { e.preventDefault(); UI.recPrev(); }
        if (e.key === 'Escape') UI.exitRec();
      }
      const oview = document.getElementById('overview-mode');
      if (oview && !oview.classList.contains('hidden') && e.key === 'Escape') UI.closeOverview();
    });
  },

  /* Toast auto-dismiss */
  _toast() {
    document.getElementById('toast-close')?.addEventListener('click', () =>
      document.getElementById('toast').classList.add('hidden')
    );
  },

  /* ── Column Drag & Drop ── */
  initDrag(sceneId) {
    const col = document.querySelector(`.scene-col[data-id="${sceneId}"]`);
    const handle = col?.querySelector('.drag-handle');
    if (!col || !handle) return;
    handle.addEventListener('pointerdown', e => this._dragStart(e, col, sceneId));
  },

  _dragStart(e, col, sceneId) {
    e.preventDefault();
    const track = document.getElementById('timeline-track');
    if (!track) return;
    const colRect = col.getBoundingClientRect();
    const cols = [...track.querySelectorAll('.scene-col')];

    this.drag = {
      sceneId, col, track, cols,
      startX: e.clientX,
      offsetX: e.clientX - colRect.left,
      fromIdx: cols.indexOf(col),
      toIdx: cols.indexOf(col),
      active: false,
      ghostX: 0
    };

    col.setPointerCapture(e.pointerId);
    col.addEventListener('pointermove', this._dragMove = this._dragMove.bind(this));
    col.addEventListener('pointerup',   this._dragEnd  = this._dragEnd.bind(this));
  },

  _dragMove(e) {
    const d = this.drag; if (!d) return;
    const delta = Math.abs(e.clientX - d.startX);

    if (!d.active && delta > 6) {
      d.active = true;
      d.col.classList.add('dragging');
      d.col.style.position = 'relative';
      d.col.style.zIndex = '99';
    }
    if (!d.active) return;

    const trackRect = d.track.getBoundingClientRect();
    const relX = e.clientX - trackRect.left + d.track.scrollLeft - d.offsetX;
    d.col.style.transform = `translateX(${relX - d.col.offsetLeft}px)`;

    /* Compute new index */
    const siblings = d.cols.filter(c => c !== d.col);
    let newIdx = siblings.length;
    for (let i = 0; i < siblings.length; i++) {
      const r = siblings[i].getBoundingClientRect();
      if (e.clientX < r.left + r.width * 0.5) { newIdx = i; break; }
    }
    /* Adjust for original position */
    const insertIdx = d.fromIdx <= newIdx ? newIdx : newIdx;
    if (insertIdx !== d.toIdx) {
      d.toIdx = insertIdx;
      const colW = d.col.offsetWidth;
      siblings.forEach((c, i) => {
        const shift = (d.fromIdx > d.toIdx ? i >= d.toIdx && i < d.fromIdx : i >= d.fromIdx && i <= d.toIdx - 1)
          ? (d.fromIdx > d.toIdx ? colW : -colW) : 0;
        c.style.transition = 'transform 220ms cubic-bezier(0.4,0,0.2,1)';
        c.style.transform = `translateX(${shift}px)`;
      });
    }
  },

  _dragEnd(e) {
    const d = this.drag; if (!d) return;
    d.col.removeEventListener('pointermove', this._dragMove);
    d.col.removeEventListener('pointerup',   this._dragEnd);

    if (d.active) {
      d.col.classList.remove('dragging');
      d.col.style.position = '';
      d.col.style.zIndex = '';
      d.col.style.transform = '';
      d.cols.filter(c => c !== d.col).forEach(c => { c.style.transition = ''; c.style.transform = ''; });

      if (d.toIdx !== d.fromIdx) {
        State.moveScene(d.sceneId, d.toIdx);
        UI.renderTimeline();
      }
    }
    this.drag = null;
  },

  /* ── Duration Stepper (drag to scrub) ── */
  initStepper(sceneId) {
    const col = document.querySelector(`.scene-col[data-id="${sceneId}"]`);
    const stepper = col?.querySelector('.duration-stepper');
    if (!col || !stepper) return;

    let startX = 0, startDur = 0, moved = false;

    stepper.addEventListener('pointerdown', e => {
      startX = e.clientX;
      startDur = State.scene(sceneId)?.actualDuration ?? 30;
      moved = false;
      stepper.classList.add('active');
      stepper.setPointerCapture(e.pointerId);

      const onMove = e2 => {
        moved = true;
        const delta = Math.round((e2.clientX - startX) / 10) * 5;
        const nd = Math.max(5, startDur + delta);
        if (State.scene(sceneId)?.actualDuration !== nd) {
          State.updateScene(sceneId, { actualDuration: nd });
          UI.refreshDuration(sceneId);
        }
      };
      const onUp = () => {
        stepper.classList.remove('active');
        stepper.removeEventListener('pointermove', onMove);
        stepper.removeEventListener('pointerup',   onUp);
      };
      stepper.addEventListener('pointermove', onMove);
      stepper.addEventListener('pointerup',   onUp);
    });

    /* +/- buttons */
    col.querySelector('.stepper-plus')?.addEventListener('click', () => {
      const sc = State.scene(sceneId); if (!sc) return;
      State.updateScene(sceneId, { actualDuration: sc.actualDuration + 5 });
      UI.refreshDuration(sceneId);
    });
    col.querySelector('.stepper-minus')?.addEventListener('click', () => {
      const sc = State.scene(sceneId); if (!sc) return;
      State.updateScene(sceneId, { actualDuration: Math.max(5, sc.actualDuration - 5) });
      UI.refreshDuration(sceneId);
    });
  },

  /* ── Toast ── */
  toast(msg, undoCb = null) {
    const t   = document.getElementById('toast');
    const m   = document.getElementById('toast-msg');
    const u   = document.getElementById('toast-undo');
    const c   = document.getElementById('toast-close');
    m.textContent = msg;
    if (undoCb) {
      u.classList.remove('hidden');
      u.onclick = () => { undoCb(); t.classList.add('hidden'); };
    } else {
      u.classList.add('hidden');
    }
    t.classList.remove('hidden');
    clearTimeout(t._tid);
    t._tid = setTimeout(() => t.classList.add('hidden'), 4000);
  },

  /* ── Spring‑style scene‑insert animation ── */
  animateIn(el) {
    if (!el) return;
    el.style.opacity = '0';
    el.style.transform = 'scaleX(0.01)';
    el.style.transformOrigin = 'left';
    requestAnimationFrame(() => {
      el.style.transition = 'opacity 280ms ease, transform 380ms cubic-bezier(0.34,1.56,0.64,1)';
      el.style.opacity = '1';
      el.style.transform = 'scaleX(1)';
      setTimeout(() => { el.style.transition = ''; el.style.transform = ''; }, 450);
    });
  }
};
