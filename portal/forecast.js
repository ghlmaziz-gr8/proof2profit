/* Forecast: next month and next 6 months, from how the saved check-ins are trending, plus an AI outlook that explains it. */
(function () {
  var RM = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var DAY = 864e5;
  function esc(t) { return String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function sc(h) { if (!h) return null; if (h.avgScore != null && !isNaN(h.avgScore)) return Number(h.avgScore); if (h.rating != null) return Math.round(h.rating * 20); return null; }
  function band(v) { return v >= 85 ? "Strongest" : v >= 70 ? "Strong" : v >= 50 ? "Mixed" : "Needs attention"; }
  function colr(v) { return v >= 75 ? "#1D9E75" : v >= 55 ? "#F69500" : "#C24A34"; }
  function ex(t, h) { if (window.__p2pExplain) window.__p2pExplain(t, h); }
  function fmtD(ts) { return new Date(ts).toLocaleDateString("default", { month: "short", day: "numeric" }); }
  function addMonths(n) { var d = new Date(); d.setMonth(d.getMonth() + n); return d.toLocaleDateString("default", { month: "short", year: "numeric" }); }

  // Projection for one series [{t, v}] (oldest to newest) at a horizon in days.
  function project(pts, horizon) {
    var n = pts.length, last = pts[n - 1].v;
    var span = n > 1 ? Math.max(1, (pts[n - 1].t - pts[0].t) / DAY) : 0;
    var slope = 0, sd = 0;
    if (n > 1) {
      var xs = pts.map(function (p) { return (p.t - pts[0].t) / DAY; }), mx = xs.reduce(function (a, b) { return a + b; }, 0) / n, my = pts.reduce(function (a, p) { return a + p.v; }, 0) / n, nu = 0, de = 0;
      xs.forEach(function (x, i) { nu += (x - mx) * (pts[i].v - my); de += (x - mx) * (x - mx); });
      slope = de > 0 ? nu / de : 0;
      if (n > 2) { var res = xs.map(function (x, i) { return pts[i].v - (my + slope * (x - mx)); }); sd = Math.sqrt(res.reduce(function (a, r) { return a + r * r; }, 0) / (n - 2)); }
    }
    // Do not extrapolate a short history for long: trend only counts out to twice the observed span (at least 2 weeks).
    var heff = Math.min(horizon, Math.max(2 * span, 14));
    var cap = horizon <= 31 ? 10 : 25;
    var change = n > 1 ? clamp(slope * heff, -cap, cap) : 0;
    var mid = clamp(Math.round(last + change), 0, 100);
    var u = 4 + Math.sqrt(horizon / 30) * 3 + sd; u *= n < 3 ? 1.6 : n < 5 ? 1.3 : 1;
    u = Math.round(clamp(u, 3, 25));
    return { mid: mid, lo: clamp(mid - u, 0, 100), hi: clamp(mid + u, 0, 100), change: mid - last, slope: slope, heff: Math.round(heff), span: Math.round(span), u: u, capped: n > 1 && Math.abs(slope * heff) > cap };
  }
  function confidence(n, span) { return n >= 6 && span >= 60 ? "High" : n >= 3 && span >= 14 ? "Medium" : "Low"; }

  function build(history, current) {
    var rows = history.filter(function (h) { return sc(h) != null; }).map(function (h) { return h; });
    if (current) rows = rows.concat([current]);
    var pts = rows.map(function (h) { return { t: h.ts, v: sc(h) }; });
    if (!pts.length) return null;
    var n = pts.length, span = n > 1 ? Math.round((pts[n - 1].t - pts[0].t) / DAY) : 0;
    var m1 = project(pts, 30), m6 = project(pts, 182);
    var names = [], seen = {};
    var latest = rows[rows.length - 1];
    (latest.aspects || []).forEach(function (a) { if (a && a.name && !seen[a.name]) { seen[a.name] = 1; names.push(a.name); } });
    var asp = names.map(function (nm) {
      var ap = []; rows.forEach(function (h) { (h.aspects || []).forEach(function (a) { if (a && a.name === nm && !isNaN(a.score)) ap.push({ t: h.ts, v: Number(a.score) }); }); });
      if (!ap.length) return null;
      return { name: nm, now: ap[ap.length - 1].v, n: ap.length, m1: project(ap, 30), m6: project(ap, 182) };
    }).filter(Boolean);
    return { pts: pts, n: n, span: span, now: pts[n - 1].v, m1: m1, m6: m6, conf: confidence(n, span), asp: asp, latest: latest, rows: rows };
  }

  function chart(F) {
    var W = 640, H = 230, L = 36, R = 16, T = 18, B = 34;
    var all = F.pts.map(function (p) { return p.v; }).concat([F.m1.lo, F.m1.hi, F.m6.lo, F.m6.hi]);
    var lo = Math.floor((Math.min.apply(null, all) - 4) / 5) * 5, hi = Math.ceil((Math.max.apply(null, all) + 4) / 5) * 5; if (hi - lo < 20) { hi = lo + 20; }
    lo = Math.max(0, lo); hi = Math.min(100, Math.max(hi, lo + 20));
    var X = function (f) { return L + f * (W - L - R); }, Y = function (v) { return T + (1 - (v - lo) / (hi - lo)) * (H - T - B); };
    var nowX = 0.42, m1X = 0.64, m6X = 1;
    var n = F.pts.length, hist = F.pts.map(function (p, i) { return [X(n === 1 ? nowX : i / (n - 1) * nowX), Y(p.v)]; });
    var hd = hist.map(function (p, i) { return (i ? "L" : "M") + p[0].toFixed(1) + "," + p[1].toFixed(1); }).join(" ");
    var nowP = hist[hist.length - 1];
    var p1 = [X(m1X), Y(F.m1.mid)], p6 = [X(m6X), Y(F.m6.mid)];
    var pd = "M" + nowP[0].toFixed(1) + "," + nowP[1].toFixed(1) + " L" + p1[0].toFixed(1) + "," + p1[1].toFixed(1) + " L" + p6[0].toFixed(1) + "," + p6[1].toFixed(1);
    var bandD = "M" + nowP[0].toFixed(1) + "," + nowP[1].toFixed(1) + " L" + X(m1X).toFixed(1) + "," + Y(F.m1.hi).toFixed(1) + " L" + X(m6X).toFixed(1) + "," + Y(F.m6.hi).toFixed(1) +
      " L" + X(m6X).toFixed(1) + "," + Y(F.m6.lo).toFixed(1) + " L" + X(m1X).toFixed(1) + "," + Y(F.m1.lo).toFixed(1) + " Z";
    var grid = ""; for (var g = lo; g <= hi; g += (hi - lo > 40 ? 20 : 10)) grid += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(g).toFixed(1) + '" y2="' + Y(g).toFixed(1) + '" stroke="currentColor" stroke-opacity=".1"/><text x="' + (L - 6) + '" y="' + (Y(g) + 4).toFixed(1) + '" text-anchor="end" font-size="10" fill="currentColor" fill-opacity=".55">' + g + "</text>";
    var lab = function (x, t, a) { return '<text x="' + x.toFixed(1) + '" y="' + (H - 12) + '" text-anchor="' + (a || "middle") + '" font-size="11" fill="currentColor" fill-opacity=".7">' + t + "</text>"; };
    var dots = hist.map(function (p) { return '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="3" fill="#F69500"/>'; }).join("");
    return '<svg class="fc-svg" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Score history and forecast">' + grid +
      '<line x1="' + nowP[0].toFixed(1) + '" x2="' + nowP[0].toFixed(1) + '" y1="' + T + '" y2="' + (H - B) + '" stroke="currentColor" stroke-opacity=".25" stroke-dasharray="3 4"/>' +
      '<path class="fc-band" d="' + bandD + '" fill="#F69500" fill-opacity=".14"/>' +
      (n > 1 ? '<path class="fc-hist" d="' + hd + '" fill="none" stroke="#F69500" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" pathLength="1"/>' : "") + dots +
      '<path class="fc-proj" d="' + pd + '" fill="none" stroke="#F69500" stroke-width="2.6" stroke-dasharray="7 6" stroke-linecap="round"/>' +
      '<circle class="fc-pt" cx="' + p1[0].toFixed(1) + '" cy="' + p1[1].toFixed(1) + '" r="5" fill="#fff" stroke="#F69500" stroke-width="2.5"/>' +
      '<circle class="fc-pt" cx="' + p6[0].toFixed(1) + '" cy="' + p6[1].toFixed(1) + '" r="5" fill="#fff" stroke="#F69500" stroke-width="2.5"/>' +
      '<text x="' + p1[0].toFixed(1) + '" y="' + (p1[1] - 11).toFixed(1) + '" text-anchor="middle" font-size="12" font-weight="700" fill="currentColor">' + F.m1.mid + "</text>" +
      '<text x="' + (p6[0] - 2).toFixed(1) + '" y="' + (p6[1] - 11).toFixed(1) + '" text-anchor="end" font-size="12" font-weight="700" fill="currentColor">' + F.m6.mid + "</text>" +
      lab(X(0), n > 1 ? fmtD(F.pts[0].t) : "", "start") + lab(nowP[0], "Now") + lab(X(m1X), "+1 month") + lab(X(m6X), "+6 months", "end") + "</svg>";
  }

  function arrow(d) { return d > 1 ? '<span class="fc-up">▲ +' + d + "</span>" : d < -1 ? '<span class="fc-dn">▼ ' + d + "</span>" : '<span class="fc-fl">● steady</span>'; }

  function explainScen(F, P, label, when) {
    var basis = F.n === 1
      ? "<p><b>Basis:</b> only one check-in exists, so there is no trend to follow. We hold today's score and show a wide range. Re-check this business over the coming weeks and the forecast becomes data-driven.</p>"
      : "<p><b>Basis:</b> your " + F.n + " check-ins over " + F.span + " days are trending " + (P.slope > 0.02 ? "up" : P.slope < -0.02 ? "down" : "flat") + " by about <b>" + (Math.round(P.slope * 30 * 10) / 10) + " points per month</b>.</p><p><b>Calculation:</b> we continue that trend only as far as the history supports (up to twice the " + F.span + "-day span, at least 14 days), here <b>" + P.heff + " days</b>, then hold steady" + (P.capped ? ". The movement was capped so one fast swing does not produce an unrealistic number" : "") + ". Starting from today's <b>" + F.now + "</b> that gives <b>" + P.mid + "</b>.</p>";
    ex(label + ": about " + P.mid + " out of 100",
      "<p><b>What it means:</b> our best estimate of this business's average score around " + when + ", if guest feedback keeps moving the way it has.</p>" + basis +
      "<p><b>Range " + P.lo + "–" + P.hi + ":</b> the farther ahead we look, and the fewer check-ins we have, the wider it gets. The real result will most likely land inside it.</p><p class='ex-note'>A forecast, not a guarantee. New reviews, seasons, staffing or menu changes can shift it.</p>");
  }

  function mount(el, opts) {
    var history = opts.history || [], F = build(history, opts.current || null);
    if (!el || !F) return;
    var slug = opts.slug, kvKey = "reviewlens_fc_" + slug, st = { ai: null };
    function card(label, P, when, key) {
      return '<button type="button" class="fc-scen" data-k="' + key + '"><span class="fc-sl">' + label + '</span><span class="fc-sv" style="color:' + colr(P.mid) + '"><b data-count="' + P.mid + '">' + (RM ? P.mid : 0) + '</b><small>/100</small></span><span class="fc-sr">likely ' + P.lo + "–" + P.hi + "</span><span class=\"fc-sd\">" + arrow(P.change) + " vs now · " + band(P.mid) + '</span><i class="fc-i">i</i></button>';
    }
    var aspHtml = F.asp.length ? '<div class="fc-asp"><p class="fc-sub">Where it is heading, by aspect</p>' + F.asp.map(function (a, i) {
      return '<button type="button" class="fc-ar" data-a="' + i + '"><span class="n">' + esc(a.name) + '</span><span class="v">' + Math.round(a.now) + ' <i>→</i> ' + a.m1.mid + ' <i>→</i> ' + a.m6.mid + "</span>" + arrow(a.m6.mid - Math.round(a.now)) + "</button>";
    }).join("") + '<p class="fc-key">Now → +1 month → +6 months. Tap a row to see why.</p></div>' : "";
    el.innerHTML = '<section class="fc"><div class="fc-top"><div><p class="fc-eyebrow">Forecast</p><h3>Next month and next 6 months</h3>' +
      '<p class="fc-meta">' + (F.n > 1 ? "Based on " + F.n + " check-ins over " + F.span + " days" : "Based on one check-in so far") + " · today " + Math.round(F.now) + '</p></div><button type="button" class="fc-conf ' + F.conf.toLowerCase() + '" data-k="conf">' + F.conf + ' confidence<i class="fc-i">i</i></button></div>' +
      '<div class="fc-chart">' + chart(F) + "</div>" +
      '<div class="fc-scens">' + card("Next month", F.m1, addMonths(1), "m1") + card("Next 6 months", F.m6, addMonths(6), "m6") + "</div>" + aspHtml +
      '<div class="fc-ai" id="fcAi"></div></section>';
    var root = el.querySelector(".fc");
    el.querySelectorAll("[data-k]").forEach(function (b) {
      b.addEventListener("click", function () {
        var k = b.getAttribute("data-k");
        if (k === "m1") explainScen(F, F.m1, "Next month", addMonths(1));
        else if (k === "m6") explainScen(F, F.m6, "Next 6 months", addMonths(6));
        else ex("Confidence: " + F.conf, "<p><b>What it means:</b> how much to trust the projection.</p><p><b>How it is set:</b> <b>Low</b> under 3 check-ins or under 2 weeks of history. <b>Medium</b> 3+ check-ins across 2+ weeks. <b>High</b> 6+ check-ins across 2+ months.</p><p><b>Yours:</b> " + F.n + " check-in" + (F.n === 1 ? "" : "s") + " over " + F.span + " days = <b>" + F.conf + "</b>.</p><p>Re-checking regularly (for example every 2 weeks) is the quickest way to raise it.</p>");
      });
    });
    el.querySelectorAll("[data-a]").forEach(function (b) {
      b.addEventListener("click", function () {
        var a = F.asp[Number(b.getAttribute("data-a"))];
        ex(a.name + ": " + Math.round(a.now) + " → " + a.m1.mid + " → " + a.m6.mid, "<p><b>What it means:</b> where <b>" + esc(a.name) + "</b> is likely heading: now <b>" + Math.round(a.now) + "</b>, in a month about <b>" + a.m1.mid + "</b> (" + a.m1.lo + "–" + a.m1.hi + "), in 6 months about <b>" + a.m6.mid + "</b> (" + a.m6.lo + "–" + a.m6.hi + ").</p><p><b>Basis:</b> " + (a.n > 1 ? a.n + " check-ins on this aspect, trending " + (a.m1.slope > 0.02 ? "up" : a.m1.slope < -0.02 ? "down" : "flat") + "." : "only one check-in on this aspect, so it is held steady with a wide range.") + "</p>");
      });
    });
    // count-up and reveal
    requestAnimationFrame(function () { requestAnimationFrame(function () { root.classList.add("fc-in"); }); });
    if (!RM) root.querySelectorAll("[data-count]").forEach(function (n) {
      var to = Number(n.getAttribute("data-count")), t0 = performance.now();
      (function tick(t) { var p = Math.min(1, (t - t0) / 1000); n.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(tick); })(t0);
    });

    // ---- AI outlook (on demand, cached) ----
    var aiBox = el.querySelector("#fcAi");
    function renderAi(d, cachedTs, basedN) {
      function list(a) { return (a || []).map(function (x) { return "<li>" + esc(x) + "</li>"; }).join(""); }
      function hz(t, o) { o = o || {}; return '<div class="fc-hz"><h4>' + t + "</h4><p>" + esc(o.outlook || "") + '</p><div class="fc-cols"><div><b class="g">Likely drivers</b><ul>' + list(o.drivers) + '</ul></div><div><b class="r">Watch out for</b><ul>' + list(o.risks) + "</ul></div></div></div>"; }
      aiBox.innerHTML = '<div class="fc-aihead"><p class="fc-sub">AI outlook</p><button type="button" class="fc-refresh">Refresh</button></div><p class="fc-headline">' + esc(d.headline || "") + "</p>" +
        hz("Next month", d.next_month) + hz("Next 6 months", d.next_6_months) +
        ((d.actions || []).length ? '<div class="fc-act"><b>Do this now to improve the forecast</b><ol>' + list(d.actions) + "</ol></div>" : "") +
        (d.seasonal_note ? '<p class="fc-season">🗓 ' + esc(d.seasonal_note) + "</p>" : "") +
        '<p class="fc-fine">AI-written explanation of the numbers above' + (cachedTs ? " · generated " + fmtD(cachedTs) : "") + (d._engine ? " by " + esc(d._engine) : "") + ". It is a forecast, not a guarantee." + (basedN != null && basedN !== F.n ? " Written when there " + (basedN === 1 ? "was 1 check-in" : "were " + basedN + " check-ins") + "; there " + (F.n === 1 ? "is now 1" : "are now " + F.n) + ". Tap Refresh to update it." : "") + "</p>";
      aiBox.querySelector(".fc-refresh").addEventListener("click", function () { run(true); });
    }
    function btn() {
      aiBox.innerHTML = '<button type="button" class="fc-go">✨ Generate AI outlook</button><p class="fc-fine">Explains what is likely driving the forecast and what to do about it. Uses one AI request.</p>';
      aiBox.querySelector(".fc-go").addEventListener("click", function () { run(false); });
    }
    function prompt() {
      var L = F.latest, hist = F.rows.map(function (h) { return fmtD(h.ts) + ": avg " + sc(h) + (h.aspects && h.aspects.length ? " (" + h.aspects.map(function (a) { return a.name + " " + Math.round(a.score); }).join(", ") + ")" : ""); }).join("\n");
      var prev = F.rows.length > 1 ? F.rows[F.rows.length - 2] : null;
      var newC = prev ? (L.dislikes || []).filter(function (d) { return (prev.dislikes || []).indexOf(d) < 0; }) : [];
      return "Respond with ONLY a single JSON object, no markdown fences, no preamble. Never place a literal double-quote character inside a string value.\n\n" +
        "You are explaining a review-based forecast for the business \"" + (opts.name || "this business") + "\"" + (opts.address ? " (" + opts.address + ")" : "") + ". Today is " + new Date().toLocaleDateString("default", { month: "long", day: "numeric", year: "numeric" }) + ".\n\n" +
        "Check-in history (average score 0-100 and aspect scores):\n" + hist + "\n\n" +
        "Latest things guests love: " + (L.likes || []).join("; ") + "\nLatest things guests complain about: " + (L.dislikes || []).join("; ") + "\n" + (newC.length ? "New concerns since the previous check: " + newC.join("; ") + "\n" : "") + "\n" +
        "Our computed projection (do NOT change these numbers): today " + Math.round(F.now) + "; next month about " + F.m1.mid + " (range " + F.m1.lo + "-" + F.m1.hi + "); next 6 months about " + F.m6.mid + " (range " + F.m6.lo + "-" + F.m6.hi + "); confidence " + F.conf + " (" + F.n + " check-ins over " + F.span + " days).\n" +
        "Aspect projections (now, +1 month, +6 months): " + F.asp.map(function (a) { return a.name + " " + Math.round(a.now) + "/" + a.m1.mid + "/" + a.m6.mid; }).join("; ") + ".\n\n" +
        "Explain in plain language why the score is likely to move this way, grounded ONLY in the history and feedback above plus normal seasonality for this type of business. Do not invent review counts, ratings, or events. Be honest about uncertainty" + (F.n < 3 ? " (there is very little history, say so)" : "") + ".\n\n" +
        '{"headline":"one sentence summing up the outlook","next_month":{"outlook":"2 sentences","drivers":["2-3 short items"],"risks":["2 short items"]},"next_6_months":{"outlook":"2 sentences","drivers":["2-3 short items"],"risks":["2 short items"]},"actions":["3 short, specific actions that would improve the forecast"],"seasonal_note":"one sentence on seasonality for this business type over the next 6 months"}';
    }
    function run(force) {
      aiBox.innerHTML = '<div class="fc-load"><span></span><span></span><span></span> Reading the trend…</div>';
      Promise.resolve(opts.ai(prompt())).then(function (r) {
        var d = (r && typeof r === "object") ? r : (opts.parse ? opts.parse(String(r)) : null);
        if (!d || !d.headline) throw new Error("bad");
        st.ai = d; renderAi(d, Date.now());
        if (opts.save && F.n >= 1) opts.save(kvKey, { n: F.n, ts: Date.now(), d: d });
      }).catch(function (e) {
        var lim = opts.isLimit && opts.isLimit(e);
        aiBox.innerHTML = '<p class="fc-err">' + (lim ? "You have reached today's AI limit. It resets daily." : "Could not generate the AI outlook just now.") + '</p><button type="button" class="fc-go">Try again</button>';
        aiBox.querySelector(".fc-go").addEventListener("click", function () { run(true); });
      });
    }
    btn();
    if (opts.load) Promise.resolve(opts.load(kvKey, null)).then(function (c) {
      if (c && c.d) renderAi(c.d, c.ts, c.n);
    }).catch(function () { });
  }

  var css = ".fc{margin:18px 0;border:1px solid var(--line);border-radius:16px;padding:18px;background:var(--card);opacity:0;transform:translateY(10px);transition:opacity .5s,transform .5s}.fc-in.fc,.fc.fc-in{opacity:1;transform:none}" +
    ".fc-top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}.fc-eyebrow{margin:0;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--coral-dark);font-weight:700}.fc h3{margin:2px 0 2px;font:700 19px 'Space Grotesk',sans-serif}.fc-meta{margin:0;font-size:12.5px;color:var(--ink-soft)}" +
    ".fc-conf,.fc-scen,.fc-ar{position:relative;font-family:inherit;cursor:pointer}.fc-conf{background:#f1eee9;color:#5B5B5B;border:0;border-radius:999px;padding:5px 26px 5px 12px;font-size:12px;font-weight:700;min-height:0;width:auto}.fc-conf.medium{background:#FEF3E2;color:#a8641a}.fc-conf.high{background:#E3F5EE;color:#137a59}.fc-conf:hover{filter:brightness(.97);background:inherit}" +
    ".fc-conf.low:hover{background:#e8e4de}.fc-conf.medium:hover{background:#fbe8c8}.fc-conf.high:hover{background:#d3efe4}" +
    ".fc-i{position:absolute;top:50%;right:8px;transform:translateY(-50%);width:14px;height:14px;border-radius:50%;border:1px solid currentColor;opacity:.55;font:italic 600 10px/12px Georgia,serif;text-align:center;font-style:italic}" +
    ".fc-chart{margin:12px 0 4px;color:var(--ink)}.fc-svg{width:100%;height:auto;display:block;overflow:visible}" +
    ".fc-hist{stroke-dasharray:1;stroke-dashoffset:1}.fc-in .fc-hist{animation:fcdraw 1.2s ease-out forwards}.fc-proj{stroke-dashoffset:0;opacity:0}.fc-in .fc-proj{animation:fcfade .6s 1s forwards}.fc-band{opacity:0}.fc-in .fc-band{animation:fcfade .8s 1.1s forwards}.fc-pt{opacity:0;transform-box:fill-box;transform-origin:center}.fc-in .fc-pt{animation:fcpop .4s 1.5s forwards}" +
    "@keyframes fcdraw{to{stroke-dashoffset:0}}@keyframes fcfade{to{opacity:1}}@keyframes fcpop{from{opacity:0;transform:scale(0)}to{opacity:1;transform:none}}" +
    ".fc-scens{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:10px}.fc-scen{display:flex;flex-direction:column;gap:3px;text-align:left;background:linear-gradient(135deg,#1b1d22,#2a2118);color:#fff;border:0;border-radius:14px;padding:14px 30px 14px 14px;min-height:0;width:auto}.fc-scen:hover{background:linear-gradient(135deg,#24272d,#35291c)}" +
    ".fc-sl{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#FFD35A;font-weight:700}.fc-sv b{font:700 34px 'Space Grotesk',sans-serif;font-variant-numeric:tabular-nums}.fc-sv small{font-size:12px;color:rgba(255,255,255,.6);margin-left:2px}.fc-sr{font-size:12.5px;color:rgba(255,255,255,.8)}.fc-sd{font-size:12px;color:rgba(255,255,255,.75)}" +
    ".fc-up{color:#5fe0b0;font-weight:700}.fc-dn{color:#ff8f7a;font-weight:700}.fc-fl{color:#BDB8AE;font-weight:600}.fc-asp{margin-top:16px}.fc-sub{margin:0 0 8px;font:700 13px 'Space Grotesk',sans-serif;text-transform:uppercase;letter-spacing:.08em;color:var(--ink-soft)}" +
    ".fc-ar{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;background:transparent;color:var(--ink);border:0;border-bottom:1px solid var(--line);border-radius:0;padding:10px 4px;min-height:0;font-size:14px;text-align:left}.fc-ar:hover{background:rgba(246,149,0,.07)}.fc-ar .n{font-weight:600;flex:1 1 auto;min-width:0}.fc-ar .v{font-variant-numeric:tabular-nums;color:var(--ink-soft);white-space:nowrap}.fc-ar .v i{font-style:normal;opacity:.5}.fc-ar>span:last-child{min-width:70px;text-align:right}" +
    ".fc-key,.fc-fine{margin:8px 0 0;font-size:12px;color:var(--ink-soft)}.fc-ai{margin-top:18px;border-top:1px dashed var(--line);padding-top:16px}" +
    ".fc-go,.fc-refresh{background:var(--coral);color:#fff;border:0;border-radius:10px;padding:11px 16px;font-weight:700;cursor:pointer;min-height:0;width:auto}.fc-refresh{background:transparent;color:var(--coral-dark);padding:4px 8px;font-size:12.5px}.fc-refresh:hover{background:rgba(246,149,0,.12);color:var(--coral-dark)}.fc-aihead{display:flex;justify-content:space-between;align-items:center}" +
    ".fc-headline{margin:2px 0 12px;font:600 16px/1.4 'Space Grotesk',sans-serif}.fc-hz{background:#faf8f5;border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin-bottom:10px}.fc-hz h4{margin:0 0 4px;font-size:14px}.fc-hz p{margin:0 0 8px;font-size:13.5px;line-height:1.5}" +
    ".fc-cols{display:grid;grid-template-columns:1fr 1fr;gap:12px}.fc-cols b{font-size:12px;text-transform:uppercase;letter-spacing:.06em}.fc-cols b.g{color:#137a59}.fc-cols b.r{color:#a53a27}.fc-cols ul,.fc-act ol{margin:4px 0 0;padding-left:18px;font-size:13px;line-height:1.5}" +
    ".fc-act{background:#FEF3E2;border-radius:12px;padding:12px 14px;margin-top:4px;font-size:13.5px}.fc-season{margin:10px 0 0;font-size:13px;color:var(--ink-soft)}.fc-err{color:var(--warn);font-size:13.5px}" +
    ".fc-load{display:flex;align-items:center;gap:6px;color:var(--ink-soft);font-size:13.5px}.fc-load span{width:8px;height:8px;border-radius:50%;background:var(--coral);animation:fcb 1s infinite}.fc-load span:nth-child(2){animation-delay:.15s}.fc-load span:nth-child(3){animation-delay:.3s}@keyframes fcb{0%,100%{opacity:.25;transform:scale(.8)}50%{opacity:1;transform:scale(1.15)}}" +
    "@media(max-width:600px){.fc-scens,.fc-cols{grid-template-columns:1fr}.fc{padding:14px}.fc-sv b{font-size:30px}}" +
    "@media(prefers-reduced-motion:reduce){.fc,.fc-hist,.fc-proj,.fc-band,.fc-pt{opacity:1;transform:none;stroke-dashoffset:0;animation:none!important;transition:none}.fc-load span{animation:none}}";
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  window.__p2pForecast = { mount: mount, build: build, project: project };
})();
