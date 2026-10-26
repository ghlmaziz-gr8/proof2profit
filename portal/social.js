/* Social media: paste a profile link, the AI assesses it from public information. No numbers to type. */
(function () {
  var RM = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var DAY = 864e5;
  function esc(t) { return String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function ex(t, h) { if (window.__p2pExplain) window.__p2pExplain(t, h); }
  function fmtD(ts) { return new Date(ts).toLocaleDateString("default", { month: "short", day: "numeric" }); }
  function colr(v) { return v >= 75 ? "#1D9E75" : v >= 50 ? "#F69500" : "#C24A34"; }
  function label(v) { return v >= 85 ? "Excellent" : v >= 70 ? "Good" : v >= 50 ? "Fair" : "Needs work"; }
  function nfmt(n) { if (n == null || isNaN(n)) return "–"; n = Number(n); return n >= 1e6 ? (Math.round(n / 1e5) / 10) + "M" : n >= 1e4 ? (Math.round(n / 100) / 10) + "K" : n.toLocaleString(); }
  function pnum(v) { v = String(v == null ? "" : v).trim().replace(/,/g, ""); if (!v) return null; var m = v.match(/^([\d.]+)\s*([kKmM])?$/); if (!m) return NaN; return Math.round(parseFloat(m[1]) * ({ k: 1e3, m: 1e6 }[(m[2] || "").toLowerCase()] || 1) * 100) / 100; }
  function list(a) { return (a || []).map(function (x) { return "<li>" + esc(x) + "</li>"; }).join(""); }
  var PF = {
    instagram: { name: "Instagram", color: "#C13584",  },
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


  function mount(el, opts) {
    if (!el) return;
    var kvKey = "reviewlens_social_" + opts.slug, data = { profiles: [] };
    el.innerHTML = '<section class="soc"><div class="soc-top"><p class="soc-eyebrow">Social media</p><h3>How well is your social media working?</h3><p class="soc-meta">Paste a profile link. The AI looks at what is publicly known about the account and scores its engagement and health. If you know your followers or average likes, add them to sharpen the result. Both are optional.</p></div>' +
      '<form class="soc-form"><input type="text" class="soc-in" inputmode="url" autocapitalize="off" autocomplete="off" spellcheck="false" placeholder="instagram.com/yourbusiness or tiktok.com/@yourbusiness" aria-label="Social profile link"><button type="submit" class="soc-go">Assess</button><div class="soc-opt"><label><span>Followers (optional)</span><input class="soc-fo" inputmode="decimal" autocomplete="off" placeholder="e.g. 2.4K"></label><label><span>Avg likes per post (optional)</span><input class="soc-lk" inputmode="decimal" autocomplete="off" placeholder="e.g. 85"></label></div></form><p class="soc-err" hidden></p><div class="soc-body"></div></section>';
    var root = el.querySelector(".soc"), inp = root.querySelector(".soc-in"), errEl = root.querySelector(".soc-err"), body = root.querySelector(".soc-body");
    function err(t) { errEl.textContent = t || ""; errEl.hidden = !t; }
    function persist() { if (opts.save) Promise.resolve(opts.save(kvKey, data)).then(function () { window.dispatchEvent(new Event("p2p:signal")); }, function () { }); }
    function byId(id) { return data.profiles.filter(function (p) { return p.id === id; })[0]; }
    if (opts.load) Promise.resolve(opts.load(kvKey, null)).then(function (d) {
      if (d && d.profiles) { d.profiles = d.profiles.filter(function (p) { return p.report; }); data = d; draw(); }
    }).catch(function () { });

    function msg(e) {
      var c = e && e.code;
      if (c === "rate_limited") return "You have reached today's limit for AI social checks. It resets daily.";
      if (c === "no_data") return "Not enough public information turned up for that account to assess it. Check the link, or try again later.";
      if (c === "not_found") return "The social assessor is not switched on yet. Update the Worker with the latest code first.";
      return "Could not assess that profile right now. Try again in a minute.";
    }
    function assess(pr) {
      var api = window.__p2p && window.__p2p.api; if (!api) { err("Not available right now."); return; }
      pr.busy = true; draw(); err("");
      api("/social-assess", { url: pr.url, followers: pr.hf == null ? undefined : pr.hf, avgLikes: pr.hl == null ? undefined : pr.hl }).then(function (r) {
        var R = r.result; pr.busy = false;
        if (!R || !R.report) throw { code: "no_data" };
        pr.report = R.report; pr.engine = R.engine || null; pr.direct = R.direct; pr.sources = R.sources || []; pr.ts = Date.now();
        var sn2 = (pr.snaps || []).concat([{ ts: pr.ts, score: R.report.score, followers: R.report.followers }]); pr.snaps = window.__p2pPruneMonthly ? window.__p2pPruneMonthly(sn2, 24) : sn2.slice(-24);
        persist(); draw();
      }).catch(function (e) {
        pr.busy = false;
        if (!pr.report) data.profiles = data.profiles.filter(function (p) { return p !== pr; });
        err(msg(e)); draw();
      });
    }

    root.querySelector(".soc-form").addEventListener("submit", function (e) {
      e.preventDefault(); err("");
      var d = detect(inp.value);
      if (!d) { err("Use the link to the profile itself, like instagram.com/yourbusiness, tiktok.com/@yourbusiness, facebook.com/yourpage, youtube.com/@yourchannel or x.com/yourhandle."); return; }
      if (data.profiles.some(function (p) { return p.platform === d.platform && p.handle.toLowerCase() === d.handle.toLowerCase(); })) { err("That profile is already added."); return; }
      if (data.profiles.length >= 6) { err("You can track up to 6 profiles."); return; }
      var hf = pnum(root.querySelector(".soc-fo").value), hl = pnum(root.querySelector(".soc-lk").value);
      if ((hf != null && (isNaN(hf) || hf <= 0)) || (hl != null && (isNaN(hl) || hl < 0))) { err("Numbers only, please. You can use K or M, like 2.4K."); return; }
      var pr = { id: "p" + Date.now(), platform: d.platform, handle: d.handle, url: d.url, snaps: [], hf: hf, hl: hl };
      root.querySelector(".soc-fo").value = ""; root.querySelector(".soc-lk").value = "";
      data.profiles.push(pr); inp.value = ""; assess(pr);
    });

    function growth(pr) {
      var sn = (pr.snaps || []).filter(function (x) { return x && x.followers != null && !isNaN(x.followers); }), L = sn[sn.length - 1]; if (!L || sn.length < 2) return null;
      var P = sn[sn.length - 2], d = Math.max(1, (L.ts - P.ts) / DAY);
      return { abs: L.followers - P.followers, tot: P.followers > 0 ? (L.followers - P.followers) / P.followers * 100 : null, days: Math.round(d), since: P.ts, pct: P.followers > 0 && d >= 7 ? (L.followers - P.followers) / P.followers / d * 30 * 100 : null, series: sn.slice(-12) };
    }
    function signed(n) { return (n > 0 ? "+" : n < 0 ? "−" : "") + nfmt(Math.abs(n)); }
    // monthly follower trend: bars for each saved month, with the change from the month before
    function trend(g) {
      var sr = g.series, mx = Math.max.apply(null, sr.map(function (x) { return x.followers; })), mn = Math.min.apply(null, sr.map(function (x) { return x.followers; })), span = Math.max(1, mx - mn);
      return '<div class="soc-tr"><p class="soc-trh">Followers by month</p><div class="soc-trb">' + sr.map(function (x, i) {
        var h = 22 + (x.followers - mn) / span * 68, dl = i ? x.followers - sr[i - 1].followers : null;
        return '<div class="soc-col" style="--d:' + (i * 70) + 'ms"><em class="' + (dl > 0 ? "up" : dl < 0 ? "dn" : "") + '">' + (dl == null ? "" : signed(dl)) + '</em><i style="height:' + h.toFixed(0) + '%"></i><span>' + new Date(x.ts).toLocaleDateString("default", { month: "short" }) + '</span></div>';
      }).join("") + "</div></div>";
    }
    function card(pr) {
      var P = PF[pr.platform], id = pr.id;
      var head = '<div class="soc-ph"><span class="soc-badge" style="background:' + P.color + '">' + P.name + '</span><a class="soc-h" href="' + esc(pr.url) + '" target="_blank" rel="noopener noreferrer">@' + esc(pr.handle) + '</a><span class="soc-ago">' + (pr.ts ? "assessed " + fmtD(pr.ts) : "") + '</span><button type="button" class="soc-x" data-del="' + id + '">Remove</button></div>';
      if (pr.busy && !pr.report) return '<div class="soc-card">' + head + '<div class="soc-load"><span></span><span></span><span></span> Reading public information and scoring…</div></div>';
      var R = pr.report; if (!R) return "";
      var g = growth(pr), circ = 2 * Math.PI * 38;
      var tiles = '';
      if (R.followers != null) tiles += '<div class="soc-t"><b>' + nfmt(R.followers) + '</b><span>Followers</span></div>';
      tiles += '<button type="button" class="soc-t" data-k="conf" data-p="' + id + '"><b>' + esc(R.confidence) + '</b><span>Confidence</span><i class="soc-i">i</i></button>';
      if (g) tiles += '<div class="soc-t soc-gr ' + (g.abs > 0 ? "up" : g.abs < 0 ? "dn" : "") + '"><b>' + (g.abs > 0 ? "▲ " : g.abs < 0 ? "▼ " : "● ") + signed(g.abs) + '</b><span>since ' + fmtD(g.since) + (g.tot != null ? " (" + (g.tot > 0 ? "+" : "") + (Math.round(g.tot * 10) / 10) + "%)" : "") + '</span></div>';
      else if (R.followers != null) tiles += '<div class="soc-t soc-gr"><b>—</b><span>Re-assess next month to see follower growth</span></div>';
      var h = head + '<div class="soc-sum"><button type="button" class="soc-ring" data-k="score" data-p="' + id + '" aria-label="How the score was reached"><svg viewBox="0 0 92 92" width="92" height="92"><circle cx="46" cy="46" r="38" fill="none" stroke="currentColor" stroke-opacity=".14" stroke-width="8"/><circle class="arc" cx="46" cy="46" r="38" fill="none" stroke="' + colr(R.score) + '" stroke-width="8" stroke-linecap="round" stroke-dasharray="' + circ.toFixed(1) + '" stroke-dashoffset="' + circ.toFixed(1) + '" data-off="' + (circ * (1 - R.score / 100)).toFixed(1) + '" transform="rotate(-90 46 46)"/></svg><span class="n"><b data-count="' + R.score + '">' + (RM ? R.score : 0) + '</b></span></button><div class="soc-tiles">' + tiles + '</div></div>' +
        (g && g.series.length > 1 ? trend(g) : '') + '<p class="soc-head">' + esc(R.headline) + '</p>' +
        (R.engagement ? '<p class="soc-line">💬 ' + esc(R.engagement) + '</p>' : '') + (R.posting ? '<p class="soc-line">🗓 ' + esc(R.posting) + '</p>' : '') +
        '<div class="soc-cols"><div><b class="g">What is working</b><ul>' + list(R.strengths) + '</ul></div><div><b class="r">Gaps to close</b><ul>' + list(R.gaps) + '</ul></div></div>' +
        '<div class="soc-ideas"><b>Post ideas</b><ol>' + list(R.content_ideas) + '</ol></div>' +
        (R.posting_plan ? '<p class="soc-line">🎯 ' + esc(R.posting_plan) + '</p>' : '') +
        '<p class="soc-fine">' + esc(R.evidence_note || "") + ' AI-written' + (pr.engine ? ' by ' + esc(pr.engine) : '') + ' from public information, so treat figures as estimates.' + (pr.sources && pr.sources.length ? ' Sources: ' + esc(pr.sources.join(", ")) + '.' : '') + '</p>' +
        (pr.snaps && pr.snaps.length > 1 ? '<p class="soc-fine">History: ' + pr.snaps.slice(-8).reverse().map(function (x) { return new Date(x.ts).toLocaleDateString("default", { month: "short", year: "2-digit" }) + " <b>" + x.score + "</b>"; }).join(" · ") + '</p>' : '') + '<div class="soc-fa"><button type="button" class="soc-go ghost sm" data-re="' + id + '"' + (pr.busy ? " disabled" : "") + '>' + (pr.busy ? "Re-assessing…" : "Re-assess") + '</button></div>';
      return '<div class="soc-card">' + h + '</div>';
    }
    function draw() {
      var ps = data.profiles, sc = ps.filter(function (p) { return p.report; });
      var overall = sc.length ? Math.round(sc.reduce(function (a, p) { return a + p.report.score; }, 0) / sc.length) : null, html = "";
      if (!ps.length) html = '<p class="soc-empty">No profiles yet. Paste a link above to get started.</p>';
      else {
        if (overall != null && sc.length > 1) html += '<button type="button" class="soc-all" data-k="all"><span>Overall social score</span><b style="color:' + colr(overall) + '">' + overall + '</b><em>' + label(overall) + '</em><i class="soc-i">i</i></button>';
        var tg = 0, tn = 0; sc.forEach(function (p) { var g = growth(p); if (g) { tg += g.abs; tn++; } });
        if (tn) html += '<p class="soc-sumg ' + (tg > 0 ? "up" : tg < 0 ? "dn" : "") + '">' + (tg >= 0 ? "▲ " : "▼ ") + 'Across ' + tn + ' profile' + (tn === 1 ? "" : "s") + ': <b>' + signed(tg) + ' followers</b> since the previous assessment</p>';
        html += ps.map(card).join("");
      }
      body.innerHTML = html; wire();
      requestAnimationFrame(function () { requestAnimationFrame(function () { body.querySelectorAll(".arc").forEach(function (a) { a.style.strokeDashoffset = a.getAttribute("data-off"); }); }); });
      if (!RM) body.querySelectorAll("[data-count]").forEach(function (n) { var to = Number(n.getAttribute("data-count")), t0 = performance.now(); (function tick(t) { var p = Math.min(1, (t - t0) / 1000); n.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(tick); })(t0); });
    }
    function wire() {
      body.querySelectorAll("[data-k]").forEach(function (b) { b.addEventListener("click", function () {
        var k = b.getAttribute("data-k");
        if (k === "all") return ex("Overall social score", "<p>The average of your profile scores: " + data.profiles.filter(function (p) { return p.report; }).map(function (p) { return PF[p.platform].name + " " + p.report.score; }).join(", ") + ".</p><p>Tap a profile's ring to see how its own score was reached.</p>");
        var pr = byId(b.getAttribute("data-p")); if (!pr || !pr.report) return; var R = pr.report;
        if (k === "score") return ex(PF[pr.platform].name + " score: " + R.score + " out of 100", "<p><b>What it means:</b> an AI judgement of how engaged the audience looks and how healthy the account is: posting consistency, audience response, and growth signals.</p><p><b>How it was reached:</b> " + esc(R.score_reason || "") + "</p><p><b>Bands:</b> 85+ Excellent · 70–84 Good · 50–69 Fair · under 50 Needs work.</p><p class='ex-note'>Based on public information only. Instagram and Facebook hide most numbers, so this is an estimate, not a measurement.</p>");
        if (k === "conf") return ex("Confidence: " + R.confidence, "<p><b>What it means:</b> how much real public information the AI found about this account.</p><p><b>High:</b> numbers read straight from the profile or clearly stated by sources. <b>Medium:</b> some figures found. <b>Low:</b> little found, so the score is cautious.</p><p>" + esc(R.evidence_note || "") + "</p>");
      }); });
      body.querySelectorAll("[data-del]").forEach(function (b) { var armed = false; b.addEventListener("click", function () {
        if (!armed) { armed = true; b.textContent = "Click again to remove"; setTimeout(function () { armed = false; b.textContent = "Remove"; }, 3500); return; }
        data.profiles = data.profiles.filter(function (p) { return p.id !== b.getAttribute("data-del"); }); persist(); draw();
      }); });
      body.querySelectorAll("[data-re]").forEach(function (b) { b.addEventListener("click", function () { var pr = byId(b.getAttribute("data-re")); if (pr && !pr.busy) assess(pr); }); });
    }
  }

  var css = ".soc{margin:18px 0;border:1px solid var(--line);border-radius:16px;padding:18px;background:var(--card)}.soc-eyebrow{margin:0;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--coral-dark);font-weight:700}.soc h3{margin:2px 0 4px;font:700 19px 'Space Grotesk',sans-serif}.soc-meta{margin:0;font-size:12.5px;color:var(--ink-soft)}" +
    ".soc-form{display:flex;gap:8px;margin-top:14px;flex-wrap:wrap}.soc-in{flex:1 1 240px;min-width:0;border:1px solid var(--line);border-radius:10px;padding:12px 14px;font:inherit;font-size:15px;background:#fff;color:var(--ink)}.soc-opt{flex:1 1 100%;display:grid;grid-template-columns:1fr 1fr;gap:8px}.soc-opt span{display:block;font-size:12px;color:var(--ink-soft);margin-bottom:3px}.soc-opt input{width:100%;border:1px solid var(--line);border-radius:10px;padding:10px 12px;font:inherit;font-size:14px;background:#fff;color:var(--ink)}@media(max-width:600px){.soc-opt{grid-template-columns:1fr}}.soc-in:focus,.soc-nf input:focus{outline:2px solid var(--coral);outline-offset:1px}" +
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
    ".soc-card{animation:socin .55s cubic-bezier(.2,.8,.2,1) both}.soc-card .soc-t{animation:soctp .5s cubic-bezier(.2,.9,.3,1.2) both}.soc-card .soc-t:nth-child(2){animation-delay:.12s}.soc-card .soc-t:nth-child(3){animation-delay:.24s}.soc-card .soc-cols,.soc-card .soc-ideas{animation:socin .6s .35s cubic-bezier(.2,.8,.2,1) both}" +
    "@keyframes socin{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}@keyframes soctp{from{opacity:0;transform:scale(.82)}to{opacity:1;transform:none}}@keyframes socgrow{from{transform:scaleY(0)}to{transform:scaleY(1)}}" +
    ".soc-gr.up b,.soc-sumg.up b,.soc-sumg.up{color:#1D9E75}.soc-gr.dn b,.soc-sumg.dn b,.soc-sumg.dn{color:#C24A34}.soc-gr span{display:block}.soc-sumg{margin:14px 0 0;font-size:14px;font-weight:600;background:#faf8f5;border:1px solid var(--line);border-radius:12px;padding:10px 12px;animation:socin .5s both}" +
    ".soc-tr{margin:14px 0 16px}.soc-trh{margin:0 0 6px;font:700 12px 'Space Grotesk',sans-serif;text-transform:uppercase;letter-spacing:.08em;color:var(--ink-soft)}.soc-trb{display:flex;align-items:flex-end;gap:6px;height:112px}.soc-col{flex:1 1 0;min-width:0;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:3px;font-size:10.5px}.soc-col i{display:block;width:100%;max-width:34px;background:linear-gradient(180deg,#F69500,#f9b84d);border-radius:6px 6px 2px 2px;transform-origin:bottom;animation:socgrow .8s var(--d) cubic-bezier(.2,.8,.2,1) both}.soc-col em{font-style:normal;font-weight:700;font-size:10.5px;color:var(--ink-soft);min-height:13px;white-space:nowrap}.soc-col em.up{color:#1D9E75}.soc-col em.dn{color:#C24A34}.soc-col span{color:var(--ink-soft)}" +
    ".soc-load{display:flex;align-items:center;gap:6px;color:var(--ink-soft);font-size:13.5px}.soc-load span{width:8px;height:8px;border-radius:50%;background:var(--coral);animation:socb 1s infinite}.soc-load span:nth-child(2){animation-delay:.15s}.soc-load span:nth-child(3){animation-delay:.3s}@keyframes socb{0%,100%{opacity:.25;transform:scale(.8)}50%{opacity:1;transform:scale(1.15)}}" +
    "@media(max-width:600px){.soc{padding:14px}.soc-cols{grid-template-columns:1fr}.soc-ago{flex-basis:100%;order:5}}@media(prefers-reduced-motion:reduce){.soc-card,.soc-card .soc-t,.soc-card .soc-cols,.soc-card .soc-ideas,.soc-col i,.soc-sumg{animation:none!important}.soc-ring .arc{transition:none}.soc-load span{animation:none}}";
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
  window.__p2pSocial = { mount: mount, detect: detect };
})();
