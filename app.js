/* ─── app.js — State & Data Layer ─── */

const STORAGE_KEY = 'scriptapp_v2';
const WPM = 150;

function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }
function now() { return Date.now(); }

/* ── Seed data matching reference screenshots ── */
const SEED = {
  projects: [
    { id: 'p1', title: 'HK IN 5 HOURS',  status: 'in-progress', createdAt: now() },
    { id: 'p2', title: 'TAICHUNG',        status: 'backlog',     createdAt: now() },
    { id: 'p3', title: 'LIMINAL SPACES',  status: 'backlog',     createdAt: now() },
    { id: 'p4', title: 'MY TOOLS',        status: 'in-progress', createdAt: now() },
    { id: 'p5', title: 'HOW I JOURNAL',   status: 'done',        createdAt: now() },
    { id: 'p6', title: 'HK CORNER HOUSE', status: 'done',        createdAt: now() },
  ],
  scripts: [
    { id: 'sc1', projectId: 'p1', title: 'HK IN 5 HOURS', updatedAt: now() }
  ],
  scenes: [
    { id:'s1', scriptId:'sc1', orderIndex:0, title:'INTRO',
      versions:[{ id:'v1', text:`Today, I present a report on a five-hour stopover in Hong Kong with a tight itinerary. To guide the route, we have a guest tourist — hand-drawn by my friend Kristina. We follow my field notes: move at the right speed; use thresholds to reset attention; make stairs do real work; keep signage tame; calm; let materials carry identity. That's today's Hong Kong trip.`, type:'original', active:true, createdAt:now() }],
      actualDuration:30,
      onscreen:[{id:'o1',text:'香港での五時間',checked:false},{id:'o2',text:'HONG KONG IN 5 HOURS',checked:false},{id:'o3',text:'ルートの地図、彼女が旅す、彼たちは動く.',checked:false},{id:'o4',text:'Route companion: She points; We move.',checked:false}],
      refs:[{id:'r1',text:'ChrisKa',url:''}], media:[]
    },
    { id:'s2', scriptId:'sc1', orderIndex:1, title:'HKMOA',
      versions:[{ id:'v2', text:`We start at the Hong Kong Museum of Art. After its overhaul, it reopened with expanded galleries facing the harbour. The identity compresses the name into a logomark with a distinctive O. The monochrome gradient nods to ink traditions. It's a graphic system that matches the building's clarity. Architecture and identity speaking the same language.`, type:'original', active:true, createdAt:now() }],
      actualDuration:35,
      onscreen:[{id:'o5',text:'Chinese ink aesthetics',checked:false},{id:'o6',text:'Logo designed by CODESIGN LTD',checked:false},{id:'o7',text:'Antiquities, Painting, Calligraphy, Modern art',checked:false},{id:'o8',text:'Page from my journal',checked:false},{id:'o9',text:'Hong Kong Museum of Art HKMOA 香港藝術館',checked:false}],
      refs:[{id:'r2',text:'CoDesign Ltd.',url:''},{id:'r3',text:'DFA Awards',url:''}], media:[]
    },
    { id:'s3', scriptId:'sc1', orderIndex:2, title:'LOVELETTERS',
      versions:[{ id:'v3', text:`Video permissions vary by gallery, and 3D scanning isn't allowed. So here's a fictional poster in my journal as a memory of Love Letters. If you want more on my journaling approach, the link is in the description.`, type:'original', active:true, createdAt:now() }],
      actualDuration:30,
      onscreen:[{id:'o10',text:"A fictional poster for 'Love Letters'",checked:false}],
      refs:[{id:'r4',text:'How I Journal as a Designer; in Japan',url:''}], media:[]
    },
    { id:'s4', scriptId:'sc1', orderIndex:3, title:'PIER',
      versions:[{ id:'v4', text:`Time to cross the bay. You enter the pier and grasp the void of the harbour. Ferries are double-ended — no turning, just continuous boarding and alighting. Open sides keep cross-ventilation going. Design-wise, the green-and-white livery ties boat and building into one identity. A simple system, repeated.`, type:'original', active:true, createdAt:now() }],
      actualDuration:35,
      onscreen:[{id:'o11',text:'Cross-ventilation',checked:false},{id:'o12',text:'Star Ferry pier 尖沙咀（天星）碼頭',checked:false},{id:'o13',text:'Kowloon',checked:false},{id:'o14',text:'Upper deck',checked:false}],
      refs:[], media:[]
    },
    { id:'s5', scriptId:'sc1', orderIndex:4, title:'STAR FERRY',
      versions:[{ id:'v5', text:`Crossing time is ~8–9 minutes; it's the historic Island–Kowloon connector until the 1972 cross-harbour tunnel. It's also a one of a kind experience — skyline, breeze. Helps to get refreshed.`, type:'original', active:true, createdAt:now() }],
      actualDuration:50,
      onscreen:[{id:'o15',text:'Star Ferry',checked:false},{id:'o16',text:'Central 中環 (天星) 碼頭',checked:false},{id:'o17',text:'Kowloon 九龍 (天星) 碼頭',checked:false},{id:'o18',text:'8–9 min',checked:false}],
      refs:[{id:'r5',text:'Star Ferry Heritage',url:''}], media:[]
    },
    { id:'s6', scriptId:'sc1', orderIndex:5, title:'MARKET',
      versions:[{ id:'v6', text:`From the pier, the Central Market building pulls you in. The Central Market — a 1939 Bauhaus-Moderne market building — was renovated in 2021. Read the horizontal atrium as "public condenser": stairs, simple lines, and a distinctive interior that keeps the building alive as a pedestrian node.`, type:'original', active:true, createdAt:now() }],
      actualDuration:30,
      onscreen:[{id:'o19',text:'Central Market as a Public Condenser',checked:false},{id:'o20',text:'1889 → 2021',checked:false},{id:'o21',text:'Bauhaus Revitalised',checked:false}],
      refs:[{id:'r6',text:'Central Market',url:''}], media:[]
    }
  ],
  settings: { apiKey:'', activeScriptId:'sc1', activeProjectId:'p1' }
};

/* ── State singleton ── */
const State = {
  d: null,

  init() {
    try { this.d = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch(_) {}
    if (!this.d) this.d = JSON.parse(JSON.stringify(SEED));
    if (!this.d.settings) this.d.settings = { apiKey:'', activeScriptId:null, activeProjectId:null };
    this._save();
  },

  _save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.d)); },

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
      actualDuration:30, onscreen:[], refs:[], media:[]
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

  /* Onscreen checkist */
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
  deleteRef(sceneId, refId) {
    const sc = this.scene(sceneId); if (!sc) return;
    this.updateScene(sceneId, { refs: sc.refs.filter(r => r.id !== refId) });
  },

  /* Settings */
  get(key)       { return this.d.settings?.[key]; },
  set(key, val)  { if (!this.d.settings) this.d.settings={}; this.d.settings[key]=val; this._save(); },
};
