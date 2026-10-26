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


// ---------- Website SEO audit ----------
// Fetches a public web page and reports facts about it (titles, tags, schema, robots, speed). Scoring happens in the portal.
function ipv4Private(h) {
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}
function hostBlocked(host) {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (!h || h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".lan") || h.endsWith(".home")) return true;
  if (ipv4Private(h)) return true;
  if (h.includes(":")) return true; // any IPv6 literal
  if (!h.includes(".")) return true; // single-label names
  if (/^\d+$/.test(h.replace(/\./g, ""))) return true; // odd numeric forms
  return false;
}
function parseTarget(input, allowLocal) {
  let raw = String(input || "").trim();
  if (!raw || raw.length > 300) throw { code: "bad_url" };
  if (!/^https?:\/\//i.test(raw)) raw = "https://" + raw;
  let u;
  try { u = new URL(raw); } catch { throw { code: "bad_url" }; }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw { code: "bad_url" };
  if (u.username || u.password) throw { code: "bad_url" };
  if (!allowLocal) {
    if (hostBlocked(u.hostname)) throw { code: "blocked_host" };
    if (u.port && u.port !== "80" && u.port !== "443") throw { code: "blocked_host" };
  }
  return u;
}
async function readCapped(res, maxBytes) {
  const reader = res.body && res.body.getReader ? res.body.getReader() : null;
  if (!reader) { const t = await res.text(); return { text: t.slice(0, maxBytes), bytes: t.length, truncated: t.length > maxBytes }; }
  const chunks = []; let got = 0, truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    got += value.length;
    if (got > maxBytes) { chunks.push(value.slice(0, value.length - (got - maxBytes))); truncated = true; try { await reader.cancel(); } catch {} break; }
    chunks.push(value);
  }
  const buf = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0)); let o = 0;
  for (const c of chunks) { buf.set(c, o); o += c.length; }
  return { text: new TextDecoder("utf-8").decode(buf), bytes: got, truncated };
}
async function fetchPage(startUrl, { maxBytes = 1500000, timeout = 9000, allowLocal = false } = {}) {
  let url = startUrl, hops = [], t0 = Date.now();
  for (let i = 0; i < 6; i++) {
    parseTarget(url.href, allowLocal);
    const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), timeout);
    let res;
    try {
      res = await fetch(url.href, { redirect: "manual", signal: ctl.signal, headers: { "User-Agent": "ProofToProfitSEOBot/1.0 (+https://proof2profit.site)", Accept: "text/html,application/xhtml+xml,*/*;q=0.8", "Accept-Language": "en-US,en;q=0.8" } });
    } catch (e) { clearTimeout(timer); throw { code: "unreachable", message: String(e && e.name === "AbortError" ? "timed out" : (e && e.message) || e) }; }
    const ttfb = Date.now() - t0;
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      clearTimeout(timer); hops.push(url.href);
      try { url = new URL(res.headers.get("location"), url); } catch { throw { code: "unreachable", message: "bad redirect" }; }
      continue;
    }
    let body;
    try { body = await readCapped(res, maxBytes); } finally { clearTimeout(timer); }
    return { status: res.status, url, headers: res.headers, ttfb, total: Date.now() - t0, hops, ...body };
  }
  throw { code: "unreachable", message: "too many redirects" };
}
const stripTags = (s) => s.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
function attrs(tag) {
  const out = {}; const re = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g; let m;
  while ((m = re.exec(tag))) out[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? "";
  return out;
}
function schemaTypes(node, acc) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) { node.forEach((n) => schemaTypes(n, acc)); return; }
  const t = node["@type"]; if (t) (Array.isArray(t) ? t : [t]).forEach((x) => acc.types.push(String(x)));
  if (node.telephone) acc.phone = true;
  if (node.address) acc.address = true;
  if (node.openingHours || node.openingHoursSpecification) acc.hours = true;
  if (node.aggregateRating) acc.rating = true;
  if (node.geo) acc.geo = true;
  if (node.sameAs) acc.sameAs = true;
  if (node["@graph"]) schemaTypes(node["@graph"], acc);
  for (const k of Object.keys(node)) if (k !== "@graph" && typeof node[k] === "object") schemaTypes(node[k], acc);
}
function analyzeHtml(html, pageUrl) {
  const head = html.slice(0, 400000);
  const title = stripTags((head.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "");
  const metas = {}; const metaRe = /<meta\b[^>]*>/gi; let m;
  while ((m = metaRe.exec(html))) { const a = attrs(m[0]); const k = (a.name || a.property || a["http-equiv"] || "").toLowerCase(); if (k && a.content != null && metas[k] == null) metas[k] = a.content; }
  const links = []; const linkRe = /<link\b[^>]*>/gi; while ((m = linkRe.exec(html))) links.push(attrs(m[0]));
  const rels = (r) => links.filter((l) => (l.rel || "").toLowerCase().split(/\s+/).includes(r));
  const canonical = (rels("canonical")[0] || {}).href || null;
  const icon = links.some((l) => /(^|\s)(icon|shortcut|apple-touch-icon)(\s|$)/i.test(l.rel || ""));
  const hreflang = links.filter((l) => /alternate/i.test(l.rel || "") && l.hreflang).length;
  const lang = ((html.match(/<html[^>]*\blang\s*=\s*["']?([\w-]+)/i) || [])[1]) || null;
  const h1 = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((x) => stripTags(x[1])).filter(Boolean);
  const h2 = [...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)].map((x) => stripTags(x[1])).filter(Boolean);
  const h3 = (html.match(/<h3\b/gi) || []).length;
  const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map((x) => attrs(x[0]));
  const imgMissingAlt = imgs.filter((i) => i.alt == null).length, imgEmptyAlt = imgs.filter((i) => i.alt === "").length;
  let internal = 0, external = 0, tel = 0, mailto = 0, mapsLink = false; const host = pageUrl.hostname.replace(/^www\./, "");
  for (const x of html.matchAll(/<a\b[^>]*>/gi)) {
    const href = attrs(x[0]).href; if (!href) continue;
    if (/^tel:/i.test(href)) { tel++; continue; } if (/^mailto:/i.test(href)) { mailto++; continue; }
    if (/^(#|javascript:)/i.test(href)) continue;
    if (/google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps/i.test(href)) mapsLink = true;
    try { const u = new URL(href, pageUrl); if (u.hostname.replace(/^www\./, "") === host) internal++; else external++; } catch {}
  }
  const mapsEmbed = /<iframe[^>]+src=["'][^"']*google\.[a-z.]+\/maps/i.test(html);
  const schema = { types: [], phone: false, address: false, hours: false, rating: false, geo: false, sameAs: false, blocks: 0, invalid: 0 };
  for (const x of html.matchAll(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    schema.blocks++; try { schemaTypes(JSON.parse(x[1].trim()), schema); } catch { schema.invalid++; }
  }
  schema.types = [...new Set(schema.types)].slice(0, 20);
  const visible = stripTags(html.replace(/<head[\s\S]*?<\/head>/i, " ").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<noscript[\s\S]*?<\/noscript>/gi, " ").replace(/<svg[\s\S]*?<\/svg>/gi, " ").replace(/<!--[\s\S]*?-->/g, " "));
  const words = visible ? visible.split(/\s+/).length : 0;
  return {
    title, titleLen: title.length, metaDescription: metas.description || "", metaDescLen: (metas.description || "").length,
    viewport: metas.viewport || null, robotsMeta: metas.robots || null, canonical, lang, favicon: icon, hreflang,
    h1, h2Count: h2.length, h3Count: h3, images: { total: imgs.length, missingAlt: imgMissingAlt, emptyAlt: imgEmptyAlt },
    links: { internal, external, tel, mailto }, mapsEmbed, mapsLink,
    og: { title: !!metas["og:title"], description: !!metas["og:description"], image: !!metas["og:image"] }, twitterCard: !!metas["twitter:card"],
    schema, words, scripts: (html.match(/<script\b/gi) || []).length, text: visible.slice(0, 6000),
  };
}
function parseRobots(txt) {
  let star = false, disallowAll = false; const sitemaps = [];
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim(); if (!line) continue;
    const mm = line.match(/^([\w-]+)\s*:\s*(.*)$/); if (!mm) continue;
    const k = mm[1].toLowerCase(), v = mm[2].trim();
    if (k === "user-agent") star = v === "*";
    else if (k === "disallow" && star && v === "/") disallowAll = true;
    else if (k === "sitemap" && v) sitemaps.push(v);
  }
  return { disallowAll, sitemaps: sitemaps.slice(0, 5) };
}
async function seoAudit(input, opts = {}) {
  const allowLocal = !!opts.allowLocal;
  const start = parseTarget(input, allowLocal);
  const inputHttps = start.protocol === "https:";
  const page = await fetchPage(start, { allowLocal });
  const ctype = page.headers.get("content-type") || "";
  const finalUrl = page.url;
  const out = { url: start.href, finalUrl: finalUrl.href, status: page.status, redirects: page.hops.length, https: finalUrl.protocol === "https:", inputWasHttp: !inputHttps,
    ttfbMs: page.ttfb, totalMs: page.total, htmlBytes: page.bytes, truncated: page.truncated, encoding: page.headers.get("content-encoding") || null,
    xRobots: page.headers.get("x-robots-tag") || null, contentType: ctype, fetchedAt: Date.now() };
  if (page.status >= 400) return { ...out, error: "http_" + page.status };
  if (!/html|xml/i.test(ctype) && !/<html|<!doctype/i.test(page.text.slice(0, 2000))) return { ...out, error: "not_html" };
  Object.assign(out, analyzeHtml(page.text, finalUrl));
  // http only site: is https available?
  if (!out.https) {
    try { const u2 = new URL(finalUrl.href); u2.protocol = "https:"; const r = await fetchPage(u2, { maxBytes: 20000, timeout: 5000, allowLocal }); out.httpsAvailable = r.status < 400; } catch { out.httpsAvailable = false; }
  }
  const origin = finalUrl.origin;
  const side = async (path, cap) => { try { const r = await fetchPage(new URL(path, origin), { maxBytes: cap, timeout: 5000, allowLocal }); return r; } catch { return null; } };
  const rb = await side("/robots.txt", 60000);
  out.robots = rb && rb.status === 200 && !/<html/i.test(rb.text.slice(0, 500)) ? { exists: true, ...parseRobots(rb.text) } : { exists: false, disallowAll: false, sitemaps: [] };
  const smUrl = out.robots.sitemaps[0] || origin + "/sitemap.xml";
  let sm = null; try { const u3 = parseTarget(smUrl, allowLocal); sm = await fetchPage(u3, { maxBytes: 300000, timeout: 5000, allowLocal }); } catch {}
  out.sitemap = sm && sm.status === 200 && /<urlset|<sitemapindex/i.test(sm.text) ? { exists: true, urls: (sm.text.match(/<loc>/gi) || []).length, index: /<sitemapindex/i.test(sm.text) } : { exists: false, urls: 0 };
  return out;
}

// ---------- Social profile reader ----------
// Reads only what a public profile page shows without logging in. Hosts and handles are fixed per platform (no free-form URLs).
function parseCount(t) {
  if (t == null) return null;
  const m = String(t).replace(/,/g, "").trim().match(/^([\d.]+)\s*([KMB])?/i);
  if (!m) return null;
  const mult = { K: 1e3, M: 1e6, B: 1e9 }[(m[2] || "").toUpperCase()] || 1;
  return Math.round(parseFloat(m[1]) * mult);
}
function socialTarget(input) {
  let raw = String(input || "").trim();
  if (!raw || raw.length > 200) throw { code: "bad_url" };
  if (/^@?[\w.]+$/.test(raw) && !raw.includes("/")) throw { code: "bad_url" };
  if (!/^https?:\/\//i.test(raw)) raw = "https://" + raw;
  let u; try { u = new URL(raw); } catch { throw { code: "bad_url" }; }
  const h = u.hostname.toLowerCase().replace(/^(www|m|mobile)\./, "");
  const seg = u.pathname.split("/").filter(Boolean);
  const clean = (x) => String(x || "").replace(/^@/, "");
  if (h === "instagram.com" || h === "instagr.am") { const n = clean(seg[0]); if (!/^[A-Za-z0-9._]{1,30}$/.test(n) || /^(p|reel|reels|explore|stories|accounts|tv)$/i.test(n)) throw { code: "bad_url" }; return { platform: "instagram", handle: n, url: "https://www.instagram.com/" + n + "/" }; }
  if (h === "tiktok.com") { const n = clean(seg[0]); if (!/^[A-Za-z0-9._]{2,24}$/.test(n) || !String(seg[0] || "").startsWith("@")) throw { code: "bad_url" }; return { platform: "tiktok", handle: n, url: "https://www.tiktok.com/@" + n }; }
  if (h === "facebook.com" || h === "fb.com") { const n = clean(seg[0]); if (!/^[A-Za-z0-9.\-]{3,60}$/.test(n) || /^(profile\.php|pages|groups|watch|share|sharer|story\.php)$/i.test(n)) throw { code: "bad_url" }; return { platform: "facebook", handle: n, url: "https://www.facebook.com/" + n + "/" }; }
  if (h === "youtube.com" || h === "youtu.be") { const n = seg[0] && seg[0].startsWith("@") ? clean(seg[0]) : null; if (!n || !/^[A-Za-z0-9._\-]{2,60}$/.test(n)) throw { code: "bad_url" }; return { platform: "youtube", handle: n, url: "https://www.youtube.com/@" + n }; }
  if (h === "x.com" || h === "twitter.com") { const n = clean(seg[0]); if (!/^[A-Za-z0-9_]{1,15}$/.test(n) || /^(home|i|search|explore|intent|share)$/i.test(n)) throw { code: "bad_url" }; return { platform: "x", handle: n, url: "https://x.com/" + n }; }
  throw { code: "unsupported_platform" };
}
function metaContent(html, key) {
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) { const a = attrs(m[0]); if ((a.property || a.name || "").toLowerCase() === key && a.content != null) return a.content.replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#39;|&#x27;/g, "'"); }
  return null;
}
function readSocial(t, html) {
  const out = { platform: t.platform, handle: t.handle, url: t.url, found: false };
  const desc = metaContent(html, "og:description") || metaContent(html, "description") || "";
  const title = metaContent(html, "og:title") || (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "";
  out.name = stripTags(title).replace(/\s*[(•|\-–].*$/, "").slice(0, 80) || null;
  out.snippet = stripTags(desc).slice(0, 240);
  if (t.platform === "instagram") {
    const m = desc.match(/([\d.,]+[KMB]?)\s+Followers?,\s*([\d.,]+[KMB]?)\s+Following,\s*([\d.,]+[KMB]?)\s+Posts?/i);
    if (m) { out.followers = parseCount(m[1]); out.following = parseCount(m[2]); out.posts = parseCount(m[3]); out.found = true; }
  } else if (t.platform === "tiktok") {
    const j = html.match(/<script[^>]*id=["']__UNIVERSAL_DATA_FOR_REHYDRATION__["'][^>]*>([\s\S]*?)<\/script>/i);
    if (j) { try { const d = JSON.parse(j[1]); const u = d?.["__DEFAULT_SCOPE__"]?.["webapp.user-detail"]?.userInfo; const st = u?.stats || u?.statsV2; if (st) { out.followers = Number(st.followerCount); out.following = Number(st.followingCount); out.posts = Number(st.videoCount); out.hearts = Number(st.heartCount); out.verified = !!u?.user?.verified; out.name = u?.user?.nickname || out.name; out.found = Number.isFinite(out.followers); } } catch {} }
    if (!out.found) { const m = desc.match(/([\d.,]+[KMB]?)\s+Followers?[^\d]+([\d.,]+[KMB]?)\s+Likes?/i); if (m) { out.followers = parseCount(m[1]); out.hearts = parseCount(m[2]); out.found = true; } }
  } else if (t.platform === "facebook") {
    const m = desc.match(/([\d.,]+[KMB]?)\s+likes?/i), n = desc.match(/([\d.,]+[KMB]?)\s+talking about this/i), f = desc.match(/([\d.,]+[KMB]?)\s+followers?/i);
    if (m || f) { out.followers = parseCount((f || m)[1]); out.likes = m ? parseCount(m[1]) : null; out.talking = n ? parseCount(n[1]) : null; out.found = true; }
  } else if (t.platform === "youtube") {
    const s = html.match(/"subscriberCountText"\s*:\s*\{[^}]*?"(?:simpleText|content)"\s*:\s*"([\d.,]+\s*[KMB]?)\s+subscribers?/i) || html.match(/([\d.,]+[KMB]?)\s+subscribers?/i);
    const v = html.match(/"videosCountText"\s*:\s*\{[^}]*?"(?:simpleText|content)"\s*:\s*"([\d.,]+[KMB]?)\s+videos?/i) || html.match(/([\d.,]+)\s+videos?\b/i);
    if (s) { out.followers = parseCount(s[1]); out.posts = v ? parseCount(v[1]) : null; out.found = true; }
  }
  for (const k of ["followers", "following", "posts", "hearts", "likes", "talking"]) if (out[k] != null && !Number.isFinite(out[k])) delete out[k];
  return out;
}
async function socialAudit(input) {
  const t = socialTarget(input);
  const ua = t.platform === "instagram" || t.platform === "facebook" ? "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)" : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
  let page;
  try {
    const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 9000);
    const res = await fetch(t.url, { redirect: "follow", signal: ctl.signal, headers: { "User-Agent": ua, "Accept-Language": "en-US,en;q=0.9", Accept: "text/html,application/xhtml+xml" } });
    const body = await readCapped(res, 1500000); clearTimeout(timer);
    page = { status: res.status, finalUrl: res.url || t.url, html: body.text };
  } catch (e) { throw { code: "unreachable", message: String((e && e.message) || e) }; }
  const loginWall = /\/accounts\/login|login_required|"loginRequired"|Log in to continue|captcha|verify you are human/i.test(page.html.slice(0, 200000)) && !/og:description/i.test(page.html);
  const out = readSocial(t, page.html);
  out.status = page.status; out.fetchedAt = Date.now();
  if (page.status === 404) out.error = "not_found_profile";
  else if (!out.found) out.error = loginWall || page.status === 403 || page.status === 429 ? "blocked" : "no_public_stats";
  return out;
}

// ---------- AI social assessment: public read + Google Search grounding, then a structured report ----------
function parseJsonLoose(t) {
  t = String(t || "").replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try { return JSON.parse(t); } catch (e) { const a = t.indexOf("{"), b = t.lastIndexOf("}"); if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (e2) {} } return null; }
}
async function socialAssess(env, input) {
  const t = socialTarget(input);
  let direct = null;
  try { direct = await socialAudit(input); } catch (e) { direct = null; }
  const who = `${t.platform} profile @${t.handle} (${t.url})`;
  const g1 = await gemini(env, {
    contents: [{ role: "user", parts: [{ text: `Find what is publicly known about the ${who}. Report only what current web sources show: approximate follower count, how often it posts, typical likes/comments/views per post, content themes, recent activity, collaborations or press, and any signs the account is inactive. Give figures only when a source states them. If you find almost nothing, say so plainly.` }] }],
    tools: [{ google_search: {} }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 1500 },
  });
  const research = g1.status === 200 ? textOf(g1.data).trim() : "";
  const chunks = g1.data?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const sources = chunks.map((c) => c.web?.title).filter(Boolean).slice(0, 4);
  const haveDirect = !!(direct && direct.found);
  if (!haveDirect && research.length < 80) throw { code: "no_data", message: "research status " + g1.status + (g1.data?.error?.message ? ": " + String(g1.data.error.message).slice(0, 160) : "") };
  const facts = direct && direct.found ? `Read directly from the profile page: followers ${direct.followers}, following ${direct.following ?? "unknown"}, posts ${direct.posts ?? "unknown"}, total likes ${direct.hearts ?? "unknown"}.` : "The profile page itself could not be read directly.";
  const prompt = `Respond with ONLY a single JSON object, no markdown. Never put a literal double-quote inside a string value.

You are a social media analyst for a small local business. Assess this ${who} for engagement and health.

Evidence:
${facts}
Web research: ${research || "nothing found"}

Rules: use ONLY the evidence above. Never invent follower counts, engagement figures or posts. If evidence is thin, say so, lower confidence and give a cautious score. Engagement benchmarks are rough industry rules of thumb.

{"score":0-100 integer,"confidence":"high|medium|low","followers":number or null,"engagement":"one sentence on how engaged the audience looks and why","posting":"one sentence on posting consistency","score_reason":"2 sentences explaining how the score was reached and what it is based on","headline":"one sentence verdict","strengths":["2-3 items"],"gaps":["2-3 items"],"content_ideas":["3 specific post ideas for this kind of business"],"posting_plan":"one sentence weekly rhythm","evidence_note":"one sentence on what was and was not available"}`;
  const g2 = await gemini(env, { contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.3, maxOutputTokens: 2500, responseMimeType: "application/json" } });
  if (g2.status === 429) throw { code: "rate_limited" };
  if (g2.status !== 200) throw { code: "ai_error", message: g2.data?.error?.message || "AI request failed" };
  const r = parseJsonLoose(textOf(g2.data));
  if (!r || typeof r.headline !== "string") throw { code: "ai_error", message: "unreadable AI answer" };
  r.score = Math.max(0, Math.min(100, Math.round(Number(r.score) || 0)));
  if (!["high", "medium", "low"].includes(r.confidence)) r.confidence = "low";
  if (direct && direct.found && Number.isFinite(direct.followers)) r.followers = direct.followers;
  else if (!Number.isFinite(Number(r.followers))) r.followers = null;
  return { platform: t.platform, handle: t.handle, url: t.url, report: r, direct: direct && direct.found ? { followers: direct.followers, following: direct.following ?? null, posts: direct.posts ?? null, hearts: direct.hearts ?? null } : null, sources, ts: Date.now() };
}

export { seoAudit, socialAudit, socialTarget, readSocial, socialAssess };

export default {
  async scheduled(event, env, ctx) { ctx.waitUntil(drain(env)); },
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

    if (path === "/social") {
      const u = await bump(env, token, "social", parseInt(env.DAILY_SOCIAL_LIMIT || "30", 10));
      if (!u.auth) return json({ error: "not_signed_in" }, 401, h);
      if (u.error) return json({ error: "usage_check_failed" }, 502, h);
      if (!u.allowed) return json({ error: "rate_limited" }, 429, h);
      try {
        return json({ result: await socialAudit(body.url) }, 200, h);
      } catch (e) {
        const code = e && e.code ? e.code : "audit_failed";
        return json({ error: code, message: (e && e.message) || "" }, code === "bad_url" || code === "unsupported_platform" ? 400 : 502, h);
      }
    }

    if (path === "/social-assess") {
      const u = await bump(env, token, "social", parseInt(env.DAILY_SOCIAL_LIMIT || "30", 10));
      if (!u.auth) return json({ error: "not_signed_in" }, 401, h);
      if (u.error) return json({ error: "usage_check_failed" }, 502, h);
      if (!u.allowed) return json({ error: "rate_limited" }, 429, h);
      try {
        return json({ result: await socialAssess(env, body.url) }, 200, h);
      } catch (e) {
        const code = e && e.code ? e.code : "audit_failed";
        return json({ error: code, message: (e && e.message) || "" }, code === "rate_limited" ? 429 : code === "no_data" ? 422 : code === "bad_url" || code === "unsupported_platform" ? 400 : 502, h);
      }
    }

    if (path === "/seo") {
      const u = await bump(env, token, "seo", parseInt(env.DAILY_SEO_LIMIT || "20", 10));
      if (!u.auth) return json({ error: "not_signed_in" }, 401, h);
      if (u.error) return json({ error: "usage_check_failed" }, 502, h);
      if (!u.allowed) return json({ error: "rate_limited" }, 429, h);
      try {
        return json({ result: await seoAudit(body.url) }, 200, h);
      } catch (e) {
        const code = e && e.code ? e.code : "audit_failed";
        return json({ error: code, message: (e && e.message) || "" }, code === "bad_url" || code === "blocked_host" ? 400 : 502, h);
      }
    }

    return json({ error: "not_found" }, 404, h);
  },
};

// Sends queued emails (email_outbox in Supabase) through Resend. Runs on a cron trigger (every 5 minutes).
// Needs secrets RESEND_API_KEY and OUTBOX_SECRET; does nothing until both exist.
async function drain(env) {
  if (!env.RESEND_API_KEY || !env.OUTBOX_SECRET) return;
  const base = env.SUPABASE_URL + "/rest/v1/rpc/";
  const hdr = { apikey: env.SUPABASE_ANON_KEY, Authorization: "Bearer " + env.SUPABASE_ANON_KEY, "Content-Type": "application/json" };
  const r = await fetch(base + "claim_outbox", { method: "POST", headers: hdr, body: JSON.stringify({ p_secret: env.OUTBOX_SECRET, p_limit: 20 }) });
  if (!r.ok) return;
  const rows = await r.json();
  const results = [];
  for (const m of rows) {
    try {
      const s = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: "Bearer " + env.RESEND_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ from: env.MAIL_FROM || "Proof to Profit <noreply@proof2profit.site>", to: [m.to_email], subject: m.subject, html: m.html }),
      });
      results.push({ id: m.id, ok: s.ok, error: s.ok ? null : (await s.text()).slice(0, 300) });
    } catch (e) {
      results.push({ id: m.id, ok: false, error: String(e).slice(0, 300) });
    }
  }
  if (results.length) await fetch(base + "finish_outbox", { method: "POST", headers: hdr, body: JSON.stringify({ p_secret: env.OUTBOX_SECRET, p_results: results }) });
}
