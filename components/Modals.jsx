'use client';
import { useState, useRef, useEffect } from 'react';
import { State } from '../lib/state.js';
import { AI } from '../lib/ai.js';

export default function Modals({ modal, onClose, onRefresh, onSelectScript, onToast, onLogout, userEmail }) {
  /* local inputs */
  const [projectTitle, setProjectTitle] = useState('');
  const [scriptTitle, setScriptTitle]   = useState('');
  const [apiKey, setApiKey]             = useState('');
  const [wisprKey, setWisprKey]         = useState('');
  const [claudeKey, setClaudeKey]       = useState('');
  const [refText, setRefText]           = useState('');
  const [refUrl, setRefUrl]             = useState('');
  const [ytData, setYtData]             = useState(null);
  const [ytError, setYtError]           = useState('');
  const [ytLoading, setYtLoading]       = useState(false);

  const projInputRef  = useRef(null);
  const scriptInputRef = useRef(null);
  const refInputRef   = useRef(null);

  /* populate fields when modal opens */
  useEffect(() => {
    if (!modal) return;
    if (modal.type === 'project') {
      setProjectTitle('');
      setTimeout(() => projInputRef.current?.focus(), 80);
    }
    if (modal.type === 'script') {
      setScriptTitle('');
      setTimeout(() => scriptInputRef.current?.focus(), 80);
    }
    if (modal.type === 'settings') {
      setApiKey(State.get('apiKey') || '');
      setWisprKey(State.get('wisprKey') || '');
      setClaudeKey(State.get('claudeKey') || '');
    }
    if (modal.type === 'ref') {
      const { sceneId, refId } = modal.context || {};
      if (refId && sceneId) {
        const sc  = State.scene(sceneId);
        const ref = sc?.refs.find(r => r.id === refId);
        setRefText(ref?.text || '');
        setRefUrl(ref?.url  || '');
      } else {
        setRefText('');
        setRefUrl('');
      }
      setTimeout(() => refInputRef.current?.focus(), 80);
    }
    if (modal.type === 'youtube') {
      setYtData(null);
      setYtError('');
      setYtLoading(true);
      AI.generateYouTubeAssets(modal.context?.scriptId)
        .then(data => { setYtData(data); setYtLoading(false); })
        .catch(e   => { setYtError(e.message); setYtLoading(false); });
    }
  }, [modal]);

  if (!modal) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  /* ── Handlers ── */
  const handleCreateProject = () => {
    const title = projectTitle.trim();
    if (!title) return;
    const project = State.createProject(title);
    const script  = State.createScript(project.id, title);
    State.createScene(script.id);
    onSelectScript(script.id, project.id);
    onClose();
    onToast(`Created "${project.title}" ✓`);
  };

  const handleCreateScript = () => {
    const title = scriptTitle.trim();
    const pid   = modal.context?.projectId;
    if (!title || !pid) return;
    const sc = State.createScript(pid, title);
    State.createScene(sc.id);
    onSelectScript(sc.id, pid);
    onClose();
  };

  const handleSaveSettings = () => {
    State.set('apiKey',    apiKey.trim());
    State.set('wisprKey',  wisprKey.trim());
    State.set('claudeKey', claudeKey.trim());
    onClose();
    onToast('Settings saved');
  };

  const handleDeleteScript = () => {
    const scriptId = modal.context?.scriptId;
    if (!scriptId) return;
    const sc   = State.script(scriptId);
    const name = sc?.title || 'script';
    /* use nested confirm modal */
    onClose();
    setTimeout(() => {
      if (window.confirm(`Delete "${name}"? This will permanently remove all scenes and narration.`)) {
        State.deleteScript(scriptId);
        onSelectScript(null, null);
        onRefresh();
        onToast(`Deleted "${name}"`);
      }
    }, 100);
  };

  const handleSaveRef = () => {
    const text   = refText.trim();
    const url    = refUrl.trim();
    const { sceneId, refId } = modal.context || {};
    if (!text && !url) { onClose(); return; }
    if (refId) {
      State.updateRef(sceneId, refId, { text, url });
    } else {
      State.addRef(sceneId, text, url);
    }
    onRefresh();
    onClose();
  };

  const handleDeleteRef = () => {
    const { sceneId, refId } = modal.context || {};
    if (sceneId && refId) State.deleteRef(sceneId, refId);
    onRefresh();
    onClose();
    onToast('Reference deleted');
  };

  const handleConfirmYes = () => {
    modal.context?.onYes?.();
    onClose();
  };

  return (
    <div className="modal-overlay" id="modal-overlay" onClick={handleOverlayClick}>

      {/* ── CONFIRM ── */}
      {modal.type === 'confirm' && (
        <div className="modal" id="modal-confirm">
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
            {modal.context?.title}
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 18, lineHeight: 1.5 }}>
            {modal.context?.subtitle}
          </p>
          <div className="modal-footer">
            <button className="btn-cancel" id="btn-confirm-cancel" onClick={onClose}>Cancel</button>
            <button
              className="btn-danger-action"
              id="btn-confirm-yes"
              style={{ fontSize: 13, padding: '8px 18px' }}
              onClick={handleConfirmYes}
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {/* ── NEW PROJECT ── */}
      {modal.type === 'project' && (
        <div className="modal" id="modal-project">
          <h3 id="modal-project-heading">NEW PROJECT</h3>
          <input
            ref={projInputRef}
            id="inp-project-title"
            className="modal-input"
            placeholder="PROJECT NAME"
            type="text"
            autoComplete="off"
            value={projectTitle}
            onChange={e => setProjectTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreateProject()}
          />
          <p className="modal-hint">Creates a new project with a default script — opens immediately.</p>
          <div className="modal-footer">
            <button className="btn-cancel" onClick={onClose}>Cancel</button>
            <button className="btn-confirm" id="btn-create-project" onClick={handleCreateProject}>
              Create &amp; Open
            </button>
          </div>
        </div>
      )}

      {/* ── NEW SCRIPT ── */}
      {modal.type === 'script' && (
        <div className="modal" id="modal-script">
          <h3>New Script</h3>
          <input
            ref={scriptInputRef}
            id="inp-script-title"
            className="modal-input"
            placeholder="SCRIPT TITLE"
            type="text"
            autoComplete="off"
            value={scriptTitle}
            onChange={e => setScriptTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreateScript()}
          />
          <div className="modal-footer">
            <button className="btn-cancel" onClick={onClose}>Cancel</button>
            <button className="btn-confirm" id="btn-create-script" onClick={handleCreateScript}>
              Create Script
            </button>
          </div>
        </div>
      )}

      {/* ── SETTINGS ── */}
      {modal.type === 'settings' && (
        <div className="modal" id="modal-settings">
          <h3>Settings</h3>

          {/* Account row */}
          {userEmail && (
            <div className="settings-account">
              <div className="settings-account-info">
                <div className="settings-account-icon">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <circle cx="7" cy="5" r="2.5"/>
                    <path d="M1.5 12.5c0-2.5 2.5-4.5 5.5-4.5s5.5 2 5.5 4.5"/>
                  </svg>
                </div>
                <span className="settings-account-email">{userEmail}</span>
              </div>
              <button
                className="settings-signout-btn"
                id="btn-signout"
                onClick={() => { onClose(); onLogout?.(); }}
              >
                Sign out
              </button>
            </div>
          )}

          <label className="modal-label" style={{ marginTop: userEmail ? 16 : 0 }}>Gemini API Key</label>
          <input
            id="inp-api-key"
            className="modal-input"
            placeholder="AIza…"
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
          />
          <p className="modal-hint">Powers AI Polish (Gemini).</p>

          <label className="modal-label" style={{ marginTop: 14 }}>Claude API Key</label>
          <input
            id="inp-claude-key"
            className="modal-input"
            placeholder="sk-ant-…"
            type="password"
            autoComplete="off"
            value={claudeKey}
            onChange={e => setClaudeKey(e.target.value)}
          />
          <p className="modal-hint">Powers ‘Generate narration’ (the ○ button on each scene).</p>

          <label className="modal-label" style={{ marginTop: 14 }}>Wispr Flow API Key</label>
          <input
            id="inp-wispr-key"
            className="modal-input"
            placeholder="wispr_…"
            type="password"
            autoComplete="off"
            value={wisprKey}
            onChange={e => setWisprKey(e.target.value)}
          />
          <p className="modal-hint">Powers the 🎤 mic button for speech-to-text on each scene.</p>
          <div className="modal-footer">
            <button className="btn-cancel" onClick={onClose}>Cancel</button>
            <button className="btn-confirm" id="btn-save-settings" onClick={handleSaveSettings}>
              Save
            </button>
          </div>

          {/* Danger zone — only when script is open */}
          {modal.context?.scriptId && (
            <div className="settings-danger" id="settings-danger">
              <div className="settings-danger-rule" />
              <div className="settings-danger-label">DANGER ZONE</div>
              <div className="settings-danger-row">
                <div>
                  <div className="settings-danger-title" id="settings-danger-script-name">
                    Delete &quot;{State.script(modal.context.scriptId)?.title || 'script'}&quot;
                  </div>
                  <div className="settings-danger-sub">
                    Permanently removes all scenes and narration.
                  </div>
                </div>
                <button
                  className="btn-danger-action"
                  id="btn-delete-script"
                  onClick={handleDeleteScript}
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── YOUTUBE ── */}
      {modal.type === 'youtube' && (
        <div className="modal modal-wide" id="modal-youtube">
          <div className="modal-topbar">
            <h3>YouTube Assets</h3>
            <button className="btn-cancel" style={{ margin: 0 }} onClick={onClose}>✕</button>
          </div>
          <div className="yt-output" id="yt-output">
            {ytLoading && (
              <div className="yt-loading">
                <span className="spinner" /> Generating…
              </div>
            )}
            {ytError && (
              <div style={{ color: '#e53e3e', padding: '16px 0' }}>Error: {ytError}</div>
            )}
            {ytData && !ytLoading && (
              <>
                <div className="yt-section">
                  <h4>Description</h4>
                  <div className="yt-desc">{ytData.description}</div>
                </div>
                <div className="yt-section">
                  <h4>Tags</h4>
                  <div className="yt-tags">
                    {ytData.tags.map((t, i) => <span key={i} className="yt-tag">{t}</span>)}
                  </div>
                </div>
                <div className="yt-section">
                  <h4>Alternate Titles (A/B)</h4>
                  <div className="yt-alt-title">
                    {ytData.alternateTitles.map((t, i) => (
                      <div key={i} className="yt-alt-item">
                        <strong>{t.title}</strong>
                        <span>{t.rationale}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── REFERENCE ── */}
      {modal.type === 'ref' && (
        <div className="modal" id="modal-ref">
          <h3 id="modal-ref-title">
            {modal.context?.refId ? 'EDIT REFERENCE' : 'ADD REFERENCE'}
          </h3>
          <input
            ref={refInputRef}
            id="inp-ref-text"
            className="modal-input"
            placeholder="Label / Name"
            type="text"
            autoComplete="off"
            value={refText}
            onChange={e => setRefText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSaveRef()}
          />
          <input
            id="inp-ref-url"
            className="modal-input"
            placeholder="URL (optional)"
            type="url"
            autoComplete="off"
            style={{ marginTop: 8 }}
            value={refUrl}
            onChange={e => setRefUrl(e.target.value)}
          />
          <div className="modal-footer modal-footer-split">
            <button className="btn-cancel" onClick={onClose}>Cancel</button>
            <div className="modal-footer-right">
              {modal.context?.refId && (
                <button
                  className="btn-ref-delete"
                  id="btn-delete-ref"
                  onClick={handleDeleteRef}
                >
                  Delete
                </button>
              )}
              <button className="btn-confirm" id="btn-save-ref" onClick={handleSaveRef}>
                {modal.context?.refId ? 'Save' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
