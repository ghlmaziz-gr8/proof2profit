// Proof to Profit API: holds the Gemini key, checks the signed-in Supabase user,
// enforces daily limits, and returns results to the portal.

const GEMINI = "https://generativelanguage.googleapis.com/v1beta/models/";

function cors(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim());
  const ok = allowed.includes(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin : allowed[0] || "",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

// Ask Supabase to count this call for the signed-in user (also validates the token).
async function bump(env, token, kind, limit) {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/bump_usage`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ kind, daily_limit: limit }),
  });
  if (r.status === 401 || r.status === 403) return { auth: false };
  if (!r.ok) return { auth: true, error: true };
  const data = await r.json();
  return { auth: true, allowed: !!data.allowed, used: data.used };
}

async function gemini(env, body) {
  const model = env.GEMINI_MODEL || "gemini-2.5-flash";
  const r = await fetch(`${GEMINI}${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  return { status: r.status, data };
}

function textOf(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.map((p) => p.text || "").join("");
}

export default {
  async fetch(request, env) {
    const h = cors(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405, h);

    const origin = request.headers.get("Origin") || "";
    const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim());
    if (!allowed.includes(origin)) return json({ error: "origin_not_allowed" }, 403, h);

    const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "not_signed_in" }, 401, h);

    const path = new URL(request.url).pathname;
    let body;
    try { body = await request.json(); } catch { return json({ error: "bad_request" }, 400, h); }

    if (path === "/sample") {
      const prompt = String(body.prompt || "");
      if (!prompt) return json({ error: "bad_request" }, 400, h);
      if (prompt.length > 24000) return json({ error: "prompt_too_large" }, 413, h);
      const u = await bump(env, token, "analysis", parseInt(env.DAILY_ANALYSIS_LIMIT || "30", 10));
      if (!u.auth) return json({ error: "not_signed_in" }, 401, h);
      if (u.error) return json({ error: "usage_check_failed" }, 502, h);
      if (!u.allowed) return json({ error: "rate_limited" }, 429, h);
      const g = await gemini(env, {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 4096, responseMimeType: "application/json" },
      });
      if (g.status === 429) return json({ error: "rate_limited" }, 429, h);
      if (g.status !== 200) return json({ error: "ai_error", message: g.data?.error?.message || "AI request failed" }, 502, h);
      const cand = g.data?.candidates?.[0];
      return json({ text: textOf(g.data), truncated: cand?.finishReason === "MAX_TOKENS" }, 200, h);
    }

    if (path === "/search") {
      const u = await bump(env, token, "search", parseInt(env.DAILY_SEARCH_LIMIT || "60", 10));
      if (!u.auth) return json({ error: "not_signed_in" }, 401, h);
      // Search is optional grounding: on any failure return no results so the app degrades gracefully.
      if (u.error || !u.allowed) return json({ payload: { results: [] } }, 200, h);
      const queries = (Array.isArray(body.search_queries) ? body.search_queries : []).slice(0, 4).map(String);
      const prompt =
        `${String(body.objective || "").slice(0, 600)}\n\nSearch for: ${queries.join(" | ")}\n\n` +
        "Summarise only what current web sources actually say: rating, review themes (praise and complaints), hours, menu or services, location. Be specific and factual. If you find nothing reliable, say so.";
      const g = await gemini(env, {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1500 },
      });
      if (g.status !== 200) return json({ payload: { results: [] } }, 200, h);
      const text = textOf(g.data).trim();
      const chunks = g.data?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      if (!text || !chunks.length) return json({ payload: { results: [] } }, 200, h);
      const titles = chunks.map((c) => c.web?.title).filter(Boolean).slice(0, 5).join(", ");
      return json(
        { payload: { results: [{ url: chunks[0].web?.uri || "", title: `Google Search results (${titles})`, excerpts: [text] }] } },
        200,
        h
      );
    }

    return json({ error: "not_found" }, 404, h);
  },
};
