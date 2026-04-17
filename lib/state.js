/* ─── lib/state.js — State & Data Layer ─── */
import { supabase } from './supabase.js';

const STORAGE_KEY = 'scriptapp_v3';
export const WPM = 150;

function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }
function now() { return Date.now(); }

/* Empty initial state — all user data is auto-saved to localStorage + Supabase */
const SEED = {
  projects: [],
  scripts: [],
  scenes: [],
  settings: { apiKey: '', activeScriptId: null, activeProjectId: null },
};

/* ── Cloud sync state ── */
let _userId   = null; // set after auth
let _syncTimer = null;

export const State = {
  d: null,

  /* Bind user id so cloud sync knows where to write */
  setUserId(uid) { _userId = uid; },

  init(initialData = null) {
    if (typeof window === 'undefined') return;
    /* If cloud data was pre-fetched, use it directly */
    if (initialData) {
      this.d = initialData;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.d));
      return;
    }
    /* Otherwise fall back to localStorage → SEED */
    try { this.d = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch(_) {}
    if (!this.d) this.d = JSON.parse(JSON.stringify(SEED));
    if (!this.d.settings) this.d.settings = { apiKey:'', activeScriptId:null, activeProjectId:null };
    this._save();
  },

  _save() {
    if (typeof window === 'undefined') return;
    /* 1. Immediate local save (offline-safe) */
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.d));
    /* 2. Debounced cloud sync (1.5 s after last change) */
    clearTimeout(_syncTimer);
    _syncTimer = setTimeout(() => this._syncToCloud(), 1500);
  },

  async _syncToCloud() {
    if (!_userId) return;
    try {
      await supabase
        .from('user_data')
        .upsert(
          { user_id: _userId, data: this.d, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        );
    } catch (e) {
      console.warn('[ScriptApp] Cloud sync failed (offline?):', e.message);
    }
  },

  /* Projects */
  projects()          { return this.d.projects; },
  project(id)         { return this.d.projects.find(p => p.id === id); },
  createProject(title) {
    const p = { id:uid(), title:title.toUpperCase().trim(), status:'backlog', createdAt:now() };
    this.d.projects.push(p); this._save(); return p;
  },
  updateProject(id, up) {
    const i = this.d.projects.findIndex(p => p.id === id);
    if (i >= 0) { Object.assign(this.d.projects[i], up); this._save(); }
  },
  deleteProject(id) {
    this.d.scripts.filter(s => s.projectId === id).forEach(s => this._deleteScriptData(s.id));
    this.d.projects = this.d.projects.filter(p => p.id !== id); this._save();
  },

  /* Scripts */
  scripts(projectId)  { return this.d.scripts.filter(s => s.projectId === projectId); },
  script(id)          { return this.d.scripts.find(s => s.id === id); },
  createScript(projectId, title) {
    const s = { id:uid(), projectId, title:title.toUpperCase().trim(), updatedAt:now() };
    this.d.scripts.push(s); this._save(); return s;
  },
  _deleteScriptData(id) {
    this.d.scenes = this.d.scenes.filter(sc => sc.scriptId !== id);
    this.d.scripts = this.d.scripts.filter(s => s.id !== id);
  },
  deleteScript(id) { this._deleteScriptData(id); this._save(); },

  /* Scenes */
  scenes(scriptId) {
    return this.d.scenes.filter(sc => sc.scriptId === scriptId).sort((a,b) => a.orderIndex - b.orderIndex);
  },
  scene(id) { return this.d.scenes.find(sc => sc.id === id); },
  createScene(scriptId, afterOrderIndex = -1) {
    const existing = this.scenes(scriptId);
    const baseIndex = afterOrderIndex >= 0 ? afterOrderIndex + 0.5 : existing.length;
    const sc = {
      id:uid(), scriptId, orderIndex:baseIndex, title:'UNTITLED',
      versions:[{ id:uid(), text:'', type:'original', active:true, createdAt:now() }],
      actualDuration:30, onscreen:[], refs:[], media:[], locked:false
    };
    this.d.scenes.push(sc);
    this._reindex(scriptId); this._save(); return sc;
  },
  updateScene(id, up) {
    const i = this.d.scenes.findIndex(sc => sc.id === id);
    if (i < 0) return;
    Object.assign(this.d.scenes[i], up);
    const sid = this.d.scenes[i].scriptId;
    const si = this.d.scripts.findIndex(s => s.id === sid);
    if (si >= 0) this.d.scripts[si].updatedAt = now();
    this._save();
  },
  deleteScene(id) {
    const sc = this.scene(id); if (!sc) return null;
    this.d.scenes = this.d.scenes.filter(s => s.id !== id);
    this._reindex(sc.scriptId); this._save(); return sc;
  },
  moveScene(id, toIndex) {
    const sc = this.scene(id); if (!sc) return;
    const list = this.scenes(sc.scriptId);
    const from = list.findIndex(s => s.id === id);
    if (from === toIndex) return;
    list.splice(toIndex, 0, list.splice(from, 1)[0]);
    list.forEach((s, i) => {
      const idx = this.d.scenes.findIndex(x => x.id === s.id);
      if (idx >= 0) this.d.scenes[idx].orderIndex = i;
    });
    this._save();
  },
  /* Swap exactly two scenes — all others stay in place */
  swapScenes(idA, idB) {
    const a = this.d.scenes.find(s => s.id === idA);
    const b = this.d.scenes.find(s => s.id === idB);
    if (!a || !b) return;
    const tmp = a.orderIndex;
    a.orderIndex = b.orderIndex;
    b.orderIndex = tmp;
    this._save();
  },
  _reindex(scriptId) {
    this.scenes(scriptId).forEach((sc, i) => {
      const idx = this.d.scenes.findIndex(s => s.id === sc.id);
      if (idx >= 0) this.d.scenes[idx].orderIndex = i;
    });
  },

  /* Versions */
  addVersion(sceneId, text, type = 'ai-generated') {
    const sc = this.scene(sceneId); if (!sc) return;
    const versions = sc.versions.map(v => ({ ...v, active:false }));
    const nv = { id:uid(), text, type, active:true, createdAt:now() };
    versions.push(nv);
    this.updateScene(sceneId, { versions }); return nv;
  },
  setActiveVersion(sceneId, versionId) {
    const sc = this.scene(sceneId); if (!sc) return;
    this.updateScene(sceneId, { versions: sc.versions.map(v => ({ ...v, active: v.id === versionId })) });
  },
  updateActiveVersionText(sceneId, text) {
    const sc = this.scene(sceneId); if (!sc) return;
    this.updateScene(sceneId, { versions: sc.versions.map(v => v.active ? { ...v, text } : v) });
  },

  /* Computed */
  estimatedDuration(text) {
    const words = (text||'').trim().split(/\s+/).filter(w => w).length;
    return Math.round(words / WPM * 60);
  },
  totalDuration(scriptId) {
    return this.scenes(scriptId).reduce((sum, sc) => {
      const av = sc.versions.find(v => v.active) || sc.versions[0];
      return sum + (sc.actualDuration || this.estimatedDuration(av?.text || '') || 0);
    }, 0);
  },

  /* Onscreen */
  addOnscreen(sceneId, text='') {
    const sc = this.scene(sceneId); if (!sc) return;
    const item = { id:uid(), text, checked:false };
    this.updateScene(sceneId, { onscreen:[...sc.onscreen, item] }); return item;
  },
  updateOnscreen(sceneId, itemId, up) {
    const sc = this.scene(sceneId); if (!sc) return;
    this.updateScene(sceneId, { onscreen: sc.onscreen.map(o => o.id===itemId ? {...o,...up} : o) });
  },
  deleteOnscreen(sceneId, itemId) {
    const sc = this.scene(sceneId); if (!sc) return;
    this.updateScene(sceneId, { onscreen: sc.onscreen.filter(o => o.id !== itemId) });
  },

  /* References */
  addRef(sceneId, text='', url='') {
    const sc = this.scene(sceneId); if (!sc) return;
    const ref = { id:uid(), text, url };
    this.updateScene(sceneId, { refs:[...sc.refs, ref] }); return ref;
  },
  updateRef(sceneId, refId, up) {
    const sc = this.scene(sceneId); if (!sc) return;
    this.updateScene(sceneId, { refs: sc.refs.map(r => r.id === refId ? {...r,...up} : r) });
  },
  deleteRef(sceneId, refId) {
    const sc = this.scene(sceneId); if (!sc) return;
    this.updateScene(sceneId, { refs: sc.refs.filter(r => r.id !== refId) });
  },

  /* Settings */
  get(key)       { return this.d?.settings?.[key]; },
  set(key, val)  { if (!this.d.settings) this.d.settings={}; this.d.settings[key]=val; this._save(); },
};
