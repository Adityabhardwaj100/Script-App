/* ─── ui.js — UI Rendering Engine ─── */

const UI = {
  scriptId: null,
  recIdx: 0,
  _pendingProjectIdForScript: null,
  _pendingSceneIdForRef: null,
  _pendingRefId: null,         // null = add mode, string = edit mode
  _pendingChipEl: null,        // chip element to update on edit
  _pendingConfirmCb: null,
  isOverviewMode: false,

  /* ── Bootstrap ── */
  init() {
    State.init();
    this.scriptId = State.get('activeScriptId') || null;
    this._sidebar();
    this._timeline();
    this._modals();
    this._globalBtns();
    Interactions.init();
    // Ensure timer shows on load
    this._updateTimer();
  },

  /* ── Helpers ── */
  fmt(sec) {
    const m = Math.floor(sec / 60), s = sec % 60;
    return `${m}:${s.toString().padStart(2,'0')}`;
  },
  $: id => document.getElementById(id),
  hide: el => el?.classList.add('hidden'),
  show: el => el?.classList.remove('hidden'),

  /* ═══════════════════════════════════════
     SIDEBAR
  ═══════════════════════════════════════ */
  _sidebar() {
    this._renderProjects();
    this._updateTimer();
    this._updateVtitle();
  },

  _renderProjects() {
    const list = this.$('project-list'); if (!list) return;
    const projects = State.projects();
    const groups = [
      { key:'backlog',     label:'BACKLOG'      },
      { key:'in-progress', label:'IN PROGRESS'  },
      { key:'done',        label:'DONE'          },
    ];
    list.innerHTML = '';

    groups.forEach(g => {
      const ps = projects.filter(p => p.status === g.key);

      const grpEl = document.createElement('div');
      grpEl.className = 'sb-group';
      grpEl.dataset.status = g.key;

      const lbl = document.createElement('div');
      lbl.className = 'sb-group-label';
      lbl.textContent = g.label;
      grpEl.appendChild(lbl);

      /* ── Drop zone handlers on the group ── */
      grpEl.addEventListener('dragover', e => {
        e.preventDefault();
        document.querySelectorAll('.sb-group').forEach(g => g.classList.remove('drop-over'));
        grpEl.classList.add('drop-over');
      });
      grpEl.addEventListener('dragleave', e => {
        if (!grpEl.contains(e.relatedTarget)) grpEl.classList.remove('drop-over');
      });
      grpEl.addEventListener('drop', e => {
        e.preventDefault();
        grpEl.classList.remove('drop-over');
        const pid = e.dataTransfer.getData('text/plain');
        if (!pid) return;
        State.updateProject(pid, { status: g.key });
        this._sidebar();
        Interactions.toast(`Moved to ${g.label}`);
      });

      ps.forEach(p => {
        const scripts = State.scripts(p.id);
        const hasActiveScript = scripts.some(sc => sc.id === this.scriptId);

        const pEl = document.createElement('div');
        pEl.className = 'sb-project';

        /* ── Drag source ── */
        pEl.draggable = true;
        pEl.addEventListener('dragstart', e => {
          e.dataTransfer.setData('text/plain', p.id);
          e.dataTransfer.effectAllowed = 'move';
          pEl.classList.add('sb-dragging');
        });
        pEl.addEventListener('dragend', () => {
          pEl.classList.remove('sb-dragging');
          document.querySelectorAll('.sb-group').forEach(g => g.classList.remove('drop-over'));
        });

        /* ── Title row (title + delete btn) ── */
        const titleRow = document.createElement('div');
        titleRow.className = 'sb-title-row';

        const titleEl = document.createElement('div');
        titleEl.className = 'sb-project-title' + (hasActiveScript ? ' active' : '');
        titleEl.innerHTML = hasActiveScript
          ? `<span class="dot">·</span> ${p.title}`
          : p.title;
        titleEl.style.cursor = 'pointer';
        titleEl.title = 'Right-click to change status';

        /* Click → select first script (or create one) */
        titleEl.addEventListener('click', () => {
          if (scripts[0]) this._selectScript(scripts[0].id, p.id);
        });
        titleEl.addEventListener('contextmenu', e => {
          e.preventDefault();
          const all = ['backlog','in-progress','done'];
          State.updateProject(p.id, { status: all[(all.indexOf(p.status) + 1) % all.length] });
          this._sidebar();
        });

        /* Delete button — draggable=false prevents drag system from eating the click */
        const delBtn = document.createElement('button');
        delBtn.className = 'sb-project-del';
        delBtn.title = 'Delete project';
        delBtn.draggable = false;
        delBtn.setAttribute('draggable', 'false');
        delBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="2" y1="2" x2="8" y2="8"/><line x1="8" y1="2" x2="2" y2="8"/></svg>`;
        delBtn.addEventListener('mousedown', e => e.stopPropagation());
        delBtn.addEventListener('click', e => {
          e.stopPropagation();
          e.preventDefault();
          this._confirm(
            `Delete "${p.title}"?`,
            'This will permanently remove all scenes and narration.',
            () => {
              if (scripts.some(sc => sc.id === this.scriptId)) {
                this.scriptId = null;
                State.set('activeScriptId', null);
              }
              State.deleteProject(p.id);
              this._sidebar();
              this._timeline();
              Interactions.toast(`Deleted "${p.title}"`);
            }
          );
        });

        titleRow.appendChild(titleEl);
        titleRow.appendChild(delBtn);
        pEl.appendChild(titleRow);

        /* Multiple scripts — show as sub-list */
        if (scripts.length > 1) {
          scripts.forEach(sc => {
            const scEl = document.createElement('div');
            scEl.className = 'sb-script' + (sc.id === this.scriptId ? ' active' : '');
            scEl.textContent = sc.title;
            scEl.addEventListener('click', () => this._selectScript(sc.id, p.id));
            pEl.appendChild(scEl);
          });
        }

        grpEl.appendChild(pEl);
      });

      list.appendChild(grpEl);
    });
  },

  _updateTimer() {
    const el = this.$('total-time'); if (!el) return;
    el.textContent = this.scriptId ? this.fmt(State.totalDuration(this.scriptId)) : '0:00';
    const timer = this.$('total-timer');
    if (timer) {
      if (this.isOverviewMode) timer.classList.add('overview-active');
      else timer.classList.remove('overview-active');
    }
  },

  _updateVtitle() {
    const el = this.$('sidebar-vtitle'); if (!el) return;
    el.textContent = this.scriptId ? (State.script(this.scriptId)?.title || '') : '';
  },

  _selectScript(scriptId, projectId) {
    this.scriptId = scriptId;
    State.set('activeScriptId', scriptId);
    State.set('activeProjectId', projectId);
    this._sidebar();
    this._timeline();
  },

  /* ═══════════════════════════════════════
     TIMELINE
  ═══════════════════════════════════════ */
  _timeline() {
    const defaultTrack = this.$('timeline-view');
    const overviewTrack = this.$('overview-view');
    const empty = this.$('empty-state');
    
    if (!defaultTrack || !overviewTrack) return;
    
    if (!this.scriptId) {
      this.hide(defaultTrack);
      this.hide(overviewTrack);
      this.show(empty);
      return;
    }
    
    this.hide(empty);
    
    if (this.isOverviewMode) {
      this.hide(defaultTrack);
      this.show(overviewTrack);
      this._renderOverview();
    } else {
      this.show(defaultTrack);
      this.hide(overviewTrack);
      
      const track = this.$('timeline-track');
      const scenes = State.scenes(this.scriptId);
      track.innerHTML = '';
      scenes.forEach((sc, i) => {
        const col = this._sceneCol(sc, i);
        track.appendChild(col);
        track.appendChild(this._insertBtn(sc.orderIndex));
        setTimeout(() => { Interactions.initDrag(sc.id); Interactions.initStepper(sc.id); }, 0);
      });
    }
    
    this._updateTimer();
    this._updateVtitle();
  },

  /* ── Overview Map View ── */
  _renderOverview() {
    const container = this.$('overview-view');
    if (!container) return;
    container.innerHTML = '';

    const scenes = State.scenes(this.scriptId);

    // Scrollable body holding all columns
    const body = document.createElement('div');
    body.className = 'ov-body';

    scenes.forEach((sc, i) => {
      const av = sc.versions.find(v => v.active) || sc.versions[0];
      const dur = sc.actualDuration || State.estimatedDuration(av?.text || '') || 0;

      const col = document.createElement('div');
      col.className = 'ov-col';
      col.addEventListener('click', () => {
        // Exit overview mode, jump to scene
        this.isOverviewMode = false;
        this._timeline();
        setTimeout(() => {
          const domCol = document.querySelector(`.scene-col[data-id="${sc.id}"]`);
          if (domCol) domCol.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }, 100);
      });

      // Large scene number
      const numEl = document.createElement('div');
      numEl.className = 'ov-num';
      numEl.textContent = i + 1;

      // Pipeline time row
      const timeRow = document.createElement('div');
      timeRow.className = 'ov-time-row';
      const timePill = document.createElement('div');
      timePill.className = 'ov-time-pill';
      timePill.textContent = dur ? this.fmt(dur) : '—';
      timeRow.appendChild(timePill);

      // Rotated topic title
      const topicArea = document.createElement('div');
      topicArea.className = 'ov-topic-area';
      const topicEl = document.createElement('div');
      topicEl.className = 'ov-topic';
      topicEl.textContent = sc.title && sc.title.trim() ? sc.title : 'UNTITLED';
      topicArea.appendChild(topicEl);

      // Onscreen completion dots at bottom
      const dotsArea = document.createElement('div');
      dotsArea.className = 'ov-dots-area';
      const dotCount = Math.max(3, (sc.onscreen || []).length);
      for (let j = 0; j < dotCount; j++) {
        const dot = document.createElement('div');
        dot.className = 'ov-dot';
        if (sc.onscreen && sc.onscreen[j] && sc.onscreen[j].checked) {
          dot.classList.add('filled');
        }
        dotsArea.appendChild(dot);
      }

      col.appendChild(numEl);
      col.appendChild(timeRow);
      col.appendChild(topicArea);
      col.appendChild(dotsArea);
      body.appendChild(col);
    });

    container.appendChild(body);
  },


  _insertBtn(afterOrderIndex) {
    const btn = document.createElement('button');
    btn.className = 'insert-btn';
    btn.title = 'Insert scene here';
    btn.innerHTML = `<span class="insert-line"></span><span class="insert-plus">+</span><span class="insert-line"></span>`;
    btn.addEventListener('click', () => {
      const sc = State.createScene(this.scriptId, afterOrderIndex);
      this._timeline();
      requestAnimationFrame(() => {
        const col = document.querySelector(`.scene-col[data-id="${sc.id}"]`);
        Interactions.animateIn(col);
      });
    });
    return btn;
  },

  /* ── Scene Column ── */
  _sceneCol(sc, index) {
    const av = sc.versions.find(v => v.active) || sc.versions[0];
    const est = State.estimatedDuration(av?.text || '');
    const aiCount = sc.versions.filter(v => v.type === 'ai-generated').length;

    const col = document.createElement('div');
    col.className = 'scene-col';
    col.dataset.id = sc.id;

    /* ── Header ── */
    const header = document.createElement('div');
    header.className = 'col-header';
    header.innerHTML = `
      <span class="scene-num">${index + 1}</span>
      <div class="col-actions">
        <button class="col-action-btn btn-delete" title="Delete scene" data-id="${sc.id}">
          <svg width="13" height="14" viewBox="0 0 13 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
            <path d="M1.5 3.5h10M4.5 3.5V2h4v1.5M3 3.5l.7 8h5.6l.7-8"/>
          </svg>
        </button>
        <button class="col-action-btn btn-ai" title="Generate narration for this scene" data-id="${sc.id}">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="7" cy="7" r="5.5"/><circle cx="7" cy="7" r="2"/></svg>
        </button>
        <button class="col-action-btn btn-yt" title="Generate YouTube assets for this script" data-id="${sc.id}">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 3.5l7.5 3.5L2 10.5V3.5z" stroke-linejoin="round"/><path d="M12 2v10"/></svg>
        </button>
        <div class="drag-handle" title="Drag to reorder">
          ${Array(6).fill('<div class="drag-handle-dot"></div>').join('')}
        </div>
        <button class="col-action-btn btn-lock" title="Enter recording mode" data-id="${sc.id}">
          <svg width="13" height="14" viewBox="0 0 13 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
            <rect x="2" y="6" width="9" height="7" rx="1.5"/>
            <path d="M4 6V4a2.5 2.5 0 015 0v2"/>
          </svg>
        </button>
      </div>`;
    col.appendChild(header);

    /* ── Duration row ── */
    const durRow = document.createElement('div');
    durRow.className = 'col-duration';
    durRow.innerHTML = `
      <span class="duration-actual" data-dur-actual="${sc.id}">${sc.actualDuration}</span>
      <span class="duration-estimate" data-dur-est="${sc.id}" title="Estimated narration time from word count">${est}</span>
      <div class="duration-stepper" title="Drag left/right to adjust time">
        ${Array(9).fill('<div class="stepper-bar"></div>').join('')}
      </div>
      <div class="stepper-btns">
        <button class="stepper-btn stepper-plus" title="+5s">▲</button>
        <button class="stepper-btn stepper-minus" title="-5s">▼</button>
      </div>`;
    col.appendChild(durRow);

    /* ── Title + version badge ── */
    const titleWrap = document.createElement('div');
    titleWrap.className = 'col-title-wrap';
    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.className = 'col-title';
    titleInput.value = sc.title;
    titleInput.placeholder = 'SCENE TITLE';
    titleInput.addEventListener('input', () => {
      State.updateScene(sc.id, { title: titleInput.value.toUpperCase() });
    });
    titleWrap.appendChild(titleInput);

    const vBadge = document.createElement('span');
    vBadge.className = 'version-badge' + (aiCount === 0 ? ' hidden' : '');
    vBadge.dataset.vbadge = sc.id;
    vBadge.textContent = sc.versions.length;
    titleWrap.appendChild(vBadge);
    col.appendChild(titleWrap);

    /* ── Narration ── */
    const narDiv = document.createElement('div');
    narDiv.className = 'col-narration';

    // Version controls container
    const verContainer = document.createElement('div');
    verContainer.className = 'version-container';

    // Narration card (bordered box)
    const narCard = document.createElement('div');
    narCard.className = 'narration-card';

    const ta = document.createElement('textarea');
    ta.className = 'narration-text';
    ta.placeholder = 'Write narration…';
    ta.value = av?.text || '';
    ta.addEventListener('input', () => {
      State.updateActiveVersionText(sc.id, ta.value);
      this.refreshDuration(sc.id);
    });
    narCard.appendChild(ta);

    // Build version controls (pass ta for live updates)
    this._buildVersionControls(sc, verContainer, ta);
    narDiv.appendChild(verContainer);
    narDiv.appendChild(narCard);
    col.appendChild(narDiv);

    /* ── ON-SCREEN section ── */
    const onDiv = document.createElement('div');
    onDiv.className = 'col-onscreen';
    const onLbl = document.createElement('div');
    onLbl.className = 'section-label'; onLbl.textContent = 'ON-SCREEN';
    onDiv.appendChild(onLbl);
    const onList = document.createElement('ul');
    onList.className = 'onscreen-list';
    sc.onscreen.forEach(item => onList.appendChild(this._onscreenItem(sc.id, item)));
    onDiv.appendChild(onList);
    const addOnBtn = document.createElement('button');
    addOnBtn.className = 'add-item-btn';
    addOnBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="5" y1="1" x2="5" y2="9"/><line x1="1" y1="5" x2="9" y2="5"/></svg> Add item`;
    addOnBtn.addEventListener('click', () => {
      const item = State.addOnscreen(sc.id, '');
      const li = this._onscreenItem(sc.id, item);
      onList.appendChild(li);
      li.querySelector('input')?.focus();
    });
    onDiv.appendChild(addOnBtn);
    col.appendChild(onDiv);

    /* ── REFERENCES section ── */
    const refDiv = document.createElement('div');
    refDiv.className = 'col-refs';
    const refLbl = document.createElement('div');
    refLbl.className = 'section-label'; refLbl.textContent = 'REFERENCES';
    refDiv.appendChild(refLbl);
    const chipList = document.createElement('div');
    chipList.className = 'refs-list';
    sc.refs.forEach(r => chipList.appendChild(this._refChip(sc.id, r)));
    refDiv.appendChild(chipList);
    const addRefBtn = document.createElement('button');
    addRefBtn.className = 'add-item-btn';
    addRefBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="5" y1="1" x2="5" y2="9"/><line x1="1" y1="5" x2="9" y2="5"/></svg> Add reference`;
    addRefBtn.addEventListener('click', () => this._showRefModal(sc.id, null, null, chipList));
    refDiv.appendChild(addRefBtn);
    col.appendChild(refDiv);

    /* ── Wire column actions ── */
    col.querySelector('.btn-delete').addEventListener('click', () => this._deleteScene(sc.id));
    col.querySelector('.btn-ai').addEventListener('click', () => this._aiPolish(sc.id, col));
    col.querySelector('.btn-yt').addEventListener('click', () => this._showYTModal(this.scriptId));
    col.querySelector('.btn-lock').addEventListener('click', () => this._enterRec(index));

    return col;
  },

  /* ── Version Controls (✕ ↓ ↑ +) ── */
  _buildVersionControls(sc, container, ta) {
    container.innerHTML = '';
    const versions = sc.versions;
    const activeIdx = versions.findIndex(v => v.active);
    const active = versions[activeIdx];

    // Only show controls if there's more than the original
    if (versions.length <= 1) return;

    const row = document.createElement('div');
    row.className = 'version-controls';

    // ✕ Delete this version
    const delBtn = document.createElement('button');
    delBtn.className = 'ver-btn' + (active?.type === 'original' ? '' : ' destructive');
    delBtn.title = active?.type === 'original' ? 'Cannot delete original' : 'Delete this version';
    delBtn.disabled = active?.type === 'original';
    delBtn.innerHTML = '✕';
    delBtn.addEventListener('click', () => {
      if (active?.type === 'original') return;
      const newVersions = sc.versions.filter(v => v.id !== active.id);
      const newActiveIdx = Math.max(0, activeIdx - 1);
      newVersions[newActiveIdx].active = true;
      State.updateScene(sc.id, { versions: newVersions });
      const updSc = State.scene(sc.id);
      if (ta) ta.value = updSc.versions.find(v => v.active)?.text || '';
      this._buildVersionControls(updSc, container, ta);
      this._refreshVersionBadge(sc.id);
      this.refreshDuration(sc.id);
    });
    row.appendChild(delBtn);

    // ↓ Previous version
    const prevBtn = document.createElement('button');
    prevBtn.className = 'ver-btn';
    prevBtn.title = 'Previous version';
    prevBtn.disabled = activeIdx <= 0;
    prevBtn.innerHTML = '↓';
    prevBtn.addEventListener('click', () => {
      State.setActiveVersion(sc.id, versions[activeIdx - 1].id);
      const updSc = State.scene(sc.id);
      if (ta) ta.value = updSc.versions.find(v => v.active)?.text || '';
      this._buildVersionControls(updSc, container, ta);
      this.refreshDuration(sc.id);
    });
    row.appendChild(prevBtn);

    // ↑ Next version
    const nextBtn = document.createElement('button');
    nextBtn.className = 'ver-btn';
    nextBtn.title = 'Next version';
    nextBtn.disabled = activeIdx >= versions.length - 1;
    nextBtn.innerHTML = '↑';
    nextBtn.addEventListener('click', () => {
      State.setActiveVersion(sc.id, versions[activeIdx + 1].id);
      const updSc = State.scene(sc.id);
      if (ta) ta.value = updSc.versions.find(v => v.active)?.text || '';
      this._buildVersionControls(updSc, container, ta);
      this.refreshDuration(sc.id);
    });
    row.appendChild(nextBtn);

    // + Write new blank version
    const addBtn = document.createElement('button');
    addBtn.className = 'ver-btn';
    addBtn.title = 'Write new version';
    addBtn.innerHTML = '+';
    addBtn.addEventListener('click', () => {
      State.addVersion(sc.id, '', 'ai-generated');
      const updSc = State.scene(sc.id);
      if (ta) { ta.value = ''; ta.focus(); }
      this._buildVersionControls(updSc, container, ta);
      this._refreshVersionBadge(sc.id);
    });
    row.appendChild(addBtn);

    // Version label
    const lbl = document.createElement('span');
    lbl.className = 'ver-label';
    const name = active?.type === 'original' ? 'Original' : `AI v${activeIdx}`;
    lbl.textContent = `${name} · ${activeIdx + 1}/${versions.length}`;
    row.appendChild(lbl);

    container.appendChild(row);
  },

  _refreshVersionBadge(sceneId) {
    const badge = document.querySelector(`[data-vbadge="${sceneId}"]`);
    const sc = State.scene(sceneId);
    if (!badge || !sc) return;
    const aiCount = sc.versions.filter(v => v.type === 'ai-generated').length;
    badge.textContent = sc.versions.length;
    if (aiCount > 0) badge.classList.remove('hidden');
    else badge.classList.add('hidden');
  },

  /* Onscreen checklist item */
  _onscreenItem(sceneId, item) {
    const li = document.createElement('li');
    li.className = 'onscreen-item';
    const chk = document.createElement('input');
    chk.type = 'checkbox'; chk.className = 'onscreen-check'; chk.checked = item.checked;
    chk.addEventListener('change', () => State.updateOnscreen(sceneId, item.id, { checked: chk.checked }));
    const inp = document.createElement('input');
    inp.type = 'text'; inp.className = 'onscreen-input'; inp.value = item.text; inp.placeholder = 'On-screen text…';
    inp.addEventListener('input', () => State.updateOnscreen(sceneId, item.id, { text: inp.value }));
    const del = document.createElement('button');
    del.className = 'onscreen-del'; del.textContent = '✕';
    del.addEventListener('click', () => { li.remove(); State.deleteOnscreen(sceneId, item.id); });
    li.appendChild(chk); li.appendChild(inp); li.appendChild(del);
    return li;
  },

  /* Reference chip — click to edit */
  _refChip(sceneId, ref) {
    const chip = document.createElement('div');
    chip.className = 'ref-chip';
    chip.dataset.refId = ref.id;

    const label = document.createElement('span');
    label.textContent = ref.text || ref.url || 'Reference';
    if (ref.url) label.title = ref.url;
    chip.appendChild(label);

    // Click chip to edit
    chip.addEventListener('click', () => {
      const chipList = chip.parentElement;
      this._showRefModal(sceneId, ref.id, chip, chipList);
    });

    // Del button (shown on hover via CSS)
    const del = document.createElement('button');
    del.className = 'ref-del'; del.textContent = '✕';
    del.addEventListener('click', e => {
      e.stopPropagation();
      chip.remove();
      State.deleteRef(sceneId, ref.id);
    });
    chip.appendChild(del);
    return chip;
  },

  /* Live duration refresh */
  refreshDuration(sceneId) {
    const sc = State.scene(sceneId); if (!sc) return;
    const av = sc.versions.find(v => v.active) || sc.versions[0];
    const est = State.estimatedDuration(av?.text || '');
    const actEl = document.querySelector(`[data-dur-actual="${sceneId}"]`);
    const estEl = document.querySelector(`[data-dur-est="${sceneId}"]`);
    if (actEl) actEl.textContent = sc.actualDuration;
    if (estEl) estEl.textContent = est;
    this._updateTimer();
  },

  /* ═══════════════════════════════════════
     SCENE DELETION
  ═══════════════════════════════════════ */
  _deleteScene(sceneId) {
    const sc = State.deleteScene(sceneId);
    this._timeline();
    if (!sc) return;
    Interactions.toast(`Deleted "${sc.title}"`, () => {
      State.d.scenes.push(sc);
      State._reindex(sc.scriptId);
      State._save();
      this._timeline();
    });
  },

  /* ═══════════════════════════════════════
     AI POLISH
  ═══════════════════════════════════════ */
  async _aiPolish(sceneId, col) {
    const btn = col.querySelector('.btn-ai');
    const narDiv = col.querySelector('.col-narration');
    if (!btn || !narDiv) return;
    btn.style.color = '#f0a500';
    btn.disabled = true;
    const loader = document.createElement('div');
    loader.className = 'ai-loading';
    loader.innerHTML = `<span class="spinner"></span> Polishing…`;
    const narCard = col.querySelector('.narration-card');
    narDiv.insertBefore(loader, narCard || narDiv.firstChild);
    try {
      await AI.polishNarration(sceneId);
      const updSc = State.scene(sceneId);
      const ta = col.querySelector('.narration-text');
      if (ta) ta.value = updSc.versions.find(v => v.active)?.text || '';
      const verContainer = col.querySelector('.version-container');
      if (verContainer && ta) this._buildVersionControls(updSc, verContainer, ta);
      this._refreshVersionBadge(sceneId);
      this.refreshDuration(sceneId);
      Interactions.toast('AI version added ✓');
    } catch(e) {
      Interactions.toast('AI Error: ' + e.message);
    } finally {
      loader.remove();
      btn.style.color = '';
      btn.disabled = false;
    }
  },



  /* ═══════════════════════════════════════
     RECORDING MODE (Dark Timeline)
  ═══════════════════════════════════════ */
  _enterRec(startIdx = 0) {
    if (!this.scriptId) return;
    this.recIdx = startIdx;
    this.$('recording-mode').classList.remove('hidden');
    this._buildRecTrack();
    this._scrollRecToScene(this.recIdx);

    this.$('rec-prev').onclick = () => this.recPrev();
    this.$('rec-next').onclick = () => this.recNext();
    this.$('rec-exit').onclick  = () => this.exitRec();

    // Keyboard nav
    this._recKeyHandler = (e) => {
      if (e.key === 'ArrowLeft')  this.recPrev();
      if (e.key === 'ArrowRight') this.recNext();
      if (e.key === 'Escape')     this.exitRec();
    };
    document.addEventListener('keydown', this._recKeyHandler);
  },

  exitRec() {
    this.$('recording-mode').classList.add('hidden');
    if (this._recKeyHandler) {
      document.removeEventListener('keydown', this._recKeyHandler);
      this._recKeyHandler = null;
    }
  },

  recNext() {
    const scenes = State.scenes(this.scriptId);
    if (this.recIdx < scenes.length - 1) {
      this.recIdx++;
      this._scrollRecToScene(this.recIdx);
    }
  },

  recPrev() {
    if (this.recIdx > 0) {
      this.recIdx--;
      this._scrollRecToScene(this.recIdx);
    }
  },

  /* Build all scene columns for the dark timeline */
  _buildRecTrack() {
    const track = this.$('rec-track');
    if (!track) return;
    track.innerHTML = '';

    const scenes = State.scenes(this.scriptId);
    const total  = scenes.length;

    scenes.forEach((sc, i) => {
      const av  = sc.versions.find(v => v.active) || sc.versions[0];
      const est = State.estimatedDuration(av?.text || '');

      const col = document.createElement('div');
      col.className = 'rec-col';
      col.dataset.recIdx = i;

      /* Header row: number + lock icon */
      col.innerHTML = `
        <div class="rc-header">
          <span class="rc-num">${i + 1}</span>
          <div class="rc-header-right">
            <svg class="rc-lock-icon" width="13" height="14" viewBox="0 0 13 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
              <rect x="2" y="6" width="9" height="7" rx="1.5"/>
              <path d="M4 6V4a2.5 2.5 0 015 0v2"/>
            </svg>
          </div>
        </div>
        <div class="rc-dur-row">
          <span class="rc-dur-actual">${sc.actualDuration}</span>
          <span class="rc-dur-est">${est}</span>
        </div>
        <div class="rc-title">${sc.title || 'UNTITLED'}</div>
        <div class="rc-narration">${av?.text || ''}</div>`;

      /* ON-SCREEN section */
      if (sc.onscreen && sc.onscreen.length) {
        const onDiv = document.createElement('div');
        onDiv.className = 'rc-section';
        onDiv.innerHTML = `<div class="rc-section-label">ON-SCREEN</div>`;
        sc.onscreen.forEach(item => {
          const row = document.createElement('div');
          row.className = 'rc-onscreen-item' + (item.checked ? ' checked' : '');
          row.innerHTML = `<span class="rc-check-dot${item.checked ? ' filled' : ''}"></span><span>${item.text}</span>`;
          onDiv.appendChild(row);
        });
        col.appendChild(onDiv);
      }

      /* REFERENCES section */
      if (sc.refs && sc.refs.length) {
        const refDiv = document.createElement('div');
        refDiv.className = 'rc-section';
        refDiv.innerHTML = `<div class="rc-section-label">REFERENCES</div>`;
        sc.refs.forEach(ref => {
          const chip = document.createElement('div');
          chip.className = 'rc-ref-chip';
          chip.textContent = ref.text || ref.url || 'Reference';
          if (ref.url) {
            chip.style.cursor = 'pointer';
            chip.title = ref.url;
          }
          refDiv.appendChild(chip);
        });
        col.appendChild(refDiv);
      }

      /* Click to navigate to that scene */
      col.addEventListener('click', () => {
        this.recIdx = i;
        this._scrollRecToScene(i);
      });

      track.appendChild(col);
    });

    this._updateRecCounter();
  },

  _scrollRecToScene(idx) {
    const track  = this.$('rec-track');
    if (!track) return;

    // Update active highlight
    track.querySelectorAll('.rec-col').forEach((col, i) => {
      col.classList.toggle('rec-col-active', i === idx);
    });

    // Smooth scroll the active column into view
    const activeCol = track.querySelector(`.rec-col[data-rec-idx="${idx}"]`);
    if (activeCol) {
      activeCol.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
    }

    this.recIdx = idx;
    this._updateRecCounter();
  },

  _updateRecCounter() {
    const scenes = State.scenes(this.scriptId);
    const el = this.$('rec-counter');
    if (el) el.textContent = `${this.recIdx + 1} / ${scenes.length}`;
  },



  /* ═══════════════════════════════════════
     MODALS
  ═══════════════════════════════════════ */
  _showModal(modalId, context) {
    this.show(this.$('modal-overlay'));
    ['modal-project','modal-script','modal-settings','modal-youtube','modal-ref'].forEach(id => this.hide(this.$(id)));
    this.show(this.$(modalId));
    if (modalId === 'modal-script') this._pendingProjectIdForScript = context;
    if (modalId === 'modal-settings') {
      const inp = this.$('inp-api-key');
      if (inp) inp.value = State.get('apiKey') || '';
    }
  },
  _closeModals() {
    this.hide(this.$('modal-overlay'));
    ['modal-project','modal-script','modal-settings','modal-youtube','modal-ref','modal-confirm'].forEach(id => this.hide(this.$(id)));
    this._pendingSceneIdForRef = null;
    this._pendingRefId = null;
    this._pendingChipEl = null;
    this._pendingConfirmCb = null;
  },

  /* Custom confirm dialog — replaces window.confirm() which is blocked in file:// */
  _confirm(title, subtitle, onYes) {
    this.$('modal-confirm-msg').textContent = title;
    this.$('modal-confirm-sub').textContent = subtitle || '';
    this._pendingConfirmCb = onYes;
    this._showModal('modal-confirm');
  },

  _showYTModal(scriptId) {
    this._showModal('modal-youtube');
    const out = this.$('yt-output');
    out.innerHTML = `<div class="yt-loading"><span class="spinner"></span> Generating…</div>`;
    AI.generateYouTubeAssets(scriptId).then(data => {
      out.innerHTML = `
        <div class="yt-section"><h4>Description</h4><div class="yt-desc">${data.description}</div></div>
        <div class="yt-section"><h4>Tags</h4><div class="yt-tags">${data.tags.map(t=>`<span class="yt-tag">${t}</span>`).join('')}</div></div>
        <div class="yt-section"><h4>Alternate Titles (A/B)</h4><div class="yt-alt-title">${data.alternateTitles.map(t=>`<div class="yt-alt-item"><strong>${t.title}</strong><span>${t.rationale}</span></div>`).join('')}</div></div>`;
    }).catch(e => {
      out.innerHTML = `<div style="color:#e53e3e;padding:16px 0">Error: ${e.message}</div>`;
    });
  },

  /* Reference modal — add or edit mode */
  _showRefModal(sceneId, refId, chipEl, chipList) {
    this._pendingSceneIdForRef = sceneId;
    this._pendingRefId = refId;     // null = add, string = edit
    this._pendingChipEl = chipEl;
    this._pendingChipList = chipList;

    const isEdit = !!refId;
    const titleEl = this.$('modal-ref-title');
    const delBtn  = this.$('btn-delete-ref');
    const saveBtn = this.$('btn-save-ref');
    const textInp = this.$('inp-ref-text');
    const urlInp  = this.$('inp-ref-url');

    if (titleEl) titleEl.textContent = isEdit ? 'EDIT REFERENCE' : 'ADD REFERENCE';
    if (delBtn)  { isEdit ? delBtn.classList.remove('hidden') : delBtn.classList.add('hidden'); }
    if (saveBtn) saveBtn.textContent = isEdit ? 'Save' : 'Add';

    if (isEdit) {
      const sc = State.scene(sceneId);
      const ref = sc?.refs.find(r => r.id === refId);
      if (textInp) textInp.value = ref?.text || '';
      if (urlInp)  urlInp.value  = ref?.url  || '';
    } else {
      if (textInp) textInp.value = '';
      if (urlInp)  urlInp.value  = '';
    }

    this._showModal('modal-ref');
    setTimeout(() => textInp?.focus(), 80);
  },

  _modals() {
    /* Cancel all modals */
    document.querySelectorAll('.modal-cancel').forEach(btn => {
      btn.addEventListener('click', () => this._closeModals());
    });
    document.getElementById('modal-overlay').addEventListener('click', e => {
      if (e.target === e.currentTarget) this._closeModals();
    });

    /* Custom confirm modal wiring */
    this.$('btn-confirm-cancel')?.addEventListener('click', () => this._closeModals());
    this.$('btn-confirm-yes')?.addEventListener('click', () => {
      const cb = this._pendingConfirmCb;
      this._closeModals();
      if (cb) cb();
    });

    /* Create project — one step: creates project + default script, opens immediately */
    this.$('btn-new-project')?.addEventListener('click', () => {
      this.$('inp-project-title').value = '';
      this.$('modal-project-heading').textContent = 'NEW PROJECT';
      this._showModal('modal-project');
      setTimeout(() => this.$('inp-project-title')?.focus(), 80);
    });
    this.$('btn-create-project')?.addEventListener('click', () => {
      const title = this.$('inp-project-title')?.value?.trim();
      if (!title) return;
      const project = State.createProject(title);
      const script  = State.createScript(project.id, title);  // same name as default
      State.createScene(script.id);                           // Auto-create blank first scene
      this._selectScript(script.id, project.id);              // open it immediately
      this._closeModals();
      Interactions.toast(`Created "${project.title}" ✓`);
    });
    this.$('inp-project-title')?.addEventListener('keydown', e => { if (e.key==='Enter') this.$('btn-create-project').click(); });


    /* Create script */
    this.$('btn-create-script')?.addEventListener('click', () => {
      const title = this.$('inp-script-title')?.value?.trim();
      const pid = this._pendingProjectIdForScript;
      if (!title || !pid) return;
      const sc = State.createScript(pid, title);
      State.createScene(sc.id); // Auto-create blank first scene here too
      this._selectScript(sc.id, pid);
      this._closeModals();
    });
    this.$('inp-script-title')?.addEventListener('keydown', e => { if (e.key==='Enter') this.$('btn-create-script').click(); });

    /* Settings */
    this.$('btn-settings')?.addEventListener('click', () => {
      // Show/hide danger zone based on active script
      const danger = this.$('settings-danger');
      const nameEl = this.$('settings-danger-script-name');
      if (this.scriptId && danger) {
        const sc = State.script(this.scriptId);
        if (nameEl) nameEl.textContent = `Delete "${sc?.title || 'script'}"`;
        danger.classList.remove('hidden');
      } else if (danger) {
        danger.classList.add('hidden');
      }
      this._showModal('modal-settings');
    });
    this.$('btn-save-settings')?.addEventListener('click', () => {
      State.set('apiKey', this.$('inp-api-key')?.value?.trim() || '');
      this._closeModals();
      Interactions.toast('API key saved');
    });

    /* Delete script from settings — uses custom confirm */
    this.$('btn-delete-script')?.addEventListener('click', () => {
      if (!this.scriptId) return;
      const sc = State.script(this.scriptId);
      const name = sc?.title || 'script';
      this._confirm(
        `Delete "${name}"?`,
        'This will permanently remove all scenes and narration.',
        () => {
          State.deleteScript(this.scriptId);
          this.scriptId = null;
          State.set('activeScriptId', null);
          this._sidebar();
          this._timeline();
          Interactions.toast(`Deleted "${name}"`);
        }
      );
    });


    /* Reference save (add or edit) */
    this.$('btn-save-ref')?.addEventListener('click', () => {
      const text  = this.$('inp-ref-text')?.value?.trim() || '';
      const url   = this.$('inp-ref-url')?.value?.trim()  || '';
      const sceneId = this._pendingSceneIdForRef;
      const refId   = this._pendingRefId;
      if (!text && !url) { this._closeModals(); return; }

      if (refId) {
        // Edit mode
        State.updateReference ? State.updateReference(sceneId, refId, { text, url }) : null;
        // fallback: update via full write
        const sc = State.scene(sceneId);
        if (sc) {
          const newRefs = sc.refs.map(r => r.id === refId ? { ...r, text, url } : r);
          State.updateScene(sceneId, { refs: newRefs });
        }
        // Update the chip label
        if (this._pendingChipEl) {
          const lbl = this._pendingChipEl.querySelector('span');
          if (lbl) { lbl.textContent = text || url || 'Reference'; lbl.title = url; }
        }
      } else {
        // Add mode
        const ref = State.addRef(sceneId, text, url);
        this._pendingChipList?.appendChild(this._refChip(sceneId, ref));
      }
      this._closeModals();
    });
    this.$('inp-ref-text')?.addEventListener('keydown', e => { if (e.key==='Enter') this.$('btn-save-ref').click(); });

    /* Reference delete */
    this.$('btn-delete-ref')?.addEventListener('click', () => {
      const sceneId = this._pendingSceneIdForRef;
      const refId   = this._pendingRefId;
      if (sceneId && refId) {
        State.deleteRef(sceneId, refId);
        this._pendingChipEl?.remove();
      }
      this._closeModals();
      Interactions.toast('Reference deleted');
    });
  },

  /* ── Global buttons ── */
  _globalBtns() {
    document.querySelector('#modal-youtube .modal-cancel')?.addEventListener('click', () => this._closeModals());

    /* ── Pencil / Rail dropdown menu ── */
    const menuBtn  = this.$('btn-rail-menu');
    const dropdown = this.$('rail-dropdown');

    // Toggle open/close
    menuBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = !dropdown.classList.contains('hidden');
      if (isOpen) {
        this._closeRailMenu();
        return;
      }
      // Position dropdown to the right of the sidebar, aligned with the button
      const btnRect = menuBtn.getBoundingClientRect();
      const sidebar = document.getElementById('sidebar');
      const sidebarRect = sidebar.getBoundingClientRect();
      dropdown.style.top  = btnRect.top + 'px';
      dropdown.style.left = (sidebarRect.right + 8) + 'px';
      dropdown.classList.remove('hidden');
      menuBtn.classList.add('active');
    });

    // Close on outside click
    document.addEventListener('click', () => this._closeRailMenu());
    dropdown?.addEventListener('click', e => e.stopPropagation());

    // Wire each action
    dropdown?.querySelectorAll('.rdrop-item').forEach(btn => {
      btn.addEventListener('click', () => {
        this._closeRailMenu();
        const action = btn.dataset.action;
        if      (action === 'youtube')      this._showYTModal(this.scriptId);
        else if (action === 'generate-all') this._generateAll();
        else if (action === 'lock-all')     this._lockAll();
        else if (action === 'unlock-all')   this._unlockAll();
        else if (action === 'export')       this._exportData();
        else if (action === 'import')       this.$('import-file-input')?.click();
      });
    });

    // Import file handler
    this.$('import-file-input')?.addEventListener('change', e => {
      const file = e.target.files?.[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const data = JSON.parse(ev.target.result);
          if (!data.projects || !data.scenes) throw new Error('Invalid format');
          localStorage.setItem('scriptapp_v2', JSON.stringify(data));
          location.reload();
        } catch(err) {
          Interactions.toast('Import failed: ' + err.message);
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });
  },

  _closeRailMenu() {
    this.$('rail-dropdown')?.classList.add('hidden');
    this.$('btn-rail-menu')?.classList.remove('active');
  },

  /* ── Generate all narrations (unlocked scenes) ── */
  async _generateAll() {
    if (!this.scriptId) return;
    const key = State.get('apiKey');
    if (!key) { Interactions.toast('Add Gemini API key in Settings first'); return; }
    const scenes = State.scenes(this.scriptId);
    Interactions.toast(`Polishing ${scenes.length} scenes…`);
    for (const sc of scenes) {
      try {
        await AI.polishNarration(sc.id);
        // Update the UI for this scene
        const col = document.querySelector(`.scene-col[data-id="${sc.id}"]`);
        if (col) {
          const updSc = State.scene(sc.id);
          const ta = col.querySelector('.narration-text');
          if (ta) ta.value = updSc.versions.find(v => v.active)?.text || '';
          const vc = col.querySelector('.version-container');
          if (vc && ta) this._buildVersionControls(updSc, vc, ta);
          this._refreshVersionBadge(sc.id);
          this.refreshDuration(sc.id);
        }
      } catch(e) { /* skip failed scenes */ }
    }
    Interactions.toast('All scenes polished ✓');
  },

  /* ── Lock / Unlock all (enter / exit recording mode) ── */
  _lockAll() {
    if (!this.scriptId) return;
    this._enterRec(0);
    Interactions.toast('Recording mode — use ← → to navigate');
  },
  _unlockAll() {
    this.exitRec();
    Interactions.toast('Exited recording mode');
  },

  /* ── Export JSON ── */
  _exportData() {
    const data = JSON.stringify(State.d, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const name = this.scriptId ? (State.script(this.scriptId)?.title || 'scriptapp') : 'scriptapp';
    a.href     = url;
    a.download = `${name.toLowerCase().replace(/\s+/g,'-')}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    Interactions.toast('Exported ✓');
  },

}; /* end UI */

/* Bootstrap */
document.addEventListener('DOMContentLoaded', () => UI.init());

