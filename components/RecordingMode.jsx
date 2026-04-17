'use client';
import { useEffect, useRef } from 'react';
import { State } from '../lib/state.js';

function fmt(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function RecordingMode({ scriptId, recIdx, onNext, onPrev, onExit, onNavigate }) {
  const scenes = State.scenes(scriptId);
  const trackRef = useRef(null);

  /* keyboard navigation */
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); onNext(); }
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   { e.preventDefault(); onPrev(); }
      if (e.key === 'Escape') onExit();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onNext, onPrev, onExit]);

  /* scroll active col into view */
  useEffect(() => {
    const col = trackRef.current?.querySelector(`[data-rec-idx="${recIdx}"]`);
    if (col) col.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
  }, [recIdx]);

  return (
    <div className="recording-mode" id="recording-mode">
      <div className="rec-topbar">
        <span className="rec-label">LOCK MODE</span>
        <div className="rec-nav">
          <button className="rec-nav-btn" id="rec-prev" onClick={onPrev} title="Previous scene">
            &#8592;
          </button>
          <span className="rec-counter" id="rec-counter">
            {recIdx + 1} / {scenes.length}
          </span>
          <button className="rec-nav-btn" id="rec-next" onClick={onNext} title="Next scene">
            &#8594;
          </button>
        </div>
        <button className="rec-exit-btn" id="rec-exit" onClick={onExit}>Exit</button>
      </div>

      <div className="rec-canvas">
        <div className="rec-track" id="rec-track" ref={trackRef}>
          {scenes.map((sc, i) => {
            const av = sc.versions.find(v => v.active) || sc.versions[0];
            const est = State.estimatedDuration(av?.text || '');

            return (
              <div
                key={sc.id}
                className={`rec-col${i === recIdx ? ' rec-col-active' : ''}`}
                data-rec-idx={i}
                onClick={() => onNavigate(i)}
              >
                {/* Header */}
                <div className="rc-header">
                  <span className="rc-num">{i + 1}</span>
                  <div className="rc-header-right">
                    <svg className="rc-lock-icon" width="13" height="14" viewBox="0 0 13 14"
                      fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <rect x="2" y="6" width="9" height="7" rx="1.5"/>
                      <path d="M4 6V4a2.5 2.5 0 015 0v2"/>
                    </svg>
                  </div>
                </div>

                {/* Duration */}
                <div className="rc-dur-row">
                  <span className="rc-dur-actual">{sc.actualDuration}</span>
                  <span className="rc-dur-est">{est}</span>
                </div>

                {/* Title & narration */}
                <div className="rc-title">{sc.title || 'UNTITLED'}</div>
                <div className="rc-narration">{av?.text || ''}</div>

                {/* On-screen items */}
                {sc.onscreen?.length > 0 && (
                  <div className="rc-section">
                    <div className="rc-section-label">ON-SCREEN</div>
                    {sc.onscreen.map(item => (
                      <div key={item.id} className={`rc-onscreen-item${item.checked ? ' checked' : ''}`}>
                        <span className={`rc-check-dot${item.checked ? ' filled' : ''}`} />
                        <span>{item.text}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* References */}
                {sc.refs?.length > 0 && (
                  <div className="rc-section">
                    <div className="rc-section-label">REFERENCES</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', padding: '0' }}>
                      {sc.refs.map(ref => (
                        <div
                          key={ref.id}
                          className="rc-ref-chip"
                          style={ref.url ? { cursor: 'pointer' } : {}}
                          title={ref.url || ''}
                        >
                          {ref.text || ref.url || 'Reference'}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
