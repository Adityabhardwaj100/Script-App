'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { State } from '../lib/state.js';
import { AI } from '../lib/ai.js';

function fmt(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/* ── Version Controls ── */
function VersionControls({ sceneId, onVersionChange }) {
  const sc = State.scene(sceneId);
  if (!sc || sc.versions.length <= 1) return null;

  const versions   = sc.versions;
  const activeIdx  = versions.findIndex(v => v.active);
  const active     = versions[activeIdx];

  const handleDel = () => {
    if (active?.type === 'original') return;
    const newVersions = sc.versions.filter(v => v.id !== active.id);
    newVersions[Math.max(0, activeIdx - 1)].active = true;
    State.updateScene(sceneId, { versions: newVersions });
    onVersionChange();
  };
  const handlePrev = () => {
    State.setActiveVersion(sceneId, versions[activeIdx - 1].id);
    onVersionChange();
  };
  const handleNext = () => {
    State.setActiveVersion(sceneId, versions[activeIdx + 1].id);
    onVersionChange();
  };
  const handleAdd = () => {
    State.addVersion(sceneId, '', 'ai-generated');
    onVersionChange();
  };

  const name = active?.type === 'original' ? 'Original' : `AI v${activeIdx}`;

  return (
    <div className="version-controls">
      <button
        className={`ver-btn${active?.type !== 'original' ? ' destructive' : ''}`}
        title={active?.type === 'original' ? 'Cannot delete original' : 'Delete this version'}
        disabled={active?.type === 'original'}
        onClick={handleDel}
      >✕</button>

      <button className="ver-btn" title="Previous version" disabled={activeIdx <= 0} onClick={handlePrev}>
        ↓
      </button>

      <button className="ver-btn" title="Next version" disabled={activeIdx >= versions.length - 1} onClick={handleNext}>
        ↑
      </button>

      <button className="ver-btn" title="Write new version" onClick={handleAdd}>+</button>

      <span className="ver-label">{name} · {activeIdx + 1}/{versions.length}</span>
    </div>
  );
}

/* ── OnScreen Item ── */
function OnscreenItem({ sceneId, item, onDelete }) {
  const [checked, setChecked] = useState(item.checked);
  const [text, setText]       = useState(item.text);

  const handleCheck = (e) => {
    setChecked(e.target.checked);
    State.updateOnscreen(sceneId, item.id, { checked: e.target.checked });
  };
  const handleText = (e) => {
    setText(e.target.value);
    State.updateOnscreen(sceneId, item.id, { text: e.target.value });
  };

  return (
    <li className="onscreen-item">
      <input
        type="checkbox"
        className="onscreen-check"
        checked={checked}
        onChange={handleCheck}
      />
      <input
        type="text"
        className="onscreen-input"
        value={text}
        placeholder="On-screen text…"
        onChange={handleText}
      />
      <button className="onscreen-del" onClick={onDelete}>✕</button>
    </li>
  );
}

/* ── Main SceneColumn ── */
export default function SceneColumn({
  sceneId,
  index,
  scriptId,
  onRefresh,
  onDelete,
  onEnterRec,
  onShowYTModal,
  onShowRefModal,
  onToast,
}) {
  /* force local re-render (version changes, onscreen changes) */
  const [localKey, setLocalKey] = useState(0);
  const [isPolishing, setIsPolishing] = useState(false);
  const colRef   = useRef(null);
  const dragRef  = useRef(null);
  const taRef    = useRef(null);

  const localRefresh = useCallback(() => setLocalKey(k => k + 1), []);

  const sc = State.scene(sceneId);
  if (!sc) return null;

  const av  = sc.versions.find(v => v.active) || sc.versions[0];
  const est = State.estimatedDuration(av?.text || '');
  const aiCount = sc.versions.filter(v => v.type === 'ai-generated').length;

  /* ── Duration stepper (pointer drag) ── */
  const stepperRef   = useRef(null);
  const durActualRef = useRef(null);
  const durEstRef    = useRef(null);

  const updateDurDisplay = useCallback(() => {
    const latest = State.scene(sceneId);
    if (!latest) return;
    const latestAv  = latest.versions.find(v => v.active) || latest.versions[0];
    const latestEst = State.estimatedDuration(latestAv?.text || '');
    if (durActualRef.current) durActualRef.current.textContent = latest.actualDuration;
    if (durEstRef.current)    durEstRef.current.textContent    = latestEst;
  }, [sceneId]);

  useEffect(() => {
    const stepper = stepperRef.current;
    if (!stepper) return;

    let startX = 0, startDur = 0;

    const onDown = (e) => {
      startX = e.clientX;
      startDur = State.scene(sceneId)?.actualDuration ?? 30;
      stepper.classList.add('active');
      stepper.setPointerCapture(e.pointerId);

      const onMove = (e2) => {
        const delta = Math.round((e2.clientX - startX) / 10) * 5;
        const nd    = Math.max(5, startDur + delta);
        if (State.scene(sceneId)?.actualDuration !== nd) {
          State.updateScene(sceneId, { actualDuration: nd });
          updateDurDisplay();
          /* update total timer */
          const timerEl = document.getElementById('total-time');
          if (timerEl) timerEl.textContent = fmt(State.totalDuration(scriptId));
        }
      };
      const onUp = () => {
        stepper.classList.remove('active');
        stepper.removeEventListener('pointermove', onMove);
        stepper.removeEventListener('pointerup', onUp);
      };
      stepper.addEventListener('pointermove', onMove);
      stepper.addEventListener('pointerup', onUp);
    };

    stepper.addEventListener('pointerdown', onDown);
    return () => stepper.removeEventListener('pointerdown', onDown);
  }, [sceneId, scriptId, updateDurDisplay]);

  const handleStepUp = () => {
    const sc2 = State.scene(sceneId); if (!sc2) return;
    State.updateScene(sceneId, { actualDuration: sc2.actualDuration + 5 });
    updateDurDisplay();
    const timerEl = document.getElementById('total-time');
    if (timerEl) timerEl.textContent = fmt(State.totalDuration(scriptId));
  };
  const handleStepDown = () => {
    const sc2 = State.scene(sceneId); if (!sc2) return;
    State.updateScene(sceneId, { actualDuration: Math.max(5, sc2.actualDuration - 5) });
    updateDurDisplay();
    const timerEl = document.getElementById('total-time');
    if (timerEl) timerEl.textContent = fmt(State.totalDuration(scriptId));
  };

  /* ── Column drag-reorder ── */
  useEffect(() => {
    const col    = colRef.current;
    const handle = col?.querySelector('.drag-handle');
    if (!col || !handle) return;

    const onPointerDown = (e) => {
      e.preventDefault();
      const track    = document.getElementById('timeline-track');
      if (!track) return;
      const colRect  = col.getBoundingClientRect();
      const cols     = [...track.querySelectorAll('.scene-col')];

      dragRef.current = {
        sceneId, col, track, cols,
        startX:  e.clientX,
        offsetX: e.clientX - colRect.left,
        fromIdx: cols.indexOf(col),
        toIdx:   cols.indexOf(col),
        active:  false,
      };

      col.setPointerCapture(e.pointerId);
      col.addEventListener('pointermove', onPointerMove);
      col.addEventListener('pointerup',   onPointerUp);
    };

    const onPointerMove = (e) => {
      const d = dragRef.current; if (!d) return;
      const delta = Math.abs(e.clientX - d.startX);

      if (!d.active && delta > 6) {
        d.active = true;
        d.col.classList.add('dragging');
        d.col.style.position = 'relative';
        d.col.style.zIndex   = '99';
      }
      if (!d.active) return;

      const trackRect = d.track.getBoundingClientRect();
      const relX = e.clientX - trackRect.left + d.track.scrollLeft - d.offsetX;
      d.col.style.transform = `translateX(${relX - d.col.offsetLeft}px)`;

      const siblings = d.cols.filter(c => c !== d.col);
      let newIdx = siblings.length;
      for (let i = 0; i < siblings.length; i++) {
        const r = siblings[i].getBoundingClientRect();
        if (e.clientX < r.left + r.width * 0.5) { newIdx = i; break; }
      }

      const insertIdx  = d.fromIdx <= newIdx ? newIdx + 1 : newIdx;
      d.toSibIdx = newIdx;
      d.toIdx    = d.fromIdx <= newIdx ? newIdx + 1 : newIdx;

      if (insertIdx !== d._lastInsertIdx) {
        d._lastInsertIdx = insertIdx;
        const colW = d.col.offsetWidth;
        siblings.forEach((c, sibI) => {
          let shift = 0;
          if (d.fromIdx < insertIdx) {
            if (sibI >= d.fromIdx && sibI < newIdx) shift = -colW;
          } else {
            if (sibI >= newIdx && sibI < d.fromIdx) shift = colW;
          }
          c.style.transition = 'transform 200ms cubic-bezier(0.4,0,0.2,1)';
          c.style.transform  = `translateX(${shift}px)`;
        });
      }
    };

    const onPointerUp = () => {
      const d = dragRef.current; if (!d) return;
      col.removeEventListener('pointermove', onPointerMove);
      col.removeEventListener('pointerup',   onPointerUp);

      if (d.active) {
        d.col.classList.remove('dragging');
        d.col.style.position  = '';
        d.col.style.zIndex    = '';
        d.col.style.transform = '';
        d.cols.filter(c => c !== d.col).forEach(c => {
          c.style.transition = '';
          c.style.transform  = '';
        });
        const finalIdx = d.toIdx ?? d.fromIdx;
        if (finalIdx !== d.fromIdx) {
          State.moveScene(d.sceneId, finalIdx);
          onRefresh();
        }
      }
      dragRef.current = null;
    };

    handle.addEventListener('pointerdown', onPointerDown);
    return () => handle.removeEventListener('pointerdown', onPointerDown);
  }, [sceneId, onRefresh]);

  /* ── AI Polish ── */
  const handleAiPolish = async () => {
    const key = State.get('apiKey');
    if (!key) { onToast('Add Gemini API key in Settings first'); return; }
    setIsPolishing(true);
    try {
      await AI.polishNarration(sceneId);
      const updSc = State.scene(sceneId);
      if (taRef.current) taRef.current.value = updSc.versions.find(v => v.active)?.text || '';
      localRefresh();
      const timerEl = document.getElementById('total-time');
      if (timerEl) timerEl.textContent = fmt(State.totalDuration(scriptId));
      onToast('AI version added ✓');
    } catch (e) {
      onToast('AI Error: ' + e.message);
    } finally {
      setIsPolishing(false);
    }
  };

  /* ── Delete scene ── */
  const handleDelete = () => {
    onDelete(sceneId);
  };

  /* ── Onscreen items state (local) ── */
  const [onscreenItems, setOnscreenItems] = useState(() => sc.onscreen || []);

  // Sync from State when localKey changes (e.g. after parent refresh)
  useEffect(() => {
    const latest = State.scene(sceneId);
    if (latest) setOnscreenItems(latest.onscreen || []);
  }, [sceneId, localKey]);

  const handleAddOnscreen = () => {
    const item = State.addOnscreen(sceneId, '');
    const latest = State.scene(sceneId);
    setOnscreenItems(latest.onscreen || []);
    /* focus last input next tick */
    setTimeout(() => {
      const col = colRef.current;
      if (!col) return;
      const inputs = col.querySelectorAll('.onscreen-input');
      inputs[inputs.length - 1]?.focus();
    }, 30);
  };

  const handleDeleteOnscreen = (itemId) => {
    State.deleteOnscreen(sceneId, itemId);
    const latest = State.scene(sceneId);
    setOnscreenItems(latest.onscreen || []);
  };

  /* ── Refs (chips) — render from State ── */
  const refs = State.scene(sceneId)?.refs || [];

  return (
    <div className="scene-col" data-id={sceneId} ref={colRef}>

      {/* ── Header ── */}
      <div className="col-header">
        <span className="scene-num">{index + 1}</span>
        <div className="col-actions">
          <button
            className="col-action-btn btn-delete"
            title="Delete scene"
            data-id={sceneId}
            onClick={handleDelete}
          >
            <svg width="13" height="14" viewBox="0 0 13 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M1.5 3.5h10M4.5 3.5V2h4v1.5M3 3.5l.7 8h5.6l.7-8"/>
            </svg>
          </button>

          <button
            className="col-action-btn btn-ai"
            title="Generate narration for this scene"
            data-id={sceneId}
            onClick={handleAiPolish}
            disabled={isPolishing}
            style={isPolishing ? { color: '#f0a500' } : {}}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="7" cy="7" r="5.5"/><circle cx="7" cy="7" r="2"/>
            </svg>
          </button>

          <button
            className="col-action-btn btn-yt"
            title="Generate YouTube assets for this script"
            data-id={sceneId}
            onClick={() => onShowYTModal(scriptId)}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 3.5l7.5 3.5L2 10.5V3.5z" strokeLinejoin="round"/><path d="M12 2v10"/>
            </svg>
          </button>

          {/* Drag handle */}
          <div className="drag-handle" title="Drag to reorder">
            {Array(6).fill(0).map((_, i) => <div key={i} className="drag-handle-dot" />)}
          </div>

          <button
            className="col-action-btn btn-lock"
            title="Enter recording mode"
            data-id={sceneId}
            onClick={() => onEnterRec(index)}
          >
            <svg width="13" height="14" viewBox="0 0 13 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <rect x="2" y="6" width="9" height="7" rx="1.5"/>
              <path d="M4 6V4a2.5 2.5 0 015 0v2"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ── Duration row ── */}
      <div className="col-duration">
        <span className="duration-actual" ref={durActualRef} data-dur-actual={sceneId}>
          {sc.actualDuration}
        </span>
        <span className="duration-estimate" ref={durEstRef} data-dur-est={sceneId} title="Estimated narration time from word count">
          {est}
        </span>
        <div className="duration-stepper" ref={stepperRef} title="Drag left/right to adjust time">
          {Array(9).fill(0).map((_, i) => <div key={i} className="stepper-bar" />)}
        </div>
        <div className="stepper-btns">
          <button className="stepper-btn stepper-plus"  title="+5s" onClick={handleStepUp}>▲</button>
          <button className="stepper-btn stepper-minus" title="-5s" onClick={handleStepDown}>▼</button>
        </div>
      </div>

      {/* ── Title + version badge ── */}
      <div className="col-title-wrap">
        <input
          type="text"
          className="col-title"
          defaultValue={sc.title}
          placeholder="SCENE TITLE"
          onChange={e => State.updateScene(sceneId, { title: e.target.value.toUpperCase() })}
        />
        {aiCount > 0 && (
          <span className="version-badge" data-vbadge={sceneId}>
            {sc.versions.length}
          </span>
        )}
      </div>

      {/* ── Narration ── */}
      <div className="col-narration">
        <div className="version-container">
          <VersionControls
            key={localKey}
            sceneId={sceneId}
            onVersionChange={() => {
              const updSc = State.scene(sceneId);
              if (taRef.current) taRef.current.value = updSc?.versions.find(v => v.active)?.text || '';
              localRefresh();
              const timerEl = document.getElementById('total-time');
              if (timerEl) timerEl.textContent = fmt(State.totalDuration(scriptId));
            }}
          />
        </div>

        <div className="narration-card">
          {isPolishing && (
            <div className="ai-loading">
              <span className="spinner" /> Polishing…
            </div>
          )}
          <textarea
            ref={taRef}
            className="narration-text"
            placeholder="Write narration…"
            defaultValue={av?.text || ''}
            onChange={e => {
              State.updateActiveVersionText(sceneId, e.target.value);
              updateDurDisplay();
              const timerEl = document.getElementById('total-time');
              if (timerEl) timerEl.textContent = fmt(State.totalDuration(scriptId));
            }}
          />
        </div>
      </div>

      {/* ── ON-SCREEN section ── */}
      <div className="col-onscreen">
        <div className="section-label">ON-SCREEN</div>
        <ul className="onscreen-list">
          {onscreenItems.map(item => (
            <OnscreenItem
              key={item.id}
              sceneId={sceneId}
              item={item}
              onDelete={() => handleDeleteOnscreen(item.id)}
            />
          ))}
        </ul>
        <button className="add-item-btn" onClick={handleAddOnscreen}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <line x1="5" y1="1" x2="5" y2="9"/><line x1="1" y1="5" x2="9" y2="5"/>
          </svg>
          &nbsp;Add item
        </button>
      </div>

      {/* ── REFERENCES section ── */}
      <div className="col-refs">
        <div className="section-label">REFERENCES</div>
        <div className="refs-list">
          {refs.map(ref => (
            <div
              key={ref.id}
              className="ref-chip"
              onClick={() => onShowRefModal(sceneId, ref.id)}
              title={ref.url || ''}
            >
              <span>{ref.text || ref.url || 'Reference'}</span>
              <button
                className="ref-del"
                onClick={e => {
                  e.stopPropagation();
                  State.deleteRef(sceneId, ref.id);
                  localRefresh();
                }}
              >✕</button>
            </div>
          ))}
        </div>
        <button className="add-item-btn" onClick={() => onShowRefModal(sceneId, null)}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <line x1="5" y1="1" x2="5" y2="9"/><line x1="1" y1="5" x2="9" y2="5"/>
          </svg>
          &nbsp;Add reference
        </button>
      </div>
    </div>
  );
}
