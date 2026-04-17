'use client';
import { State } from '../lib/state.js';

function fmt(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function OverviewView({ scriptId, onSceneClick }) {
  const scenes = State.scenes(scriptId);

  return (
    <div className="overview-view" id="overview-view">
      <div className="ov-body">
        {scenes.map((sc, i) => {
          const av = sc.versions.find(v => v.active) || sc.versions[0];
          const dur = sc.actualDuration || State.estimatedDuration(av?.text || '') || 0;
          const dotCount = Math.max(3, (sc.onscreen || []).length);

          return (
            <div
              key={sc.id}
              className="ov-col"
              onClick={() => onSceneClick(sc.id)}
              title={sc.title}
            >
              <div className="ov-num">{i + 1}</div>

              <div className="ov-time-row">
                <div className="ov-time-pill">{dur ? fmt(dur) : '—'}</div>
              </div>

              <div className="ov-topic-area">
                <div className="ov-topic">
                  {sc.title?.trim() || 'UNTITLED'}
                </div>
              </div>

              <div className="ov-dots-area">
                {Array(dotCount).fill(0).map((_, j) => (
                  <div
                    key={j}
                    className={`ov-dot${sc.onscreen?.[j]?.checked ? ' filled' : ''}`}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
