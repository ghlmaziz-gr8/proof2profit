/* My Businesses: animated portfolio dashboard, richer cards and a detail hero. Pure presentation over the saved history. */
(function () {
  var RM = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  function esc(t) { return String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function score(h) { if (!h) return null; if (h.avgScore != null && !isNaN(h.avgScore)) return Number(h.avgScore); if (h.rating != null) return Math.round(h.rating * 20); return null; }
  function col(s) { return s == null ? "#9a948b" : s >= 75 ? "#1D9E75" : s >= 55 ? "#F69500" : "#C24A34"; }
  function label(s) { return s == null ? "No score" : s >= 80 ? "Excellent" : s >= 70 ? "Strong" : s >= 55 ? "Fair" : "Needs work"; }
  function ago(ts) {
    var d = Math.floor((Date.now() - ts) / 864e5);
    return d <= 0 ? "today" : d === 1 ? "yesterday" : d < 30 ? d + " days ago" : new Date(ts).toLocaleDateString("default", { month: "short", day: "numeric" });
  }
  function stats(history, ov) {
    var sc = history.map(score).filter(function (v) { return v != null; });
    var cur = sc.length ? sc[sc.length - 1] : null, prev = sc.length > 1 ? sc[sc.length - 2] : null, first = sc.length ? sc[0] : null;
    var last = history[history.length - 1] || {};
    var asp = (last.aspects || []).filter(function (a) { return a && a.name && !isNaN(a.score); }).slice().sort(function (a, b) { return b.score - a.score; });
    return {
      sc: sc, cur: ov != null ? ov : cur, rev: cur, prev: prev, delta: prev == null ? null : cur - prev, sinceFirst: sc.length > 1 ? cur - first : null,
      best: sc.length ? Math.max.apply(null, sc) : null, n: history.length, ts: last.ts,
      top: asp[0], low: asp.length > 1 ? asp[asp.length - 1] : null
    };
  }
  function ring(s, size, stroke, big) {
    var r = (size - stroke) / 2, c = 2 * Math.PI * r, v = s == null ? 0 : Math.max(0, Math.min(100, s));
    return '<svg class="mb-ring" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + " " + size + '" aria-hidden="true">' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="currentColor" stroke-opacity=".14" stroke-width="' + stroke + '"/>' +
      '<circle class="mb-arc" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + col(s) + '" stroke-width="' + stroke + '" stroke-linecap="round" ' +
      'stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + c.toFixed(1) + '" data-off="' + (c * (1 - v / 100)).toFixed(1) + '" transform="rotate(-90 ' + size / 2 + " " + size / 2 + ')"/></svg>' +
      '<span class="mb-ringnum' + (big ? " big" : "") + '"' + (s == null ? "" : ' data-count="' + Math.round(s) + '"') + ">" + (s == null ? "–" : (RM ? Math.round(s) : 0)) + "</span>";
  }
  function spark(sc, w, h, color) {
    if (sc.length < 2) return '<div class="mb-spark-empty">First check-in</div>';
    var min = Math.min.apply(null, sc), max = Math.max.apply(null, sc), rg = (max - min) || 1, pad = 4;
    var pts = sc.map(function (v, i) { return [pad + i / (sc.length - 1) * (w - pad * 2), h - pad - (v - min) / rg * (h - pad * 2)]; });
    var d = pts.map(function (p, i) { return (i ? "L" : "M") + p[0].toFixed(1) + "," + p[1].toFixed(1); }).join(" ");
    var area = d + " L" + pts[pts.length - 1][0].toFixed(1) + "," + h + " L" + pts[0][0].toFixed(1) + "," + h + " Z";
    var lp = pts[pts.length - 1];
    return '<div class="mb-sw"><svg class="mb-spark" viewBox="0 0 ' + w + " " + h + '" preserveAspectRatio="none" aria-hidden="true"><path d="' + area + '" fill="' + color + '" fill-opacity=".12"/>' +
      '<path class="mb-line" d="' + d + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" pathLength="1"/>' +
      '</svg><i class="mb-dot" style="left:' + (lp[0] / w * 100).toFixed(2) + '%;top:' + (lp[1] / h * 100).toFixed(2) + '%;background:' + color + '"></i></div>';
  }
  var EXR = {};
  function reg(k, title, html) { EXR[k] = [title, html]; return ' data-ex="' + k + '" tabindex="0" role="button"'; }
  function bandTxt(v) { return v == null ? "No score" : v >= 85 ? "Strongest (85+)" : v >= 70 ? "Strong (70–84)" : v >= 50 ? "Mixed (50–69)" : "Needs attention (under 50)"; }
  function chip(delta, n) {
    if (delta == null) return '<span class="mb-chip new">New · ' + (n > 1 ? "baseline" : "first check-in") + "</span>";
    if (delta > 0) return '<span class="mb-chip up">▲ +' + delta + " since last check</span>";
    if (delta < 0) return '<span class="mb-chip down">▼ ' + delta + " since last check</span>";
    return '<span class="mb-chip flat">● Unchanged</span>';
  }

  function dash(items) {
    EXR = {};
    var ss = items.map(function (it) { return { it: it, s: stats(it.history, it.ov) }; });
    var scored = ss.filter(function (x) { return x.s.cur != null; });
    var avg = scored.length ? Math.round(scored.reduce(function (a, x) { return a + x.s.cur; }, 0) / scored.length) : null;
    var upL = ss.filter(function (x) { return x.s.delta > 0; }), downL = ss.filter(function (x) { return x.s.delta < 0; });
    var up = upL.length, down = downL.length;
    var checks = ss.reduce(function (a, x) { return a + x.s.n; }, 0);
    var mover = ss.filter(function (x) { return x.s.delta; }).sort(function (a, b) { return Math.abs(b.s.delta) - Math.abs(a.s.delta); })[0];
    var attn = scored.slice().sort(function (a, b) { return a.s.cur - b.s.cur; })[0];
    var names = function (l) { return l.length ? l.map(function (x) { return "<b>" + esc(x.it.name) + "</b> (" + (x.s.delta > 0 ? "+" : "") + x.s.delta + ")"; }).join(", ") : "none right now"; };
    var note = mover ? ("<b>" + esc(mover.it.name) + "</b> moved the most: " + (mover.s.delta > 0 ? "up " : "down ") + Math.abs(mover.s.delta) + " points since its last check.")
      : attn && scored.length > 1 ? ("<b>" + esc(attn.it.name) + "</b> has the lowest score right now (" + attn.s.cur + "). Worth a re-check.")
      : "Re-check a business later to see how it moves.";
    var avgAttr = reg("d-avg", "Portfolio score: " + (avg == null ? "none yet" : avg + " out of 100"),
      "<p><b>What it means:</b> one overall number for all the businesses you track. Higher is better.</p><p><b>How it is calculated:</b> the plain average of each business's <i>latest</i> overall business health score (reviews, website and social combined, the same number shown on its report): " +
      (scored.length ? scored.map(function (x) { return esc(x.it.name) + " " + x.s.cur; }).join(", ") : "no scores yet") + (avg == null ? "" : " = <b>" + avg + "</b>") + ".</p><p><b>Bands:</b> 85+ Strongest · 70–84 Strong · 50–69 Mixed · under 50 Needs attention." + (avg == null ? "" : " Yours: <b>" + bandTxt(avg) + "</b>.") + "</p>");
    var upAttr = reg("d-up", "Improving: " + up, "<p><b>What it means:</b> businesses whose latest average score is higher than at their previous check.</p><p><b>Right now:</b> " + names(upL) + ".</p><p class='ex-note'>A business with only one check-in cannot be compared yet, so it is not counted here.</p>");
    var downAttr = reg("d-down", "Slipping: " + down, "<p><b>What it means:</b> businesses whose latest average score is lower than at their previous check.</p><p><b>Right now:</b> " + names(downL) + ".</p><p>Open one to see which aspect dropped and what new concerns appeared.</p>");
    var chkAttr = reg("d-chk", "Check-ins: " + checks, "<p><b>What it means:</b> every time you analyzed and saved a business counts as one check-in. More check-ins give you a clearer trend.</p><p><b>By business:</b> " + ss.map(function (x) { return "<b>" + esc(x.it.name) + "</b> " + x.s.n; }).join(", ") + ".</p>");
    var noteAttr = reg("d-note", "How the highlight is chosen", "<p>We look at how much each business's average score changed since its previous check, and show the one that moved the <b>most</b>, up or down.</p><p>If nothing has moved yet, we show the business with the <b>lowest</b> score so you know where to look first. With a single business, we simply suggest re-checking later.</p>");
    function tile(v, l, cls, attr) { return '<div class="mb-tile ' + (cls || "") + ' mb-ex"' + attr + '><b data-count="' + v + '">' + (RM ? v : 0) + "</b><span>" + l + "</span><i class=\"mb-i\">i</i></div>"; }
    return '<section class="mb-dash"><div class="mb-orb o1"></div><div class="mb-orb o2"></div><div class="mb-orb o3"></div>' +
      '<div class="mb-dash-top"><div class="mb-dash-ring mb-ex"' + avgAttr + '>' + ring(avg, 112, 9, true) + '<i class="mb-i">i</i></div>' +
      '<div class="mb-dash-copy"><p class="mb-eyebrow">Your portfolio</p><h2>' + items.length + " business" + (items.length === 1 ? "" : "es") + " tracked</h2>" +
      '<p class="mb-dash-sub">' + (avg == null ? "No scores yet" : "Average score " + avg + " · " + label(avg)) + "</p></div></div>" +
      '<div class="mb-tiles">' + tile(up, "Improving", "up", upAttr) + tile(down, "Slipping", "down", downAttr) + tile(checks, "Check-ins", "", chkAttr) + "</div>" +
      '<p class="mb-note mb-ex"' + noteAttr + '><span class="mb-pulse"></span><span>' + note + "</span></p></section>";
  }

  function trendList(s) { return s.sc.map(function (v, i) { return "#" + (i + 1) + ": " + v; }).join(" → "); }
  function card(it, i) {
    var s = stats(it.history, it.ov), c = col(s.cur), k = "c" + i + "-";
    var nm = esc(it.name);
    var ringA = reg(k + "r", nm + ": " + (s.cur == null ? "no score" : s.cur + " out of 100"), "<p><b>What it means:</b> the overall business health score for this business, the same number as on its report. Higher is better.</p><p><b>How it is calculated:</b> reviews 50%, website SEO 25% and social media 25% (areas not checked yet are left out). Its review score is the average of its aspect scores (each 0–100) from the most recent check" + (s.top ? ": " + (it.history[it.history.length - 1].aspects || []).map(function (a) { return esc(a.name) + " " + Math.round(a.score); }).join(", ") : "") + ".</p><p><b>Band:</b> " + bandTxt(s.cur) + ". (85+ Strongest · 70–84 Strong · 50–69 Mixed · under 50 Needs attention)</p>");
    var chipA = s.delta == null
      ? reg(k + "d", "Not compared yet", "<p>This is the first saved check-in for " + nm + ", so there is nothing to compare against. Re-check it later and this chip will show whether the average score went up or down.</p>")
      : reg(k + "d", "Change since last check: " + (s.delta > 0 ? "+" : "") + s.delta, "<p><b>What it means:</b> how the average score moved between the last two check-ins.</p><p><b>How it is calculated:</b> latest <b>" + s.cur + "</b> minus previous <b>" + s.prev + "</b> = <b>" + (s.delta > 0 ? "+" : "") + s.delta + "</b>.</p>" + (s.delta === 0 ? "<p>No change at all.</p>" : "<p>" + (s.delta > 0 ? "Guests are describing this business more positively than last time." : "Guests are describing this business less positively than last time.") + "</p>"));
    var topA = s.top ? reg(k + "t", "Strongest: " + s.top.name + " " + Math.round(s.top.score), "<p><b>What it means:</b> the highest-scoring aspect in the latest check, so what " + nm + " does best according to guest feedback.</p><p><b>Score:</b> " + Math.round(s.top.score) + " out of 100 (" + bandTxt(s.top.score) + ").</p>") : "";
    var lowA = s.low && s.low.score < 70 ? reg(k + "l", "Focus area: " + s.low.name + " " + Math.round(s.low.score), "<p><b>What it means:</b> the lowest-scoring aspect in the latest check. It is shown when it scores under 70, because that is where improvement would help most.</p><p><b>Score:</b> " + Math.round(s.low.score) + " out of 100 (" + bandTxt(s.low.score) + ").</p>") : "";
    var spA = reg(k + "s", "Score trend", "<p><b>What it means:</b> the average score at each saved check-in, oldest to newest.</p><p><b>History:</b> " + (s.sc.length ? trendList(s) : "one check-in so far") + ".</p><p>A line that climbs means improvement; a falling line means guests are less happy than before.</p>");
    return '<div class="saved-row mb-card" data-slug="' + esc(it.slug) + '" role="button" tabindex="0" style="--d:' + Math.min(i, 10) * 60 + 'ms">' +
      '<div class="mb-card-ring mb-ex"' + ringA + ">" + ring(s.cur, 64, 6) + "</div>" +
      '<div class="mb-card-main"><p class="saved-row-name">' + nm + "</p>" +
      '<p class="saved-row-meta">' + (s.ts ? "Checked " + ago(s.ts) : "No check-ins yet") + " · " + s.n + " check-in" + (s.n === 1 ? "" : "s") + (s.cur != null ? " · " + label(s.cur) : "") + "</p>" +
      '<div class="mb-chips">' + chip(s.delta, s.n).replace("<span ", "<span" + chipA + " ").replace('class="mb-chip', 'class="mb-ex mb-chip') +
      (topA ? '<span' + topA + ' class="mb-ex mb-chip good">★ ' + esc(s.top.name) + " " + Math.round(s.top.score) + "</span>" : "") +
      (lowA ? '<span' + lowA + ' class="mb-ex mb-chip warn">⚑ ' + esc(s.low.name) + " " + Math.round(s.low.score) + "</span>" : "") + "</div></div>" +
      '<div class="mb-card-spark mb-ex"' + spA + ">" + spark(s.sc, 120, 44, c) + '</div><span class="mb-go">›</span></div>';
  }

  function hero(biz, history, ov) {
    var s = stats(history, ov), c = col(s.cur);
    var last = history[history.length - 1] || {};
    var asp = (last.aspects || []).map(function (a) { return esc(a.name) + " " + Math.round(a.score); }).join(", ");
    function kp(v, l, cls, key, title, html) { return '<div class="mb-hk mb-ex ' + (cls || "") + '"' + reg(key, title, html) + "><b>" + v + "</b><span>" + l + "</span><i class=\"mb-i\">i</i></div>"; }
    var d = s.delta == null ? "–" : (s.delta > 0 ? "+" : "") + s.delta;
    var ringA = reg("h-r", esc(biz.name) + ": " + (s.cur == null ? "no score" : s.cur + " out of 100"), "<p><b>What it means:</b> the overall business health score, the same number as on the report. Higher is better.</p><p><b>How it is calculated:</b> the average of its aspect scores (each 0–100) from the latest check" + (asp ? ": " + asp : "") + ".</p><p><b>Band:</b> " + bandTxt(s.cur) + ".</p>");
    var spA = reg("h-s", "Score trend", "<p>The average score at each saved check-in, oldest to newest.</p><p><b>History:</b> " + (s.sc.length ? trendList(s) : "one check-in so far") + ".</p>");
    return '<div class="mb-hero"><div class="mb-orb o1"></div><div class="mb-orb o2"></div>' +
      '<div class="mb-hero-top"><div class="mb-dash-ring mb-ex"' + ringA + '>' + ring(s.cur, 104, 9, true) + '<i class="mb-i">i</i></div>' +
      '<div class="mb-dash-copy"><p class="mb-eyebrow">' + (s.cur == null ? "No score yet" : label(s.cur)) + '</p><h2>' + esc(biz.name) + "</h2>" +
      '<p class="mb-dash-sub">' + esc(biz.address || "") + (biz.address ? " · " : "") + "last checked " + (s.ts ? ago(s.ts) : "never") + "</p></div></div>" +
      '<div class="mb-hero-spark mb-ex"' + spA + ">" + spark(s.sc, 320, 56, "#FFD35A") + "</div>" +
      '<div class="mb-hks">' +
      kp(d, "vs last check", s.delta > 0 ? "up" : s.delta < 0 ? "down" : "", "h-d", "Change since last check", s.delta == null ? "<p>Only one check-in so far, so there is nothing to compare. Re-check later to see the change.</p>" : "<p><b>How it is calculated:</b> latest review score <b>" + s.rev + "</b> minus previous <b>" + s.prev + "</b> = <b>" + d + "</b> points.</p>") +
      kp(s.best == null ? "–" : s.best, "Best review score", "", "h-b", "Best review score", "<p>The highest review score (average of the aspect scores) across all your check-ins" + (s.sc.length ? ": " + trendList(s) : "") + ". If the latest equals the best, you are at your peak.</p>") +
      kp(s.sinceFirst == null ? "–" : (s.sinceFirst > 0 ? "+" : "") + s.sinceFirst, "Since first", s.sinceFirst > 0 ? "up" : s.sinceFirst < 0 ? "down" : "", "h-f", "Change since the first check", s.sinceFirst == null ? "<p>Needs at least two check-ins.</p>" : "<p><b>How it is calculated:</b> latest review score <b>" + s.rev + "</b> minus your very first check <b>" + s.sc[0] + "</b> = <b>" + (s.sinceFirst > 0 ? "+" : "") + s.sinceFirst + "</b> points. This is your overall progress since you started tracking.</p>") +
      kp(s.n, "Check-ins", "", "h-n", "Check-ins: " + s.n, "<p>How many times you saved an assessment of this business. Each one is listed under Past assessments below.</p>") + "</div>" +
      (s.top || s.low ? '<div class="mb-chips hero">' +
        (s.top ? '<span class="mb-ex mb-chip good"' + reg("h-t", "Strongest: " + s.top.name, "<p>The highest-scoring aspect in the latest check: <b>" + Math.round(s.top.score) + "</b> out of 100 (" + bandTxt(s.top.score) + "). What this business does best according to guests.</p>") + ">★ Strongest: " + esc(s.top.name) + " " + Math.round(s.top.score) + "</span>" : "") +
        (s.low && s.low.score < 80 ? '<span class="mb-ex mb-chip warn"' + reg("h-l", "Focus on: " + s.low.name, "<p>The lowest-scoring aspect in the latest check: <b>" + Math.round(s.low.score) + "</b> out of 100 (" + bandTxt(s.low.score) + "). It is shown when under 80 because improving it lifts the overall score the most.</p>") + ">⚑ Focus on: " + esc(s.low.name) + " " + Math.round(s.low.score) + "</span>" : "") + "</div>" : "") + "</div>";
  }

  function animate(root) {
    if (!root) return;
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      root.querySelectorAll(".mb-arc").forEach(function (a) { a.style.strokeDashoffset = a.getAttribute("data-off"); });
      root.classList.add("mb-in");
    }); });
    if (RM) return;
    root.querySelectorAll("[data-count]").forEach(function (el) {
      var to = Number(el.getAttribute("data-count")), t0 = performance.now(), dur = 900 + Math.min(to, 100) * 4;
      (function tick(t) { var p = Math.min(1, (t - t0) / dur); el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(tick); })(t0);
    });
  }

  var css = ".mb-ex{cursor:pointer;position:relative}.mb-ex:focus-visible{outline:2px solid #FFB438;outline-offset:2px}.mb-i{position:absolute;top:4px;right:5px;width:14px;height:14px;border-radius:50%;border:1px solid rgba(255,255,255,.4);color:#d9d4ca;font:italic 600 10px/12px Georgia,serif;text-align:center;font-style:italic;pointer-events:none}.mb-dash-ring .mb-i{top:2px;right:2px}.mb-tile.mb-ex:hover,.mb-hk.mb-ex:hover{background:rgba(255,255,255,.15)}.mb-chip.mb-ex:hover{filter:brightness(.95)}.mb-card-ring,.mb-card-spark{cursor:pointer}.cmp-aspect.mb-ex:hover,.verdict.mb-ex:hover,.cmp-biz .cr.mb-ex:hover{background:rgba(246,149,0,.07);border-radius:10px}" + ".mb-dash,.mb-hero{position:relative;overflow:hidden;border-radius:16px;padding:20px;margin-bottom:14px;color:#fff;background:linear-gradient(135deg,#1b1d22 0%,#2a2118 60%,#3a2812 100%);box-shadow:0 10px 30px rgba(20,22,26,.18)}" +
    ".mb-orb{position:absolute;border-radius:50%;filter:blur(34px);opacity:.5;pointer-events:none;animation:mbfloat 9s ease-in-out infinite}" +
    ".mb-orb.o1{width:180px;height:180px;background:#F69500;top:-60px;right:-40px}.mb-orb.o2{width:140px;height:140px;background:#1D9E75;bottom:-70px;left:-30px;animation-delay:-3s;opacity:.35}.mb-orb.o3{width:110px;height:110px;background:#FFD35A;top:30%;left:45%;animation-delay:-6s;opacity:.18}" +
    "@keyframes mbfloat{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-18px,14px) scale(1.12)}}" +
    ".mb-dash-top,.mb-hero-top{position:relative;display:flex;align-items:center;gap:16px}" +
    ".mb-dash-ring{position:relative;flex:0 0 auto;color:#fff;line-height:0}.mb-ring{display:block}" +
    ".mb-arc{transition:stroke-dashoffset 1.3s cubic-bezier(.2,.8,.2,1)}" +
    ".mb-ringnum{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:700 17px 'Space Grotesk',sans-serif}.mb-ringnum.big{font-size:30px}" +
    ".mb-card-ring{position:relative;flex:0 0 auto;line-height:0;color:var(--ink)}" +
    ".mb-dash-copy{min-width:0}.mb-dash-copy h2{margin:2px 0 4px;font:700 22px/1.15 'Space Grotesk',sans-serif;overflow-wrap:anywhere}" +
    ".mb-eyebrow{margin:0;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#FFD35A;font-weight:600}.mb-dash-sub{margin:0;font-size:13px;color:rgba(255,255,255,.75)}" +
    ".mb-tiles{position:relative;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:16px}" +
    ".mb-tile,.mb-hk{background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:10px 6px;text-align:center;backdrop-filter:blur(4px)}" +
    ".mb-tile b,.mb-hk b{display:block;font:700 22px 'Space Grotesk',sans-serif;font-variant-numeric:tabular-nums}.mb-tile span,.mb-hk span{font-size:11px;color:rgba(255,255,255,.7)}" +
    ".mb-tile.up b,.mb-hk.up b{color:#5fe0b0}.mb-tile.down b,.mb-hk.down b{color:#ff8f7a}" +
    ".mb-note{position:relative;display:flex;gap:8px;align-items:flex-start;margin:14px 0 0;font-size:13px;color:rgba(255,255,255,.85)}.mb-note b{color:#fff}" +
    ".mb-pulse{flex:0 0 auto;width:8px;height:8px;margin-top:5px;border-radius:50%;background:#5fe0b0;animation:mbpulse 1.8s infinite}" +
    "@keyframes mbpulse{0%{box-shadow:0 0 0 0 rgba(95,224,176,.6)}100%{box-shadow:0 0 0 10px rgba(95,224,176,0)}}" +
    ".mb-hero-spark{position:relative;margin-top:14px;height:56px}.mb-hero-spark .mb-spark{width:100%;height:100%}" +
    ".mb-hks{position:relative;display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px}.mb-hk b{font-size:19px}" +
    ".mb-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.mb-chips.hero{position:relative}" +
    ".mb-chip{font-size:11.5px;font-weight:600;border-radius:999px;padding:3px 9px;background:#f1eee9;color:#5B5B5B;white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis}" +
    ".mb-chip.up,.mb-chip.good{background:#E3F5EE;color:#137a59}.mb-chip.down,.mb-chip.warn{background:#FBE9E5;color:#a53a27}.mb-chip.new{background:#FEF3E2;color:#a8641a}" +
    ".mb-hero .mb-chip.good{background:rgba(95,224,176,.18);color:#8ff0cb}.mb-hero .mb-chip.warn{background:rgba(255,143,122,.18);color:#ffb3a3}" +
    ".mb-card{gap:14px;align-items:center;opacity:0;transform:translateY(12px)}.mb-in .mb-card{animation:mbrise .5s var(--d,0ms) cubic-bezier(.2,.8,.2,1) forwards}" +
    "@keyframes mbrise{to{opacity:1;transform:none}}" +
    ".mb-card:hover{border-color:var(--coral);box-shadow:0 8px 22px rgba(246,149,0,.15);transform:translateY(-2px)}.mb-card{transition:box-shadow .2s,border-color .2s}" +
    ".mb-card:focus-visible{outline:2px solid var(--coral);outline-offset:2px}.mb-card-main{flex:1 1 auto;min-width:0}" +
    ".mb-card-spark{flex:0 0 120px;height:44px}.mb-spark{width:100%;height:100%;display:block;overflow:visible}" +
    ".mb-line{stroke-dasharray:1;stroke-dashoffset:1}.mb-in .mb-line{animation:mbdraw 1.4s .2s ease-out forwards}@keyframes mbdraw{to{stroke-dashoffset:0}}" +
    ".mb-sw{position:relative;width:100%;height:100%}.mb-dot{position:absolute;width:8px;height:8px;margin:-4px 0 0 -4px;border-radius:50%;opacity:0}.mb-in .mb-dot{animation:mbpop .4s 1.4s forwards}@keyframes mbpop{from{opacity:0;transform:scale(0)}to{opacity:1;transform:none}}" +
    ".mb-spark-empty{font-size:11px;color:var(--ink-soft);text-align:right}.mb-go{color:var(--ink-soft);font-size:20px}" +
    "@media(max-width:600px){.mb-card-spark{display:none}.mb-dash-copy h2{font-size:19px}.mb-hks{grid-template-columns:repeat(2,1fr)}}" +
    "@media(prefers-reduced-motion:reduce){.mb-orb,.mb-pulse{animation:none}.mb-card{opacity:1;transform:none}.mb-line{stroke-dashoffset:0}.mb-dot{opacity:1}.mb-arc{transition:none}}";
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
  if (RM) st.textContent += ".mb-card{opacity:1!important;transform:none!important}";

  // ---- tap-to-explain for dashboard elements and the Compare screen ----
  function ex(t, h) { if (window.__p2pExplain) window.__p2pExplain(t, h); }
  function cmpInfo() {
    var n = document.querySelectorAll(".cmp-biz .cn"); return { a: n[0] ? n[0].textContent : "A", b: n[1] ? n[1].textContent : "B" };
  }
  function cmpScores() {
    var out = [], aw = 0, bw = 0;
    document.querySelectorAll(".cmp-aspect").forEach(function (el) {
      var nm = (el.querySelector(".cmp-aspect-label") || {}).textContent || "";
      var rows = el.querySelectorAll(".cmp-bar-row"), av = null, bv = null;
      rows.forEach(function (r) { var who = (r.querySelector(".who") || {}).textContent, v = Number((r.querySelector(".sc") || {}).textContent); if (who === "A") av = v; else bv = v; });
      if (av != null && bv != null) { if (av - bv >= 12) aw++; else if (bv - av >= 12) bw++; }
      out.push({ name: nm, a: av, b: bv, el: el });
    });
    return { rows: out, aw: aw, bw: bw };
  }
  function openCmp(el) {
    var who = cmpInfo(), cs = cmpScores();
    if (el.classList.contains("cmp-aspect")) {
      var r = cs.rows.filter(function (x) { return x.el === el; })[0]; if (!r) return;
      var gap = r.a != null && r.b != null ? r.a - r.b : null;
      ex(r.name + ": " + (r.a == null ? "–" : r.a) + " vs " + (r.b == null ? "–" : r.b),
        "<p><b>What it means:</b> how positive guest feedback is about <b>" + esc(r.name) + "</b> at each business, scored 0–100 by our AI. Higher is better.</p>" +
        "<p><b>This comparison:</b> " + esc(who.a) + " (A) <b>" + (r.a == null ? "–" : r.a) + "</b> · " + esc(who.b) + " (B) <b>" + (r.b == null ? "–" : r.b) + "</b>." + (gap == null ? "" : gap >= 12 ? " " + esc(who.a) + " leads by " + gap + " points, which counts as a clear win." : gap <= -12 ? " " + esc(who.b) + " leads by " + (-gap) + " points, which counts as a clear win." : " The gap is " + Math.abs(gap) + " points, under the 12-point margin, so neither is counted as a win.") + "</p>");
    } else if (el.classList.contains("cr")) {
      ex("About these numbers", "<p><b>AI rating</b> is the average of a business's aspect scores divided by 20, giving a 5-star style number. It is our AI's assessment of what guests say, not Google's star rating.</p><p><b>Themes found</b> is how many separate things guests love plus things where it slips were identified. It is not a review count.</p><p>When live Google data is available, the real star rating and review count are shown instead.</p>");
    } else if (el.classList.contains("verdict")) {
      ex("How the verdict is decided", "<p>We compare the two businesses on every aspect. A <b>win</b> needs a lead of <b>12 points or more</b> on that aspect, so small differences do not count.</p><p><b>This comparison:</b> " + esc(who.a) + " leads on <b>" + cs.aw + "</b>, " + esc(who.b) + " leads on <b>" + cs.bw + "</b>, out of " + cs.rows.length + " aspects.</p><p>More wins means that business comes out ahead. Equal wins means closely matched. The tips below are drawn from the aspects with a clear gap.</p>");
    }
  }
  var CMP = ".cmp-aspect, .cmp-biz .cr, .verdict";
  function decorate() { document.querySelectorAll(CMP).forEach(function (el) { if (!el.classList.contains("mb-ex")) { el.classList.add("mb-ex"); el.tabIndex = 0; el.setAttribute("role", "button"); } }); }
  var mo = new MutationObserver(function () { decorate(); }); mo.observe(document.body, { childList: true, subtree: true }); decorate();
  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("[data-ex]");
    if (t) { var d = EXR[t.getAttribute("data-ex")]; if (d) { e.stopPropagation(); e.preventDefault(); ex(d[0], d[1]); } return; }
    var c = e.target.closest && e.target.closest(CMP); if (c && !e.target.closest("a,button")) openCmp(c);
  }, true);
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    var t = e.target; if (!t || !t.closest) return;
    var d = t.hasAttribute && t.hasAttribute("data-ex") ? EXR[t.getAttribute("data-ex")] : null;
    if (d) { e.stopPropagation(); e.preventDefault(); ex(d[0], d[1]); return; }
    if (t.matches && t.matches(CMP)) { e.preventDefault(); openCmp(t); }
  }, true);

  window.__p2pMy = { dash: dash, card: card, hero: hero, animate: animate, stats: stats };
})();
