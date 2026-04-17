'use client';
import { useRef } from 'react';
import { State } from '../lib/state.js';

function fmt(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const GROUPS = [
  { key: 'backlog',     label: 'BACKLOG'     },
  { key: 'in-progress', label: 'IN PROGRESS' },
  { key: 'done',        label: 'DONE'        },
];

export default function Sidebar({
  scriptId,
  isOverviewMode,
  collapsed,
  onToggleCollapsed,
  onToggleOverview,
  onSelectScript,
  onNewProject,
  onSettings,
  onRailMenuOpen,
  onRefresh,
  onToast,
  onConfirm,
}) {
  const dragPidRef = useRef(null);

  const totalTime = scriptId ? fmt(State.totalDuration(scriptId)) : '0:00';
  const vtitle    = scriptId ? (State.script(scriptId)?.title || '') : '';
  const projects  = State.projects();

  /* ── Sidebar project drag-drop (status change) ── */
  const handleDragStart = (e, pid) => {
    dragPidRef.current = pid;
    e.dataTransfer.setData('text/plain', pid);
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.classList.add('sb-dragging');
  };
  const handleDragEnd  = (e) => { e.currentTarget.classList.remove('sb-dragging'); };
  const handleDragOver = (e, groupEl) => {
    e.preventDefault();
    document.querySelectorAll('.sb-group').forEach(g => g.classList.remove('drop-over'));
    groupEl.classList.add('drop-over');
  };
  const handleDragLeave = (e, groupEl) => {
    if (!groupEl.contains(e.relatedTarget)) groupEl.classList.remove('drop-over');
  };
  const handleDrop = (e, status, groupEl) => {
    e.preventDefault();
    groupEl.classList.remove('drop-over');
    const pid = e.dataTransfer.getData('text/plain');
    if (!pid) return;
    State.updateProject(pid, { status });
    onRefresh();
    onToast(`Moved to ${GROUPS.find(g => g.key === status)?.label || status}`);
  };

  /* ── Delete project ── */
  const handleDeleteProject = (e, p) => {
    e.stopPropagation();
    e.preventDefault();
    const scripts = State.scripts(p.id);
    onConfirm(
      `Delete "${p.title}"?`,
      'This will permanently remove all scenes and narration.',
      () => {
        if (scripts.some(sc => sc.id === scriptId)) onSelectScript(null, null);
        State.deleteProject(p.id);
        onRefresh();
        onToast(`Deleted "${p.title}"`);
      }
    );
  };

  return (
    <aside
      id="sidebar"
      className={`sidebar${collapsed ? ' collapsed' : ''}`}
    >
      {/* ── Left content panel ── */}
      <div className="sidebar-content" id="sidebar-content">
        <div className="project-list" id="project-list">
          {GROUPS.map(g => {
            const ps = projects.filter(p => p.status === g.key);
            return (
              <GroupZone
                key={g.key}
                group={g}
                projects={ps}
                scriptId={scriptId}
                onSelectScript={onSelectScript}
                onDeleteProject={handleDeleteProject}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              />
            );
          })}
        </div>

        <div className="sidebar-bottom">
          <button
            id="btn-new-project"
            className="sb-bot-btn"
            title="New project"
            onClick={onNewProject}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <line x1="9" y1="2" x2="9" y2="16"/>
              <line x1="2" y1="9" x2="16" y2="9"/>
            </svg>
          </button>
          <button
            id="btn-settings"
            className="sb-bot-btn"
            title="Settings"
            onClick={onSettings}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6">
              <circle cx="9" cy="9" r="2.5"/>
              <path d="M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.7 3.7l1.4 1.4M12.9 12.9l1.4 1.4M3.7 14.3l1.4-1.4M12.9 5.1l1.4-1.4" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ── Right rail ── */}
      <div className="sidebar-rail">
        <div className="rail-top">
          {/* Pencil / actions button */}
          <button
            id="btn-rail-menu"
            className="rail-menu-btn"
            title="Actions"
            onClick={onRailMenuOpen}
          >
            <svg width="20" height="32" viewBox="0 0 20 32" fill="none">
              <rect x="5" y="3" width="10" height="20" rx="5" stroke="currentColor" strokeWidth="1.4" fill="rgba(255,255,255,0.05)"/>
              <rect x="5" y="6" width="10" height="3.5" rx="1" fill="#f0a500" opacity="0.85"/>
              <line x1="7" y1="12" x2="13" y2="12" stroke="rgba(255,255,255,0.25)" strokeWidth="1" strokeLinecap="round"/>
              <line x1="7" y1="15" x2="13" y2="15" stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeLinecap="round"/>
              <path d="M7 23 L10 30 L13 23" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" fill="rgba(255,255,255,0.08)"/>
            </svg>
          </button>

          {/* Total timer */}
          <div
            id="total-timer"
            className={`total-timer${isOverviewMode ? ' overview-active' : ''}`}
            title="Click for overview"
            onClick={onToggleOverview}
          >
            <span id="total-time">{totalTime}</span>
          </div>
        </div>

        {/* Vertical script title */}
        <div id="sidebar-vtitle" className="sidebar-vtitle">{vtitle}</div>

        {/* Hamburger toggle */}
        <button
          id="btn-toggle-sidebar"
          className={`rail-toggle-btn${collapsed ? '' : ' active'}`}
          title="Toggle sidebar"
          onClick={onToggleCollapsed}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <line x1="2" y1="5"  x2="16" y2="5"/>
            <line x1="2" y1="9"  x2="16" y2="9"/>
            <line x1="2" y1="13" x2="16" y2="13"/>
          </svg>
        </button>
      </div>
    </aside>
  );
}

