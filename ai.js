/* ─── ai.js — Gemini API Integration ─── */

const AI_WPM = 150; // local constant (same value as WPM in app.js)

const AI = {
  key() { return State.get('apiKey') || ''; },

  async call(prompt) {
    const key = this.key();
    if (!key) throw new Error('No API key. Open Settings (gear icon) and paste your Gemini API key.');
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.72, maxOutputTokens: 2048 }
        })
      }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `API error ${res.status}`);
    }
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
  },

  async polishNarration(sceneId) {
    const sc = State.scene(sceneId);
    if (!sc) throw new Error('Scene not found');
    const all = State.scenes(sc.scriptId);
    const idx = all.findIndex(s => s.id === sceneId);
    const activeText = scene => (scene.versions.find(v => v.active) || scene.versions[0])?.text || '';
    const cur  = activeText(sc);
    const prev = idx > 0            ? activeText(all[idx-1]) : null;
    const next = idx < all.length-1 ? activeText(all[idx+1]) : null;
    const targetWords = Math.round((sc.actualDuration || State.estimatedDuration(cur)) * AI_WPM / 60);

    const prompt = `You are a professional video script editor. Polish the following scene narration.

${prev ? `PREVIOUS SCENE:\n"${prev}"\n` : '(First scene — no previous context)'}

CURRENT SCENE TO POLISH:
"${cur}"

${next ? `NEXT SCENE:\n"${next}"\n` : '(Last scene)'}

CONSTRAINTS:
- Target ~${targetWords} words (${sc.actualDuration || State.estimatedDuration(cur)}s at 150 WPM)
- Preserve the author's voice, conciseness, and visual style
- Ensure narrative flow with surrounding scenes
- Written for spoken-word video narration

Return ONLY the polished narration text. No preamble, no quotes, no explanation.`;

    const polished = await this.call(prompt);
    return State.addVersion(sceneId, polished);
  },

  async generateYouTubeAssets(scriptId) {
    const script = State.script(scriptId);
    if (!script) throw new Error('Script not found');
    const scenes = State.scenes(scriptId);
    const narration = scenes.map((sc, i) => {
      const txt = (sc.versions.find(v => v.active) || sc.versions[0])?.text || '';
      return `[Scene ${i+1}: ${sc.title}]\n${txt}`;
    }).join('\n\n');
    const allRefs = scenes.flatMap(sc => sc.refs.map(r => r.text).filter(Boolean));

    const prompt = `Based on this video script, generate YouTube metadata.

TITLE: ${script.title}

FULL NARRATION:
${narration}

${allRefs.length ? `REFERENCES:\n${allRefs.join('\n')}` : ''}

Respond ONLY with valid JSON (no markdown fences):
{
  "description": "compelling 3-paragraph YouTube description with relevant hashtags",
  "tags": ["10 to 15 relevant tags"],
  "alternateTitles": [
    {"title": "...", "rationale": "one sentence why this works for A/B testing"},
    {"title": "...", "rationale": "..."},
    {"title": "...", "rationale": "..."},
    {"title": "...", "rationale": "..."},
    {"title": "...", "rationale": "..."}
  ]
}`;

    const raw = await this.call(prompt);
    try { return JSON.parse(raw); } catch(_) {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) return JSON.parse(m[0]);
      throw new Error('Could not parse AI response as JSON');
    }
  }
};
