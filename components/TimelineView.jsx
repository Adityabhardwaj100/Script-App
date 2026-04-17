'use client';
import { useCallback } from 'react';
import { State } from '../lib/state.js';
import SceneColumn from './SceneColumn.jsx';

export default function TimelineView({
  scriptId,
  onRefresh,
  onDeleteScene,
  onEnterRec,
  onShowYTModal,
  onShowRefModal,
  onToast,
}) {
  const scenes = State.scenes(scriptId);

  const handleInsert = useCallback((afterOrderIndex) => {
    const sc = State.createScene(scriptId, afterOrderIndex);
    onRefresh();
    /* animate the new column in */
    setTimeout(() => {
      const col = document.querySelector(`.scene-col[data-id="${sc.id}"]`);
      if (!col) return;
      col.style.opacity   = '0';
      col.style.transform = 'scaleX(0.01)';
      col.style.transformOrigin = 'left';
      requestAnimationFrame(() => {
        col.style.transition = 'opacity 280ms ease, transform 380ms cubic-bezier(0.34,1.56,0.64,1)';
        col.style.opacity    = '1';
        col.style.transform  = 'scaleX(1)';
        setTimeout(() => { col.style.transition = ''; col.style.transform = ''; }, 450);
      });
    }, 50);
  }, [scriptId, onRefresh]);

  return (
    <div className="timeline-view" id="timeline-view">
      <div className="timeline-track" id="timeline-track">
        {scenes.map((sc, i) => (
          <span key={sc.id} style={{ display: 'contents' }}>
            <SceneColumn
              sceneId={sc.id}
              index={i}
              scriptId={scriptId}
              onRefresh={onRefresh}
              onDelete={onDeleteScene}
              onEnterRec={onEnterRec}
              onShowYTModal={onShowYTModal}
              onShowRefModal={onShowRefModal}
              onToast={onToast}
            />
            {/* Insert button — appears between columns */}
            <button
              className="insert-btn"
              title="Insert scene here"
              onClick={() => handleInsert(sc.orderIndex)}
            >
              <span className="insert-line" />
              <span className="insert-plus">+</span>
              <span className="insert-line" />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