/* ── Group drop zone ── */
function GroupZone({
  group, projects, scriptId,
  onSelectScript, onDeleteProject,
  onDragStart, onDragEnd,
  onDragOver, onDragLeave, onDrop,
}) {
  const groupRef = useRef(null);

  return (
    <div
      ref={groupRef}
      className="sb-group"
      data-status={group.key}
      onDragOver={e => onDragOver(e, groupRef.current)}
      onDragLeave={e => onDragLeave(e, groupRef.current)}
      onDrop={e => onDrop(e, group.key, groupRef.current)}
    >
      <div className="sb-group-label">{group.label}</div>

      {projects.map(p => {
        const scripts       = State.scripts(p.id);
        const hasActive     = scripts.some(sc => sc.id === scriptId);
        const multiScript   = scripts.length > 1;

        return (
          <div
            key={p.id}
            className="sb-project"
            draggable
            onDragStart={e => onDragStart(e, p.id)}
            onDragEnd={onDragEnd}
          >
            <div className="sb-title-row">
              <div
                className={`sb-project-title${hasActive ? ' active' : ''}`}
                style={{ cursor: 'pointer' }}
                title="Right-click to change status"
                onClick={() => scripts[0] && onSelectScript(scripts[0].id, p.id)}
                onContextMenu={e => {
                  e.preventDefault();
                  const all = ['backlog', 'in-progress', 'done'];
                  State.updateProject(p.id, { status: all[(all.indexOf(p.status) + 1) % all.length] });
                }}
              >
                {hasActive && <span className="dot">·</span>}
                {p.title}
              </div>

              <button
                className="sb-project-del"
                title="Delete project"
                draggable={false}
                onMouseDown={e => e.stopPropagation()}
                onClick={e => onDeleteProject(e, p)}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <line x1="2" y1="2" x2="8" y2="8"/>
                  <line x1="8" y1="2" x2="2" y2="8"/>
                </svg>
              </button>
            </div>

            {multiScript && scripts.map(sc => (
              <div
                key={sc.id}
                className={`sb-script${sc.id === scriptId ? ' active' : ''}`}
                onClick={() => onSelectScript(sc.id, p.id)}
              >
                {sc.title}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
