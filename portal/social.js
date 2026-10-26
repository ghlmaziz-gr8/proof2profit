/* Social media: add profile links, read public stats where the platform allows it, take engagement numbers by hand, score them, track change over time. */
(function () {
  var RM = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var DAY = 864e5;
  function esc(t) { return String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function ex(t, h) { if (window.__p2pExplain) window.__p2pExplain(t, h); }
  function fmtD(ts) { return new Date(ts).toLocaleDateString("default", { month: "short", day: "numeric" }); }
  function colr(v) { return v >= 75 ? "#1D9E75" : v >= 50 ? "#F69500" : "#C24A34"; }
  function label(v) { return v >= 85 ? "Excellent" : v >= 70 ? "Good" : v >= 50 ? "Fair" : "Needs work"; }
  function nfmt(n) { if (n == null || isNaN(n)) return "–"; n = Number(n); return n >= 1e6 ? (Math.round(n / 1e5) / 10) + "M" : n >= 1e4 ? (Math.round(n / 100) / 10) + "K" : n >= 1e3 ? n.toLocaleString() : String(Math.round(n * 10) / 10); }
  function pnum(v) { if (v == null) return null; var s = String(v).trim().replace(/,/g, ""); if (!s) return null; var m = s.match(/^([\d.]+)\s*([kKmM])?$/); if (!m) return NaN; return Math.round(parseFloat(m[1]) * ({ k: 1e3, m: 1e6 }[(m[2] || "").toLowerCase()] || 1) * 100) / 100; }

  var PF = {
    instagram: { name: "Instagram", color: "#C13584", target: 12, er: [[5e3, 3.5, 6], [2e4, 2.5, 4], [1e5, 1.5, 3], [Infinity, 0.8, 1.8]], erNote: "likes + comments per post, as a share of followers", where: "Open your last 10 posts. Add up the likes and comments on each, then divide by 10." },
    tiktok: { name: "TikTok", color: "#111111", target: 16, er: [[1e4, 5, 10], [1e5, 4, 8], [Infinity, 3, 6]], erNote: "likes + comments per video, as a share of followers", where: "Open your last 10 videos. Add up likes and comments on each, then divide by 10." },
    facebook: { name: "Facebook", color: "#1877F2", target: 12, er: [[Infinity, 0.3, 0.9]], erNote: "reactions + comments per post, as a share of followers", where: "Open your last 10 posts. Add up reactions and comments, then divide by 10." },
    youtube: { name: "YouTube", color: "#E02020", target: 4, er: [[Infinity, 2, 4]], erNote: "likes + comments per video, as a share of subscribers", where: "Open your last 10 videos in YouTube Studio. Average the likes and comments." },
    x: { name: "X", color: "#14161A", target: 30, er: [[Infinity, 0.15, 0.6]], erNote: "likes + replies per post, as a share of followers", where: "Look at your last 10 posts. Add up likes and replies, then divide by 10." }
  };
  function detect(input) {
    var raw = String(input || "").trim(); if (!raw) return null;
    if (!/^https?:\/\//i.test(raw)) raw = "https://" + raw;
    var u; try { u = new URL(raw); } catch (e) { return null; }
    var h = u.hostname.toLowerCase().replace(/^(www|m|mobile)\./, ""), seg = u.pathname.split("/").filter(Boolean), c = function (x) { return String(x || "").replace(/^@/, ""); };
    if (/^(instagram\.com|instagr\.am)$/.test(h) && /^[A-Za-z0-9._]{1,30}$/.test(c(seg[0])) && !/^(p|reel|reels|explore|stories|accounts|tv)$/i.test(c(seg[0]))) return { platform: "instagram", handle: c(seg[0]), url: "https://www.instagram.com/" + c(seg[0]) + "/" };
    if (h === "tiktok.com" && /^@[A-Za-z0-9._]{2,24}$/.test(seg[0] || "")) return { platform: "tiktok", handle: c(seg[0]), url: "https://www.tiktok.com/@" + c(seg[0]) };
    if (/^(facebook\.com|fb\.com)$/.test(h) && /^[A-Za-z0-9.\-]{3,60}$/.test(c(seg[0])) && !/^(profile\.php|pages|groups|watch|share|sharer|story\.php)$/i.test(c(seg[0]))) return { platform: "facebook", handle: c(seg[0]), url: "https://www.facebook.com/" + c(seg[0]) + "/" };
    if (/^(youtube\.com|youtu\.be)$/.test(h) && /^@[A-Za-z0-9._\-]{2,60}$/.test(seg[0] || "")) return { platform: "youtube", handle: c(seg[0]), url: "https://www.youtube.com/@" + c(seg[0]) };
    if (/^(x\.com|twitter\.com)$/.test(h) && /^[A-Za-z0-9_]{1,15}$/.test(c(seg[0])) && !/^(home|i|search|explore|intent|share)$/i.test(c(seg[0]))) return { platform: "x", handle: c(seg[0]), url: "https://x.com/" + c(seg[0]) };
    return null;
  }

  function bench(p, followers) { var t = PF[p].er; for (var i = 0; i < t.length; i++) if (followers < t[i][0]) return { avg: t[i][1], good: t[i][2] }; return { avg: t[t.length - 1][1], good: t[t.length - 1][2] }; }
  function erScore(er, b) {
    if (er >= b.good) return Math.min(100, 85 + (er - b.good) / b.good * 15);
    if (er >= b.avg) return 55 + (er - b.avg) / (b.good - b.avg) * 30;
    if (er >= 0.4 * b.avg) return 25 + (er - 0.4 * b.avg) / (0.6 * b.avg) * 30;
    return Math.max(2, er / (0.4 * b.avg) * 25);
  }
  // Metrics and score for one profile from its snapshots (oldest to newest).
  function analyze(pr) {
    var sn = pr.snaps || [], L = sn[sn.length - 1]; if (!L) return null;
    var P = PF[pr.platform], f = L.followers, m = { f: f, parts: [] };
    var likes = L.avgLikes, comm = L.avgComments || 0, est = false;
    if (likes == null && pr.platform === "tiktok" && L.hearts != null && L.posts) { likes = L.hearts / L.posts; comm = 0; est = true; }
    if (likes != null && f > 0) {
      m.er = (likes + comm) / f * 100; m.erEst = est; m.bench = bench(pr.platform, f); m.erScore = erScore(m.er, m.bench);
      m.parts.push({ k: "er", w: 50, v: m.erScore });
    }
    if (L.avgViews != null && f > 0) m.viewRate = L.avgViews / f * 100;
    var ppm = L.ppm;
    if (ppm == null && sn.length > 1) { for (var i = sn.length - 2; i >= 0; i--) { var d = (L.ts - sn[i].ts) / DAY; if (d >= 7 && L.posts != null && sn[i].posts != null) { ppm = Math.max(0, (L.posts - sn[i].posts) / d * 30); m.ppmDerived = true; break; } } }
    if (ppm != null) { m.ppm = ppm; m.ppmScore = Math.max(10, Math.min(100, ppm / P.target * 100)); m.parts.push({ k: "ppm", w: 25, v: m.ppmScore }); }
    if (L.following > 0 && f > 0) { m.ratio = f / L.following; m.ratioScore = m.ratio >= 3 ? 100 : m.ratio >= 1.5 ? 80 : m.ratio >= 1 ? 60 : m.ratio >= 0.5 ? 35 : 15; m.parts.push({ k: "ratio", w: 10, v: m.ratioScore }); }
    for (var j = sn.length - 2; j >= 0; j--) { var dd = (L.ts - sn[j].ts) / DAY; if (dd >= 7 && sn[j].followers > 0) { m.growth = (f - sn[j].followers) / sn[j].followers / dd * 30 * 100; m.growthDays = Math.round(dd); m.growthAbs = f - sn[j].followers; m.growthScore = m.growth >= 5 ? 100 : m.growth >= 2 ? 80 : m.growth >= 0.5 ? 60 : m.growth >= 0 ? 40 : 15; m.parts.push({ k: "growth", w: 15, v: m.growthScore }); break; } }
    var tw = m.parts.reduce(function (a, p) { return a + p.w; }, 0), tg = m.parts.reduce(function (a, p) { return a + p.w * p.v; }, 0);
    m.score = tw ? Math.round(tg / tw) : null; m.tw = tw; m.L = L;
    return m;
  }

  function mount(el, opts) {
    if (!el) return;
    var kvKey = "reviewlens_social_" + opts.slug, data = { profiles: [] }, busy = false;
    el.innerHTML = '<section class="soc"><div class="soc-top"><p class="soc-eyebrow">Social media</p><h3>How well is your social media working?</h3><p class="soc-meta">Add your profile links. We read what each platform shows publicly, and you add your recent likes and comments for an engagement score.</p></div>' +
      '<form class="soc-form"><input type="text" class="soc-in" inputmode="url" autocapitalize="off" autocomplete="off" spellcheck="false" placeholder="instagram.com/yourbusiness or tiktok.com/@yourbusiness" aria-label="Social profile link"><button type="submit" class="soc-go">Add profile</button></form><p class="soc-err" hidden></p><div class="soc-body"></div></section>';
    var root = el.querySelector(".soc"), inp = root.querySelector(".soc-in"), errEl = root.querySelector(".soc-err"), body = root.querySelector(".soc-body");
    function err(t) { errEl.textContent = t || ""; errEl.hidden = !t; }
    function persist() { if (opts.save) opts.save(kvKey, data); }
    if (opts.load) Promise.resolve(opts.load(kvKey, null)).then(function (d) { if (d && d.profiles) { data = d; draw(); } }).catch(function () { });

    function readErr(e) {
      var c = e && e.code;
      if (c === "rate_limited") return "You have reached today's limit for reading profiles. It resets daily.";
      if (c === "not_found") return "The social reader is not switched on yet. Update the Worker with the latest code first.";
      return "Could not read that profile right now. You can still type your numbers in.";
    }
    function applyRead(pr, R) {
      var last = pr.snaps[pr.snaps.length - 1];
      if (!R || !R.found) { return R && R.error === "blocked" ? pr.name + " blocks automatic reading, so type in your numbers below." : (R && R.error === "not_found_profile" ? "That profile was not found. Check the link." : "No public stats were visible on that profile. Type in your numbers below."); }
      pr.display = R.name || pr.display;
      var s = { ts: Date.now(), followers: R.followers, following: R.following != null ? R.following : null, posts: R.posts != null ? R.posts : null, hearts: R.hearts != null ? R.hearts : null, src: "auto" };
      if (last) { ["avgLikes", "avgComments", "avgViews", "ppm"].forEach(function (k) { if (last[k] != null && (Date.now() - last.ts) < 45 * DAY) s[k] = last[k]; }); }
      pr.snaps.push(s); if (pr.snaps.length > 24) pr.snaps.shift();
      return "";
    }
    function readProfile(pr, btn) {
      var api = window.__p2p && window.__p2p.api; if (!api) { err("Not available right now."); return Promise.resolve(); }
      btn && (btn.disabled = true, btn.textContent = "Reading…");
      return api("/social", { url: pr.url }).then(function (r) { var msg = applyRead(pr, r.result); persist(); draw(); if (msg) err(msg); else err(""); })
        .catch(function (e) { err(readErr(e)); draw(); });
    }

    root.querySelector(".soc-form").addEventListener("submit", function (e) {
      e.preventDefault(); err("");
      var d = detect(inp.value);
      if (!d) { err("Use the link to the profile itself, like instagram.com/yourbusiness, tiktok.com/@yourbusiness, facebook.com/yourpage, youtube.com/@yourchannel or x.com/yourhandle."); return; }
      if (data.profiles.some(function (p) { return p.platform === d.platform && p.handle.toLowerCase() === d.handle.toLowerCase(); })) { err("That profile is already added."); return; }
      if (data.profiles.length >= 6) { err("You can track up to 6 profiles."); return; }
      var pr = { id: "p" + Date.now(), platform: d.platform, handle: d.handle, url: d.url, name: PF[d.platform].name, snaps: [] };
      data.profiles.push(pr); inp.value = ""; persist(); draw();
      readProfile(pr, null);
    });

    function tile(k, big, small, pid) { return '<button type="button" class="soc-t" data-k="' + k + '" data-p="' + pid + '"><b>' + big + "</b><span>" + small + '</span><i class="soc-i">i</i></button>'; }
    function drawProfile(pr) {
      var P = PF[pr.platform], m = analyze(pr), L = pr.snaps[pr.snaps.length - 1], id = pr.id;
      var head = '<div class="soc-ph"><span class="soc-badge" style="background:' + P.color + '">' + P.name + '</span><a class="soc-h" href="' + esc(pr.url) + '" target="_blank" rel="noopener noreferrer">@' + esc(pr.handle) + '</a><span class="soc-ago">' + (L ? "updated " + fmtD(L.ts) : "no numbers yet") + '</span><button type="button" class="soc-x" data-del="' + id + '" aria-label="Remove profile">Remove</button></div>';
      var summary = "";
      if (m && m.score != null) {
        var R = 38, circ = 2 * Math.PI * R;
        summary = '<div class="soc-sum"><button type="button" class="soc-ring" data-k="score" data-p="' + id + '" aria-label="How the score is calculated"><svg viewBox="0 0 92 92" width="92" height="92"><circle cx="46" cy="46" r="' + R + '" fill="none" stroke="currentColor" stroke-opacity=".14" stroke-width="8"/><circle class="arc" cx="46" cy="46" r="' + R + '" fill="none" stroke="' + colr(m.score) + '" stroke-width="8" stroke-linecap="round" stroke-dasharray="' + circ.toFixed(1) + '" stroke-dashoffset="' + circ.toFixed(1) + '" data-off="' + (circ * (1 - m.score / 100)).toFixed(1) + '" transform="rotate(-90 46 46)"/></svg><span class="n"><b data-count="' + m.score + '">' + (RM ? m.score : 0) + "</b></span></button>" +
          '<div class="soc-tiles">' + tile("f", nfmt(m.f), "Followers", id) +
          (m.er != null ? tile("er", (Math.round(m.er * 100) / 100) + "%", "Engagement" + (m.erEst ? " (est.)" : ""), id) : "") +
          (m.ppm != null ? tile("ppm", Math.round(m.ppm * 10) / 10, "Posts / month", id) : "") +
          (m.growth != null ? tile("g", (m.growth > 0 ? "+" : "") + (Math.round(m.growth * 10) / 10) + "%", "Growth / month", id) : "") + "</div></div>";
        if (m.er != null) {
          var top = Math.max(m.bench.good * 2, m.er * 1.15), pos = function (v) { return Math.min(100, v / top * 100).toFixed(1); };
          summary += '<div class="soc-bm"><div class="soc-bar"><i class="z1" style="width:' + pos(m.bench.avg) + '%"></i><i class="z2" style="left:' + pos(m.bench.avg) + "%;width:" + (pos(m.bench.good) - pos(m.bench.avg)) + '%"></i><i class="z3" style="left:' + pos(m.bench.good) + "%;width:" + (100 - pos(m.bench.good)) + '%"></i><em style="left:' + pos(m.er) + '%"></em></div><p>Your engagement <b>' + (Math.round(m.er * 100) / 100) + "%</b> vs typical " + m.bench.avg + "% and strong " + m.bench.good + "%+ for a " + P.name + " account this size.</p></div>";
        }
      } else if (L) summary = '<p class="soc-hint">Add your average likes and comments below to get an engagement score.</p>';
      var v = L || {};
      var form = '<details class="soc-manual"' + (!L || (m && m.er == null) ? " open" : "") + '><summary>' + (L ? "Update my numbers" : "Enter my numbers") + '</summary><form class="soc-nf" data-p="' + id + '"><p class="soc-help">' + esc(P.where) + " Takes about a minute. Leave anything blank if you don't know it.</p><div class=\"soc-grid\">" +
        fld("followers", "Followers", v.followers) + fld("following", "Following", v.following) + fld("ppm", "Posts in last 30 days", v.ppm) + fld("avgLikes", "Avg likes per post", v.avgLikes) + fld("avgComments", "Avg comments per post", v.avgComments) + fld("avgViews", "Avg views (optional)", v.avgViews) +
        '</div><div class="soc-fa"><button type="submit" class="soc-go sm">Save numbers</button>' + (pr.platform !== "x" ? '<button type="button" class="soc-go ghost sm" data-read="' + id + '">Re-read public stats</button>' : "") + "</div></form></details>";
      return '<div class="soc-card" data-id="' + id + '">' + head + summary + form + "</div>";
    }
    function fld(k, lab, val) { return '<label><span>' + lab + '</span><input name="' + k + '" inputmode="decimal" autocomplete="off" value="' + (val == null ? "" : esc(val)) + '"></label>'; }

    function draw() {
      var ps = data.profiles, scored = ps.map(function (p) { return { p: p, m: analyze(p) }; }).filter(function (x) { return x.m && x.m.score != null; });
      var overall = scored.length ? Math.round(scored.reduce(function (a, x) { return a + x.m.score; }, 0) / scored.length) : null;
      var html = "";
      if (!ps.length) html = '<p class="soc-empty">No profiles yet. Add a link above to get started.</p>';
      else {
        if (overall != null && scored.length > 1) html += '<button type="button" class="soc-all" data-k="all"><span>Overall social score</span><b style="color:' + colr(overall) + '">' + overall + '</b><em>' + label(overall) + '</em><i class="soc-i">i</i></button>';
        html += ps.map(drawProfile).join("");
        html += '<div class="soc-ai" id="socAi"></div>';
      }
      body.innerHTML = html; wire();
      requestAnimationFrame(function () { requestAnimationFrame(function () { body.querySelectorAll(".arc").forEach(function (a) { a.style.strokeDashoffset = a.getAttribute("data-off"); }); }); });
      if (!RM) body.querySelectorAll("[data-count]").forEach(function (n) { var to = Number(n.getAttribute("data-count")), t0 = performance.now(); (function tick(t) { var p = Math.min(1, (t - t0) / 1000); n.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(tick); })(t0); });
      aiBlock(scored, overall);
    }
    function byId(id) { return data.profiles.filter(function (p) { return p.id === id; })[0]; }

    function explainK(k, pr) {
      var m = analyze(pr), P = PF[pr.platform], L = m.L;
      if (k === "score") return ex(P.name + " score: " + m.score + " out of 100", "<p><b>What it means:</b> how healthy this profile is on the basics that drive reach: how engaged your followers are, how often you post, your follower mix, and growth.</p><p><b>How it is calculated:</b> a weighted average of what we could measure: " + m.parts.map(function (p) { return { er: "Engagement", ppm: "Posting frequency", ratio: "Follower-to-following ratio", growth: "Growth" }[p.k] + " " + Math.round(p.v) + " (weight " + p.w + ")"; }).join(", ") + ". Missing items are left out rather than guessed.</p><p><b>Bands:</b> 85+ Excellent · 70–84 Good · 50–69 Fair · under 50 Needs work.</p><p class='ex-note'>Benchmarks are rough industry rules of thumb, not official figures from " + P.name + ".</p>");
      if (k === "f") return ex("Followers: " + (m.f != null ? m.f.toLocaleString() : "–"), "<p><b>What it means:</b> how many accounts follow " + P.name + " @" + esc(pr.handle) + ".</p><p>It sets the yardstick for engagement: the bigger the audience, the lower the typical engagement rate.</p>" + (m.growthAbs != null ? "<p><b>Change:</b> " + (m.growthAbs >= 0 ? "+" : "") + m.growthAbs.toLocaleString() + " over " + m.growthDays + " days.</p>" : "<p>Update your numbers again in a couple of weeks to see growth.</p>"));
      if (k === "er") return ex("Engagement rate: " + (Math.round(m.er * 100) / 100) + "%", "<p><b>What it means:</b> " + P.erNote + ". It shows how many followers actually react to what you post.</p><p><b>Your number:</b> " + (m.erEst ? "estimated from lifetime totals (" + nfmt(L.hearts) + " total likes ÷ " + nfmt(L.posts) + " videos = about " + nfmt(L.hearts / L.posts) + " likes per video) ÷ " + nfmt(m.f) + " followers. Enter your recent average likes and comments for a sharper figure." : "(" + nfmt(L.avgLikes) + " likes + " + nfmt(L.avgComments || 0) + " comments) ÷ " + nfmt(m.f) + " followers = <b>" + (Math.round(m.er * 100) / 100) + "%</b>.") + "</p><p><b>Benchmark:</b> typical " + m.bench.avg + "%, strong " + m.bench.good + "%+ for a " + P.name + " account this size. Score from engagement: <b>" + Math.round(m.erScore) + "</b>.</p>" + (m.viewRate != null ? "<p><b>View rate:</b> avg views ÷ followers = " + (Math.round(m.viewRate * 10) / 10) + "%.</p>" : "") + "<p class='ex-note'>Rules of thumb, not official figures.</p>");
      if (k === "ppm") return ex("Posts per month: " + (Math.round(m.ppm * 10) / 10), "<p><b>What it means:</b> how often you post. Regular posting keeps you in front of followers and feeds the algorithm.</p><p><b>Target:</b> about " + P.target + " posts a month for " + P.name + ". You: " + (Math.round(m.ppm * 10) / 10) + (m.ppmDerived ? " (worked out from how your post count changed between updates)" : " (the number you entered)") + " = score <b>" + Math.round(m.ppmScore) + "</b>.</p>");
      if (k === "g") return ex("Growth: " + (m.growth > 0 ? "+" : "") + (Math.round(m.growth * 10) / 10) + "% a month", "<p><b>What it means:</b> how fast your follower count is changing, scaled to a month.</p><p><b>Calculation:</b> followers went from " + nfmt(m.f - m.growthAbs) + " to " + nfmt(m.f) + " in " + m.growthDays + " days (" + (m.growthAbs >= 0 ? "+" : "") + m.growthAbs.toLocaleString() + "), which is " + (Math.round(m.growth * 10) / 10) + "% per 30 days.</p><p><b>Bands:</b> 5%+ excellent · 2%+ good · 0.5%+ steady · below 0 shrinking.</p>");
    }
    function wire() {
      body.querySelectorAll("[data-k]").forEach(function (b) { b.addEventListener("click", function () {
        var k = b.getAttribute("data-k");
        if (k === "all") { var sc = data.profiles.map(function (p) { return { p: p, m: analyze(p) }; }).filter(function (x) { return x.m && x.m.score != null; }); return ex("Overall social score", "<p><b>What it means:</b> the average of your profile scores: " + sc.map(function (x) { return PF[x.p.platform].name + " " + x.m.score; }).join(", ") + ".</p><p>Tap a profile's ring to see how its own score is built.</p>"); }
        var pr = byId(b.getAttribute("data-p")); if (pr) explainK(k, pr);
      }); });
      body.querySelectorAll("[data-del]").forEach(function (b) { var armed = false; b.addEventListener("click", function () {
        if (!armed) { armed = true; b.textContent = "Click again to remove"; setTimeout(function () { armed = false; b.textContent = "Remove"; }, 3500); return; }
        data.profiles = data.profiles.filter(function (p) { return p.id !== b.getAttribute("data-del"); }); persist(); draw();
      }); });
      body.querySelectorAll("[data-read]").forEach(function (b) { b.addEventListener("click", function () { var pr = byId(b.getAttribute("data-read")); if (pr) readProfile(pr, b); }); });
      body.querySelectorAll(".soc-nf").forEach(function (f) { f.addEventListener("submit", function (e) {
        e.preventDefault(); err("");
        var pr = byId(f.getAttribute("data-p")), s = { ts: Date.now(), src: "manual" }, bad = false, last = pr.snaps[pr.snaps.length - 1] || {};
        ["followers", "following", "ppm", "avgLikes", "avgComments", "avgViews"].forEach(function (k) { var v = pnum(f.elements[k].value); if (v != null && (isNaN(v) || v < 0)) bad = true; s[k] = (v == null || isNaN(v)) ? null : v; });
        if (bad) { err("Numbers only, please. You can use K or M, like 12.5K."); return; }
        if (s.followers == null) { err("Followers is needed to work out engagement."); return; }
        if (s.avgLikes == null && s.avgComments == null && s.ppm == null && s.following == null) { err("Add at least average likes, or posts in the last 30 days."); return; }
        if (last.posts != null) s.posts = last.posts; if (last.hearts != null) s.hearts = last.hearts;
        pr.snaps.push(s); if (pr.snaps.length > 24) pr.snaps.shift(); persist(); draw();
      }); });
    }

    function aiBlock(scored, overall) {
      var box = body.querySelector("#socAi"); if (!box) return;
      if (!scored.length) { box.innerHTML = '<p class="soc-fine">Enter your numbers for at least one profile to unlock the AI report.</p>'; return; }
      function list(a) { return (a || []).map(function (x) { return "<li>" + esc(x) + "</li>"; }).join(""); }
      box.innerHTML = '<button type="button" class="soc-go ghost">✨ Create AI social report</button><p class="soc-fine">Interprets your numbers and suggests what to post and how often. Uses one AI request.</p>';
      box.querySelector("button").addEventListener("click", function () {
        box.innerHTML = '<div class="soc-load"><span></span><span></span><span></span> Reading your numbers…</div>';
        var lines = scored.map(function (x) { var m = x.m, L = m.L; return PF[x.p.platform].name + " @" + x.p.handle + ": followers " + m.f + (L.following != null ? ", following " + L.following : "") + (m.er != null ? ", engagement rate " + (Math.round(m.er * 100) / 100) + "% (typical " + m.bench.avg + "%, strong " + m.bench.good + "%)" + (m.erEst ? " [estimated from lifetime totals]" : "") : "") + (m.ppm != null ? ", posts/month " + (Math.round(m.ppm * 10) / 10) + " (target " + PF[x.p.platform].target + ")" : "") + (m.growth != null ? ", growth " + (Math.round(m.growth * 10) / 10) + "%/month" : "") + (m.viewRate != null ? ", view rate " + (Math.round(m.viewRate * 10) / 10) + "%" : "") + ", score " + m.score + "/100"; }).join("\n");
        var prompt = "Respond with ONLY a single JSON object, no markdown fences, no preamble. Never place a literal double-quote character inside a string value.\n\nYou are a social media advisor for a small local business: " + (opts.name || "the business") + (opts.address ? " (" + opts.address + ")" : "") + ".\n\nTheir profile numbers:\n" + lines + "\n\nOverall social score " + overall + "/100.\n\nWrite a practical report an owner can act on. Use only these numbers; do not invent follower counts, post content or competitor data. Benchmarks are rough rules of thumb. If a figure is an estimate, say so. Keep each item to one or two short sentences.\n\n" + '{"headline":"one sentence verdict","strengths":["2-3 items"],"gaps":["2-3 items"],"content_ideas":["3 specific post ideas that suit this kind of local business"],"posting_plan":"one sentence weekly posting rhythm","platform_note":"one sentence about which platform deserves most effort and why"}';
        Promise.resolve(opts.ai(prompt)).then(function (r) {
          var d = (r && typeof r === "object") ? r : (opts.parse ? opts.parse(String(r)) : null); if (!d || !d.headline) throw new Error("bad");
          box.innerHTML = '<p class="soc-gt">AI social report</p><p class="soc-head">' + esc(d.headline) + '</p><div class="soc-cols"><div><b class="g">What is working</b><ul>' + list(d.strengths) + '</ul></div><div><b class="r">Gaps to close</b><ul>' + list(d.gaps) + '</ul></div></div><div class="soc-ideas"><b>Post ideas</b><ol>' + list(d.content_ideas) + "</ol></div>" + (d.posting_plan ? '<p class="soc-line">🗓 ' + esc(d.posting_plan) + "</p>" : "") + (d.platform_note ? '<p class="soc-line">🎯 ' + esc(d.platform_note) + "</p>" : "") + '<p class="soc-fine">AI-written from the numbers above. Benchmarks are rules of thumb.</p>';
        }).catch(function (e) { box.innerHTML = '<p class="soc-err2">' + (opts.isLimit && opts.isLimit(e) ? "You have reached today's AI limit. It resets daily." : "Could not write the report just now.") + "</p>"; });
      });
    }
  }

  var css = ".soc{margin:18px 0;border:1px solid var(--line);border-radius:16px;padding:18px;background:var(--card)}.soc-eyebrow{margin:0;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--coral-dark);font-weight:700}.soc h3{margin:2px 0 4px;font:700 19px 'Space Grotesk',sans-serif}.soc-meta{margin:0;font-size:12.5px;color:var(--ink-soft)}" +
    ".soc-form{display:flex;gap:8px;margin-top:14px;flex-wrap:wrap}.soc-in{flex:1 1 240px;min-width:0;border:1px solid var(--line);border-radius:10px;padding:12px 14px;font:inherit;font-size:15px;background:#fff;color:var(--ink)}.soc-in:focus,.soc-nf input:focus{outline:2px solid var(--coral);outline-offset:1px}" +
    ".soc-go{background:var(--coral);color:#fff;border:0;border-radius:10px;padding:12px 18px;font-weight:700;cursor:pointer;min-height:0;width:auto}.soc-go.sm{padding:9px 14px;font-size:13.5px}.soc-go.ghost{background:#fff;color:var(--coral-dark);border:1px solid var(--coral)}.soc-go.ghost:hover{background:rgba(246,149,0,.1);color:var(--coral-dark)}.soc-go:disabled{opacity:.6;cursor:wait}" +
    ".soc-err,.soc-err2{color:var(--warn);font-size:13.5px;margin:10px 0 0}.soc-empty,.soc-hint,.soc-fine{font-size:13px;color:var(--ink-soft);margin:10px 0 0}.soc-body{margin-top:6px}" +
    ".soc-all{position:relative;display:flex;align-items:baseline;gap:10px;width:100%;background:linear-gradient(135deg,#1b1d22,#2a2118);color:#fff;border:0;border-radius:14px;padding:14px 34px 14px 16px;margin:14px 0 4px;min-height:0;text-align:left;cursor:pointer}.soc-all:hover{background:linear-gradient(135deg,#24272d,#35291c);color:#fff}.soc-all span{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#FFD35A;font-weight:700;flex:1}.soc-all b{font:700 30px 'Space Grotesk',sans-serif}.soc-all em{font-style:normal;font-size:13px;color:rgba(255,255,255,.8)}" +
    ".soc-i{position:absolute;top:6px;right:7px;width:14px;height:14px;border-radius:50%;border:1px solid currentColor;opacity:.5;font:italic 600 10px/12px Georgia,serif;text-align:center;font-style:italic;pointer-events:none}" +
    ".soc-card{border:1px solid var(--line);border-radius:14px;padding:14px;margin-top:14px;background:#fff}.soc-ph{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.soc-badge{color:#fff;border-radius:999px;font-size:11.5px;font-weight:700;padding:3px 10px}.soc-h{font-weight:700;color:var(--ink);text-decoration:none;overflow-wrap:anywhere}.soc-h:hover{text-decoration:underline}.soc-ago{font-size:12px;color:var(--ink-soft);flex:1}.soc-x{background:none;border:0;color:var(--ink-soft);font-size:12px;min-height:0;width:auto;padding:4px 6px;cursor:pointer}.soc-x:hover{background:none;color:var(--warn)}" +
    ".soc-sum{display:flex;gap:14px;align-items:center;margin-top:12px;flex-wrap:wrap}.soc-ring{position:relative;background:none;border:0;padding:0;min-height:0;width:92px;height:92px;color:var(--ink);cursor:pointer;flex:0 0 auto}.soc-ring:hover{background:none;color:var(--ink)}.soc-ring .arc{transition:stroke-dashoffset 1.2s cubic-bezier(.2,.8,.2,1)}.soc-ring .n{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}.soc-ring b{font:700 28px 'Space Grotesk',sans-serif;font-variant-numeric:tabular-nums}" +
    ".soc-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(104px,1fr));gap:8px;flex:1 1 280px}.soc-t{position:relative;background:#faf8f5;border:1px solid var(--line);border-radius:12px;padding:10px 8px;text-align:center;color:var(--ink);cursor:pointer;min-height:0;width:auto}.soc-t:hover{background:rgba(246,149,0,.08);color:var(--ink)}.soc-t b{display:block;font:700 20px 'Space Grotesk',sans-serif;font-variant-numeric:tabular-nums}.soc-t span{font-size:11.5px;color:var(--ink-soft)}" +
    ".soc-bm{margin-top:12px}.soc-bar{position:relative;height:10px;border-radius:99px;background:#f1eee9;overflow:visible}.soc-bar i{position:absolute;top:0;bottom:0}.soc-bar .z1{left:0;background:#F4C9BF;border-radius:99px 0 0 99px}.soc-bar .z2{background:#FBE3B5}.soc-bar .z3{background:#BFE6D6;border-radius:0 99px 99px 0}.soc-bar em{position:absolute;top:-4px;width:4px;height:18px;margin-left:-2px;border-radius:2px;background:var(--ink)}.soc-bm p{margin:8px 0 0;font-size:12.5px;color:var(--ink-soft)}" +
    ".soc-manual{margin-top:12px;border-top:1px dashed var(--line);padding-top:10px}.soc-manual summary{cursor:pointer;font-weight:700;font-size:13.5px;color:var(--coral-dark)}.soc-help{margin:8px 0;font-size:12.5px;color:var(--ink-soft)}.soc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}.soc-nf label span{display:block;font-size:12px;color:var(--ink-soft);margin-bottom:3px}.soc-nf input{width:100%;border:1px solid var(--line);border-radius:8px;padding:9px 10px;font:inherit;font-size:14px;background:#fff;color:var(--ink)}.soc-fa{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}" +
    ".soc-ai{margin-top:16px;border-top:1px dashed var(--line);padding-top:14px}.soc-gt{margin:0 0 6px;font:700 12.5px 'Space Grotesk',sans-serif;text-transform:uppercase;letter-spacing:.08em;color:var(--ink-soft)}.soc-head{margin:0 0 10px;font:600 15.5px/1.4 'Space Grotesk',sans-serif}.soc-cols{display:grid;grid-template-columns:1fr 1fr;gap:14px}.soc-cols b,.soc-ideas b{font-size:12px;text-transform:uppercase;letter-spacing:.06em}.soc-cols b.g{color:#137a59}.soc-cols b.r{color:#a53a27}.soc-cols ul,.soc-ideas ol{margin:4px 0 0;padding-left:18px;font-size:13.5px;line-height:1.5}.soc-ideas{background:#FEF3E2;border-radius:12px;padding:12px 14px;margin-top:10px}.soc-line{margin:10px 0 0;font-size:13.5px}" +
    ".soc-load{display:flex;align-items:center;gap:6px;color:var(--ink-soft);font-size:13.5px}.soc-load span{width:8px;height:8px;border-radius:50%;background:var(--coral);animation:socb 1s infinite}.soc-load span:nth-child(2){animation-delay:.15s}.soc-load span:nth-child(3){animation-delay:.3s}@keyframes socb{0%,100%{opacity:.25;transform:scale(.8)}50%{opacity:1;transform:scale(1.15)}}" +
    "@media(max-width:600px){.soc{padding:14px}.soc-cols{grid-template-columns:1fr}.soc-ago{flex-basis:100%;order:5}}@media(prefers-reduced-motion:reduce){.soc-ring .arc{transition:none}.soc-load span{animation:none}}";
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
  window.__p2pSocial = { mount: mount, analyze: analyze, detect: detect };
})();
