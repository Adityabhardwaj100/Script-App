'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import { State } from '../lib/state.js';
import { AI } from '../lib/ai.js';
import { supabase } from '../lib/supabase.js';
import Sidebar        from './Sidebar.jsx';
import TimelineView   from './TimelineView.jsx';
import OverviewView   from './OverviewView.jsx';
import RecordingMode  from './RecordingMode.jsx';
import Modals         from './Modals.jsx';
import Toast          from './Toast.jsx';
import AuthPage       from './AuthPage.jsx';

function fmt(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/* True only when real Supabase credentials are present (i.e. on Vercel) */
const SUPABASE_CONFIGURED =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');

export default function AppClient() {
  /* ── Auth state ── */
  const [user,        setUser]        = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  /* ── App state ── */
  const [initialized,    setInitialized]    = useState(false);
  const [scriptId,       setScriptId]       = useState(null);
  const [isOverviewMode, setIsOverviewMode] = useState(false);
  const [recActive,      setRecActive]      = useState(false);
  const [recIdx,         setRecIdx]         = useState(0);
  const [collapsed,      setCollapsed]      = useState(false);
  const [refreshKey,     setRefreshKey]     = useState(0);
  const [modal,          setModal]          = useState(null);
  const [toast,          setToast]          = useState(null);
  const [railOpen,       setRailOpen]       = useState(false);
  const importRef = useRef(null);

  /* ── Bootstrap: fetch cloud data → init State ── */
  const bootstrap = useCallback(async (session) => {
    /* ── DEV MODE: no Supabase configured → skip auth, use localStorage ── */
    if (!SUPABASE_CONFIGURED) {
      State.init(null);
      setUser({ email: 'dev@local' });
      setScriptId(State.get('activeScriptId') || null);
      setInitialized(true);
      setAuthLoading(false);
      return;
    }

    if (!session) {
      setAuthLoading(false);
      return;
    }

    State.setUserId(session.user.id);

    /* Try to load from Supabase */
    let cloudData = null;
    try {
      const { data } = await supabase
        .from('user_data')
        .select('data')
        .eq('user_id', session.user.id)
        .maybeSingle();
      cloudData = data?.data ?? null;
    } catch (_) { /* offline — will fall back to localStorage */ }

    State.init(cloudData);

    setUser(session.user);
    setScriptId(State.get('activeScriptId') || null);
    setInitialized(true);
    setAuthLoading(false);
  }, []);

  /* ── Auth lifecycle ── */
  useEffect(() => {
    if (!SUPABASE_CONFIGURED) {
      bootstrap(null); /* triggers dev-mode path */
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      bootstrap(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN')  bootstrap(session);
        if (event === 'SIGNED_OUT') {
          setUser(null);
          setInitialized(false);
          setScriptId(null);
          setRefreshKey(0);
          setAuthLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [bootstrap]);

  /* ── App callbacks ── */
  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  const selectScript = useCallback((id, projectId) => {
    State.set('activeScriptId',  id);
    State.set('activeProjectId', projectId);
    setScriptId(id);
    setIsOverviewMode(false);
    setRefreshKey(k => k + 1);
  }, []);

  const showToast  = useCallback((msg, undoCb = null) => setToast({ msg, undoCb }), []);
  const closeToast = useCallback(() => setToast(null), []);
  const showModal  = useCallback((type, context = {}) => setModal({ type, context }), []);
  const closeModal = useCallback(() => setModal(null), []);
  const showConfirm = useCallback((title, subtitle, onYes) => {
    setModal({ type: 'confirm', context: { title, subtitle, onYes } });
  }, []);

  /* ── Scene deletion with undo ── */
  const handleDeleteScene = useCallback((sceneId) => {
    const sc = State.deleteScene(sceneId);
    refresh();
    if (!sc) return;
    showToast(`Deleted "${sc.title}"`, () => {
      State.d.scenes.push(sc);
      State._reindex(sc.scriptId);
      State._save();
      refresh();
    });
  }, [refresh, showToast]);

  /* ── Recording mode ── */
  const enterRec   = useCallback((idx = 0) => { setRecIdx(idx); setRecActive(true); }, []);
  const exitRec    = useCallback(() => setRecActive(false), []);
  const recNext    = useCallback(() => {
    if (!scriptId) return;
    const scenes = State.scenes(scriptId);
    setRecIdx(i => Math.min(i + 1, scenes.length - 1));
  }, [scriptId]);
  const recPrev    = useCallback(() => setRecIdx(i => Math.max(i - 1, 0)), []);
  const recNavigate = useCallback((idx) => setRecIdx(idx), []);

  /* ── Overview ── */
  const toggleOverview = useCallback(() => {
    if (!scriptId) return;
    setIsOverviewMode(v => !v);
  }, [scriptId]);

  /* ── Logout ── */
  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    State.setUserId(null);
  }, []);

  /* ── Rail actions ── */
  const handleRailAction = useCallback(async (action) => {
    setRailOpen(false);
    if (action === 'youtube')    { showModal('youtube', { scriptId }); return; }
    if (action === 'lock-all')   { enterRec(0); return; }
    if (action === 'unlock-all') { exitRec(); return; }
    if (action === 'export')     { exportData(); return; }
    if (action === 'import')     { importRef.current?.click(); return; }
    if (action === 'generate-all') { await generateAll(); return; }
  }, [scriptId, enterRec, exitRec, showModal]);

  /* ── Import / Export ── */
  const exportData = () => {
    if (!State.d) return;
    const blob = new Blob([JSON.stringify(State.d, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${(State.script(scriptId)?.title || 'scriptapp').toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported ✓');
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.projects || !data.scenes) throw new Error('Invalid format');
        State.init(data);
        State._save(); /* triggers cloud sync too */
        refresh();
        showToast('Imported ✓');
      } catch(err) {
        showToast('Import failed: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  /* ── Generate all ── */
  const generateAll = async () => {
    if (!scriptId) return;
    const key = State.get('apiKey');
    if (!key) { showToast('Add Gemini API key in Settings first'); return; }
    const scenes = State.scenes(scriptId);
    showToast(`Polishing ${scenes.length} scenes…`);
    for (const sc of scenes) {
      try { await AI.polishNarration(sc.id); } catch(_) {}
    }
    refresh();
    showToast('All scenes polished ✓');
  };

  /* ── Render ── */
  if (authLoading) {
    return (
      <div className="auth-loading">
        <div className="auth-loading-spinner" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  if (!initialized) return null;

  return (
    <div id="app">
      {/* ── SIDEBAR ── */}
      <Sidebar
        key={refreshKey}
        scriptId={scriptId}
        isOverviewMode={isOverviewMode}
        collapsed={collapsed}
        userEmail={user?.email}
        onToggleCollapsed={() => setCollapsed(v => !v)}
        onToggleOverview={toggleOverview}
        onSelectScript={selectScript}
        onNewProject={() => showModal('project')}
        onSettings={() => showModal('settings', { scriptId })}
        onRailMenuOpen={(e) => { e.stopPropagation(); setRailOpen(v => !v); }}
        onRefresh={refresh}
        onToast={showToast}
        onConfirm={showConfirm}
        onLogout={handleLogout}
      />

      {/* ── RAIL DROPDOWN ── */}
      {railOpen && (
        <RailDropdown onAction={handleRailAction} onClose={() => setRailOpen(false)} />
      )}

      {/* ── Hidden import input ── */}
      <input ref={importRef} type="file" accept=".json" style={{ display:'none' }} onChange={handleImport} />

      {/* ── MAIN CANVAS ── */}
      <main id="main-canvas" className="main-canvas">
        {scriptId && !isOverviewMode && (
          <TimelineView
            key={`tl-${refreshKey}`}
            scriptId={scriptId}
            onRefresh={refresh}
            onDeleteScene={handleDeleteScene}
            onEnterRec={enterRec}
            onShowYTModal={(sid) => showModal('youtube', { scriptId: sid })}
            onShowRefModal={(sceneId, refId) => showModal('ref', { sceneId, refId })}
            onToast={showToast}
          />
        )}

        {scriptId && isOverviewMode && (
          <OverviewView
            key={`ov-${refreshKey}`}
            scriptId={scriptId}
            onSceneClick={(sid) => {
              setIsOverviewMode(false);
              setTimeout(() => {
                const col = document.querySelector(`.scene-col[data-id="${sid}"]`);
                if (col) col.scrollIntoView({ behavior:'smooth', block:'nearest', inline:'center' });
              }, 100);
            }}
          />
        )}

        {!scriptId && (
          <div id="empty-state" className="empty-state">
            <div className="empty-icon">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="4" y="4" width="24" height="24" rx="3"/>
                <line x1="10" y1="12" x2="22" y2="12"/>
                <line x1="10" y1="17" x2="18" y2="17"/>
              </svg>
            </div>
            <p>Select a script from the sidebar</p>
            <p className="empty-sub">or create a new project to begin</p>
          </div>
        )}

        {recActive && scriptId && (
          <RecordingMode
            key={`rec-${recIdx}`}
            scriptId={scriptId}
            recIdx={recIdx}
            onNext={recNext}
            onPrev={recPrev}
            onExit={exitRec}
            onNavigate={recNavigate}
          />
        )}
      </main>

      {/* ── MODALS ── */}
      {modal && (
        <Modals
          modal={modal}
          onClose={closeModal}
          onRefresh={refresh}
          onSelectScript={selectScript}
          onToast={showToast}
          onLogout={handleLogout}
          userEmail={user?.email}
        />
      )}

      {/* ── TOAST ── */}
      <Toast toast={toast} onClose={closeToast} />
    </div>
  );
}

/* ── Rail Dropdown ── */
function RailDropdown({ onAction, onClose }) {
  useEffect(() => {
    const handler = () => onClose();
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [onClose]);

  const sidebarEl  = typeof document !== 'undefined' ? document.getElementById('sidebar')       : null;
  const railMenuBtn = typeof document !== 'undefined' ? document.getElementById('btn-rail-menu') : null;
  const top  = railMenuBtn?.getBoundingClientRect().top  ?? 60;
  const left = (sidebarEl?.getBoundingClientRect().right ?? 312) + 8;

  return (
    <div
      id="rail-dropdown"
      className="rail-dropdown"
      style={{ top, left }}
      onClick={e => e.stopPropagation()}
    >
      <button className="rdrop-item" onClick={() => onAction('generate-all')}>
        <svg className="rdrop-icon" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 1l1.8 3.6L14 5.5l-3 2.9.7 4.1L8 10.4l-3.7 2.1.7-4.1-3-2.9 4.2-.9z"/>
        </svg>
        <span>Generate all unlocked</span>
      </button>

      <button className="rdrop-item rdrop-item-accent" onClick={() => onAction('youtube')}>
        <svg className="rdrop-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <line x1="2" y1="4" x2="14" y2="4"/><line x1="2" y1="8" x2="10" y2="8"/><line x1="2" y1="12" x2="12" y2="12"/>
        </svg>
        <span>Create YouTube Description</span>
      </button>

      <div className="rdrop-sep" />

      <button className="rdrop-item" onClick={() => onAction('unlock-all')}>
        <svg className="rdrop-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <rect x="3" y="7" width="10" height="8" rx="1.5"/><path d="M5 7V4.5a3 3 0 016 0"/>
        </svg>
        <span>Exit recording mode</span>
      </button>

      <button className="rdrop-item" onClick={() => onAction('lock-all')}>
        <svg className="rdrop-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <rect x="3" y="7" width="10" height="8" rx="1.5"/><path d="M5 7V4.5a3 3 0 016 0v2.5"/>
        </svg>
        <span>Lock all (review mode)</span>
      </button>

      <div className="rdrop-sep" />

      <button className="rdrop-item" onClick={() => onAction('import')}>
        <svg className="rdrop-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M8 2v9M5 8l3 3 3-3"/><path d="M2 13h12"/>
        </svg>
        <span>Import</span>
      </button>

      <button className="rdrop-item" onClick={() => onAction('export')}>
        <svg className="rdrop-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M8 11V2M5 5l3-3 3 3"/><path d="M2 13h12"/>
        </svg>
        <span>Export</span>
      </button>
    </div>
  );
}
