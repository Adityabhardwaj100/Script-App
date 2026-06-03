'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import { State } from '../lib/state.js';
import { AI } from '../lib/ai.js';
import { supabase } from '../lib/supabase.js';
import Sidebar        from './Sidebar.jsx';
import TimelineView    from './TimelineView.jsx';
import OverviewView    from './OverviewView.jsx';
import RecordingMode   from './RecordingMode.jsx';
import Modals          from './Modals.jsx';
import Toast           from './Toast.jsx';
import AuthPage        from './AuthPage.jsx';

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
  const [user, setUser]           = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  /* ── App state ── */
  const [initialized, setInitialized] = useState(false);
  const [scriptId, setScriptId]     = useState(null);
  const [isOverviewMode, setIsOverviewMode] = useState(false);
  const [recActive, setRecActive]   = useState(false);
  const [recIdx, setRecIdx]         = useState(0);
  const [collapsed, setCollapsed]   = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [modal, setModal]           = useState(null);
  const [toast, setToast]           = useState(null);
  const [railOpen, setRailOpen]     = useState(false);
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
    } catch (_) {
      /* offline — will fall back to localStorage */
    }
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
    /* Wrap getSession in a timeout race — Supabase free tier can hang */
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('getSession timeout')),
      8000)
    );
    Promise.race([supabase.auth.getSession(), timeout])
      .then(({ data: { session } }) => bootstrap(session))
      .catch(() => {
        /* getSession failed or timed out — treat as no session */
        bootstrap(null);
      });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN') bootstrap(session);
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
    State.set('activeScriptId', id);
    State.set('activeProjectId', projectId);
    setScriptId(id);
    setIsOverviewMode(false);
    setRefreshKey(k => k + 1);
  }, []);
  const showToast = useCallback((msg, undoCb = null) => setToast({ msg, undoCb }), []);
  const closeToast = useCallback(() => setToast(null), []);
  const showModal = useCallback((type, context = {}) => setModal({ type, context }), []);
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
  const enterRec = useCallback((idx = 0) => {
    setRecIdx(idx);
    setRecActive(true);
  }, []);
  const exitRec = useCallback(() => setRecActive(false), []);
  const recNext = useCallback(() => {
    if (!scriptId) return;
    const scenes = State.scenes(scriptId);
    setRecIdx(i => Math.min(i + 1, scenes.length - 1));
  }, [scriptId]);
  const recPrev = useCallback(() => setRecIdx(i => Math.max(i - 1, 0)), []);
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
    if (action === 'youtube') {
      showModal('youtube', { scriptId });
      return;
    }
    if (action === 'lock-all') {
      enterRec(0);
      return;
    }
    if (action === 'unlock-all') {
      exitRec();
      return;
    }
    if (action === 'export') {
      exportData();
      return;
    }
    if (action === 'import') {
      importRef.current?.click();
      return;
    }
    if (action === 'generate-all') {
      await generateAll();
      return;
    }
  }, [scriptId, enterRec, exitRec, showModal]);

  /* ── Import / Export ── */
  const exportData = () => {
    if (!State.d) return;
    const blob = new Blob([JSON.stringify(State.d, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(State.script(scriptId)?.title || 'scriptapp').toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported ✓');
  };
  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
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
    if (!key) {
      showToast('Add Gemini API key in Settings first');
      return;
    }
    const scenes = State.scenes(scriptId);
    showToast(`Polishing ${scenes.length} scenes…`);
    for (const sc of scenes) {
      try {
        await AI.polishNarration(sc.id);
      } catch(_) {}
    }
    refresh();
    showToast('All scenes polished ✓');
  };

  /* ── Render ── */
  if (authLoading) {
    return (
      <div className="loading-container" style={{
        display:'flex',
        alignItems:'center',
        justifyContent:'center',
        height:'100vh',
        background:'#0d0d0d',
        color:'#e0e0e0',
        flexDirection:'column',
        gap:'16px'
      }}>
        <div className="spinner" style={{
          width:'32px',
          height:'32px',
          border:'3px solid #333',
          borderTopColor:'#ff9f00',
          borderRadius:'50%',
          animation:'spin 1s linear infinite'
        }} />
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }
  if (!user) {
    return <AuthPage />;
  }
  if (!initialized) return null;

  return (
    <div className={`app ${collapsed ? 'collapsed' : ''}`} key={refreshKey}>
      {/* ── SIDEBAR ── */}
      <Sidebar
        collapsed={collapsed}
        onToggleCollapsed={v => setCollapsed(v => !v)}
        onToggleOverview={toggleOverview}
        onSelectScript={selectScript}
        onNewProject={() => showModal('project')}
        onSettings={() => showModal('settings', { scriptId })}
        onRailMenuOpen={(e) => {
          e.stopPropagation();
          setRailOpen(v => !v);
        }}
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
      <main className="main-canvas">
        {scriptId && !isOverviewMode && (
          <TimelineView
            scriptId={scriptId}
            onSceneClick={(sid) => selectScript(sid, State.get('activeProjectId'))}
            onShowYouTubeModal={(sid) => showModal('youtube', { scriptId: sid })}
            onShowRefModal={(sceneId, refId) => showModal('ref', { sceneId, refId })}
            onToast={showToast}
          />
        )}
        {scriptId && isOverviewMode && (
          <OverviewView
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
          <div className="empty-state">
            <h2>Select a script from the sidebar</h2>
            <p>or create a new project to begin</p>
          </div>
        )}
        {recActive && scriptId && (
          <RecordingMode
            scriptId={scriptId}
            idx={recIdx}
            onNext={recNext}
            onPrev={recPrev}
            onNavigate={recNavigate}
            onExit={exitRec}
            onToast={showToast}
            onDeleteScene={handleDeleteScene}
          />
        )}
      </main>
      {/* ── MODALS ── */}
      {modal && (
        <Modals
          modal={modal}
          onClose={closeModal}
          scriptId={scriptId}
          onDeleteScene={handleDeleteScene}
          onToast={showToast}
        />
      )}
      {/* ── TOAST ── */}
      {toast && <Toast toast={toast} onClose={closeToast} />}
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
  const sidebarEl = typeof document !== 'undefined' ? document.getElementById('sidebar') : null;
  const railMenuBtn = typeof document !== 'undefined' ? document.getElementById('btn-rail-menu') : null;
  const top = railMenuBtn?.getBoundingClientRect().top ?? 60;
  const left = (sidebarEl?.getBoundingClientRect().right ?? 312) + 8;
  return (
    <div className="rail-dropdown" onClick={e => e.stopPropagation()} style={{
      position:'absolute',
      top,
      left,
      background:'#1c1c1c',
      border:'1px solid #333',
      borderRadius:'8px',
      boxShadow:'0 4px 16px rgba(0,0,0,0.4)',
      zIndex:100,
      minWidth:200
    }}>
      <button className="rail-item" onClick={() => { onAction('generate-all'); onClose(); }}>Generate all unlocked</button>
      <button className="rail-item" onClick={() => { onAction('youtube'); onClose(); }}>Create YouTube Description</button>
      <button className="rail-item" onClick={() => { onAction('unlock-all'); onClose(); }}>Exit recording mode</button>
      <button className="rail-item" onClick={() => { onAction('lock-all'); onClose(); }}>Lock all (review mode)</button>
      <button className="rail-item" onClick={() => { onAction('import'); onClose(); }}>Import</button>
      <button className="rail-item" onClick={() => { onAction('export'); onClose(); }}>Export</button>
    </div>
  );
}
