/* app/api/claude/route.js — server-side proxy for Anthropic API (avoids CORS) */
export async function POST(req) {
  try {
    const { prompt, apiKey } = await req.json();

    if (!apiKey) {
      return Response.json({ error: 'No Claude API key provided' }, { status: 400 });
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return Response.json(
        { error: err.error?.message || `Claude API error ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    const text = data.content?.[0]?.text?.trim() || '';
    return Response.json({ text });

  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
