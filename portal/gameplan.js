/* Game Plan: an AI-drafted, staff-edited growth proposal for a business owner, plus the per-org service catalog it prices from. Staff only. */
(function () {
  var ME = null, MEP = null;
  function esc(t) { return String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function sbc() { return window.__p2p && window.__p2p.sb; }
  function rpc(fn, args) { var s = sbc(); if (!s) return Promise.reject({ message: "Not available right now." }); return s.rpc(fn, args || {}).then(function (r) { if (r.error) throw r.error; return r.data; }); }
  function me() { if (ME) return Promise.resolve(ME); if (MEP) return MEP; MEP = rpc("my_role").then(function (d) { ME = d || {}; return ME; }, function () { ME = {}; return ME; }); return MEP; }
  var STAFF = ["super", "admin", "agency_admin", "sales"], CATADMIN = ["super", "admin", "agency_admin"];
  function money(n, unit) { n = Number(n || 0); var s = "$" + n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }); return unit === "per month" ? s + "/mo" : s; }
  function fmtD(ts) { try { return new Date(ts).toLocaleDateString("default", { month: "short", day: "numeric", year: "numeric" }); } catch (e) { return ""; } }
  var CATS = ["Reviews", "Website SEO", "Social media", "Other"];

  // ---------- service catalog ----------
  var cdlg = null;
  function openCatalog() {
    me().then(function (m) {
      if (CATADMIN.indexOf(m.role) < 0) return;
      if (!cdlg) { cdlg = document.createElement("dialog"); cdlg.className = "p2x-modal gp-dlg"; document.body.appendChild(cdlg); }
      function draw(list, editing) {
        var h = '<div class="p2x-body"><h3>Service catalog</h3><p class="p2x-note">The services you sell. Game Plans map each recommended fix to one of these and add up the investment. Only your team sees this list.</p>';
        h += '<div class="gp-svcs">' + (list.length ? list.map(function (s) {
          return '<div class="gp-svc' + (s.active ? "" : " off") + '"><div><b>' + esc(s.name) + '</b> <span class="gp-tag">' + esc(s.category) + '</span>' + (s.active ? "" : ' <span class="gp-tag">hidden</span>') + '<br><span class="gp-sm">' + esc(s.description || "") + '</span></div><div class="gp-pr">' + money(s.price, s.unit) + '</div><div><a href="#" data-e="' + s.id + '">Edit</a> · <a href="#" data-d="' + s.id + '">Remove</a></div></div>';
        }).join("") : '<p class="p2x-note">No services yet. Add your first one below.</p>') + '</div>';
        var e = editing || { name: "", description: "", price: "", unit: "per month", category: "Reviews", active: true };
        h += '<div class="gp-form"><b>' + (editing ? "Edit service" : "Add a service") + '</b>' +
          '<input id="gpsN" type="text" maxlength="120" placeholder="Service name, e.g. Review response management" value="' + esc(e.name) + '">' +
          '<textarea id="gpsD" maxlength="600" rows="2" placeholder="What the owner gets (one or two sentences)">' + esc(e.description || "") + '</textarea>' +
          '<div class="gp-row"><select id="gpsC">' + CATS.map(function (c) { return '<option' + (c === e.category ? " selected" : "") + ">" + c + "</option>"; }).join("") + '</select>' +
          '<input id="gpsP" type="number" min="0" step="1" placeholder="Price" value="' + esc(e.price) + '"><select id="gpsU"><option value="per month"' + (e.unit === "per month" ? " selected" : "") + '>per month</option><option value="one-time"' + (e.unit === "one-time" ? " selected" : "") + '>one-time</option></select></div>' +
          '<label class="gp-chk"><input id="gpsA" type="checkbox"' + (e.active !== false ? " checked" : "") + '> Offer this service in plans</label>' +
          '<p class="gp-err" id="gpsM"></p><div class="gp-row"><button type="button" class="p2x-btn" id="gpsS">' + (editing ? "Save changes" : "Add service") + '</button>' + (editing ? '<button type="button" class="p2x-btn ghost" id="gpsX">Cancel</button>' : "") + '<button type="button" class="p2x-btn ghost" id="gpsClose">Close</button></div></div></div>';
        cdlg.innerHTML = h;
        cdlg.querySelector("#gpsClose").addEventListener("click", function () { cdlg.close(); });
        var x = cdlg.querySelector("#gpsX"); if (x) x.addEventListener("click", function () { draw(list, null); });
        cdlg.querySelectorAll("[data-e]").forEach(function (a) { a.addEventListener("click", function (ev) { ev.preventDefault(); var s = list.filter(function (q) { return q.id === a.getAttribute("data-e"); })[0]; if (s) draw(list, s); }); });
        cdlg.querySelectorAll("[data-d]").forEach(function (a) { a.addEventListener("click", function (ev) { ev.preventDefault(); if (a.getAttribute("data-armed") !== "1") { a.setAttribute("data-armed", "1"); a.textContent = "Click again to remove"; return; } rpc("delete_service", { p_id: a.getAttribute("data-d") }).then(reload, function (er) { cdlg.querySelector("#gpsM").textContent = er.message || "Could not remove."; }); }); });
        cdlg.querySelector("#gpsS").addEventListener("click", function () {
          var msg = cdlg.querySelector("#gpsM"), price = cdlg.querySelector("#gpsP").value.trim();
          if (price === "" || isNaN(Number(price)) || Number(price) < 0) { msg.textContent = "Enter a price (0 or more)."; return; }
          rpc("save_service", { p_id: editing ? editing.id : null, p_name: cdlg.querySelector("#gpsN").value, p_description: cdlg.querySelector("#gpsD").value, p_price: Number(price), p_unit: cdlg.querySelector("#gpsU").value, p_category: cdlg.querySelector("#gpsC").value, p_active: cdlg.querySelector("#gpsA").checked }).then(reload, function (er) { msg.textContent = er.message || "Could not save."; });
        });
      }
      function reload() { return rpc("list_services").then(function (l) { SERV = l; draw(l, null); }, function () { draw([], null); }); }
      if (cdlg.showModal) cdlg.showModal();
      reload();
    });
  }
  var SERV = null;
  function services() { return rpc("list_services").then(function (l) { SERV = l; return l; }, function () { return SERV || []; }); }

  // ---------- context and AI draft ----------
  function lines(v) { return String(v || "").split(/\n+/).map(function (x) { return x.trim(); }).filter(Boolean); }
  function gather(opts) {
    var slug = opts.slug, L = window.__p2pLast, a = null, last = null;
    if (L && L.kind === "single" && L.a && window.slugify && window.slugify(L.a.name) === slug) a = L.a;
    else if (opts.history && opts.history.length) { last = opts.history[opts.history.length - 1]; a = (last && last.full) || last; }
    if (!a) return Promise.resolve(null);
    return Promise.all([opts.load("reviewlens_seo_" + slug, null), opts.load("reviewlens_social_" + slug, null)]).then(function (r) {
      var seo = r[0], soc = r[1], c = null;
      try { c = window.__p2pOverall && window.__p2pOverall.compute({ aspects: a.aspects || [], rating: a.rating }, seo, soc); } catch (e) { c = null; }
      var profs = ((soc && soc.profiles) || []).filter(function (p) { return p.report; });
      return { a: a, seo: seo, soc: soc, profs: profs, overall: c ? c.score : null, parts: c ? c.parts : [] };
    });
  }
  function snapshotOf(g) {
    var a = g.a;
    return { date: Date.now(), overall: g.overall, rating: a.rating == null ? null : a.rating, reviews: a.review_count == null ? null : String(a.review_count),
      seo: g.seo && typeof g.seo.score === "number" ? Math.round(g.seo.score) : null,
      social: g.profs.map(function (p) { return { platform: p.platform, score: p.report.score }; }),
      aspects: (a.aspects || []).map(function (x) { return { name: x.name, score: x.score }; }) };
  }
  function draftPrompt(g, svc, name, address) {
    var a = g.a, s = [];
    s.push("You are a marketing strategist writing a 90-day Game Plan that a marketing agency will present to a local business owner. Be specific, practical and honest. Use only the facts below; do not invent numbers, competitors or reviews.");
    s.push("BUSINESS: " + name + (address ? " (" + address + ")" : ""));
    s.push("OVERALL BUSINESS HEALTH SCORE: " + (g.overall == null ? "unknown" : g.overall + " out of 100") + (g.parts.length ? " = " + g.parts.map(function (p) { return p.name + " " + p.score; }).join(", ") : ""));
    s.push("GOOGLE RATING: " + (a.rating == null ? "not available" : a.rating + " out of 5") + "; GOOGLE REVIEWS: " + (a.review_count == null ? "not available" : a.review_count));
    s.push("REVIEW ASPECT SCORES: " + (a.aspects || []).map(function (x) { return x.name + " " + x.score; }).join(", "));
    s.push("WHAT GUESTS LOVE: " + (a.likes || []).join("; "));
    s.push("WHERE IT SLIPS: " + (a.dislikes || []).join("; "));
    s.push("EARLIER AI SUGGESTIONS: " + (a.suggestions || []).join("; "));
    if (g.seo) s.push("WEBSITE SEO SCORE: " + g.seo.score + " out of 100" + (g.seo.cats ? "; categories: " + Object.keys(g.seo.cats).map(function (k) { return k + " " + g.seo.cats[k]; }).join(", ") : ""));
    else s.push("WEBSITE SEO: not checked yet");
    if (g.profs.length) s.push("SOCIAL: " + g.profs.map(function (p) { return p.platform + " " + p.report.score + "/100" + (p.report.gaps && p.report.gaps.length ? " (gaps: " + p.report.gaps.slice(0, 2).join("; ") + ")" : ""); }).join(" | "));
    else s.push("SOCIAL: not assessed yet");
    s.push("SERVICES THE AGENCY SELLS (use their ids exactly; use null when none fits): " + (svc.length ? JSON.stringify(svc.filter(function (x) { return x.active; }).map(function (x) { return { id: x.id, name: x.name, category: x.category, price: x.price, unit: x.unit, what: (x.description || "").slice(0, 120) }; })) : "none listed"));
    s.push('Return ONLY JSON: {"standing":{"summary":"2-3 plain sentences on where the business stands today","strengths":["..."],"gaps":["..."]},"priorities":[{"title":"short action","why":"one sentence tied to the data above","impact":"High|Medium|Low","effort":"Low|Medium|High","area":"Reviews|Website SEO|Social media|Other","service_id":"id or null"}],"roadmap":[{"month":1,"title":"Quick wins","actions":["..."]},{"month":2,"title":"Build","actions":["..."]},{"month":3,"title":"Grow","actions":["..."]}],"results":{"score_target":number,"note":"one or two honest sentences on the improvement to expect if the plan is followed"}}. Give 3 to 5 priorities ordered by impact, 2 to 4 actions per month, and 2 to 4 strengths and gaps. score_target must be a realistic number between the current overall score and 95.');
    return s.join("\n").slice(0, 22000);
  }
  function normalize(raw, svc, g) {
    var byId = {}; svc.forEach(function (x) { byId[x.id] = x; });
    raw = raw && typeof raw === "object" ? raw : {};
    var st = raw.standing || {}, rs = raw.results || {};
    var now = g.overall, tgt = Number(rs.score_target);
    if (!(tgt > 0)) tgt = now != null ? Math.min(95, now + 12) : null;
    if (now != null && tgt != null) tgt = Math.max(now, Math.min(95, Math.round(tgt)));
    var pri = (Array.isArray(raw.priorities) ? raw.priorities : []).slice(0, 6).map(function (p) {
      var sv = p && p.service_id && byId[p.service_id] ? p.service_id : "";
      return { title: String(p.title || "").slice(0, 140), why: String(p.why || "").slice(0, 300), impact: /^(High|Medium|Low)$/i.test(p.impact) ? p.impact[0].toUpperCase() + p.impact.slice(1).toLowerCase() : "Medium", effort: /^(High|Medium|Low)$/i.test(p.effort) ? p.effort[0].toUpperCase() + p.effort.slice(1).toLowerCase() : "Medium", area: String(p.area || "Other").slice(0, 30), service_id: sv };
    }).filter(function (p) { return p.title; });
    var rm = [1, 2, 3].map(function (m) { var r = (Array.isArray(raw.roadmap) ? raw.roadmap : []).filter(function (x) { return Number(x.month) === m; })[0] || {}; return { month: m, title: String(r.title || ["Quick wins", "Build", "Grow"][m - 1]).slice(0, 60), actions: (Array.isArray(r.actions) ? r.actions : []).map(String).slice(0, 6) }; });
    return { standing: { summary: String(st.summary || "").slice(0, 700), strengths: (Array.isArray(st.strengths) ? st.strengths : []).map(String).slice(0, 6), gaps: (Array.isArray(st.gaps) ? st.gaps : []).map(String).slice(0, 6) }, priorities: pri, roadmap: rm, results: { score_target: tgt, note: String(rs.note || "").slice(0, 400) }, investment: { note: "" } };
  }
  function invest(content, svc) {
    var byId = {}; svc.forEach(function (x) { byId[x.id] = x; });
    var seen = {}, items = [], once = 0, mo = 0;
    (content.priorities || []).forEach(function (p) { var s = p.service_id && byId[p.service_id]; if (!s || seen[s.id]) return; seen[s.id] = 1; items.push({ id: s.id, name: s.name, price: Number(s.price), unit: s.unit }); if (s.unit === "per month") mo += Number(s.price); else once += Number(s.price); });
    return { items: items, total_once: once, total_monthly: mo, total_90: once + mo * 3 };
  }

  // ---------- section ----------
  function mount(el, opts) {
    if (!el) return;
    me().then(function (m) {
      if (STAFF.indexOf(m.role) < 0) return;
      el.innerHTML = '<section class="gp"><div class="soc-top"><p class="soc-eyebrow">Game Plan</p><h3>A plan to grow ' + esc(opts.name || "this business") + '</h3><p class="soc-meta">An AI-drafted 90-day plan you can edit, price from your service catalog, and present to the owner.</p></div><div class="gp-body"></div></section>';
      run(el.querySelector(".gp-body"), opts, m);
    });
  }
  function run(root, opts, m) {
    var state = { plans: [], cur: null, svc: [], busy: false, msg: "" };
    function setMsg(t, ok) { state.msg = t ? '<p class="' + (ok ? "gp-ok" : "gp-err") + '">' + esc(t) + "</p>" : ""; }
    function loadList() { return Promise.all([rpc("list_plans", { p_slug: opts.slug }), services()]).then(function (r) { state.plans = r[0] || []; state.svc = r[1] || []; }, function (e) { setMsg((e && e.message) || "Could not load plans."); }); }
    function listView() {
      var h = state.msg + '<div class="gp-acts"><button type="button" class="soc-go" data-a="new"' + (state.busy ? " disabled" : "") + ">" + (state.busy ? "Drafting with AI…" : (state.plans.length ? "＋ New Game Plan" : "Create Game Plan")) + "</button></div>";
      if (!state.svc.length) h += '<p class="soc-hint">' + (CATADMIN.indexOf(m.role) >= 0 ? "Add the services you sell in <a href=\"#\" data-a=\"cat\">Service catalog</a> so plans can be priced." : "Your admin has not added services yet, so plans will not include prices.") + "</p>";
      if (state.plans.length) h += '<div class="gp-list">' + state.plans.map(function (p) { return '<div class="gp-item"><div><b>' + esc(p.title || p.business_name) + '</b> <span class="gp-tag">v' + p.version + " · " + (p.status === "sent" ? "Sent" : "Draft") + '</span><br><span class="gp-sm">Updated ' + fmtD(p.updated_at) + (p.status === "sent" ? " · opened " + p.open_count + " time" + (p.open_count === 1 ? "" : "s") : "") + '</span></div><button type="button" class="p2x-btn ghost" data-open="' + p.id + '">Open</button></div>'; }).join("") + "</div>";
      else h += '<p class="soc-empty">No Game Plan for this business yet.</p>';
      root.innerHTML = h; bindList();
    }
    function bindList() {
      root.querySelectorAll("[data-open]").forEach(function (b) { b.addEventListener("click", function () { open(b.getAttribute("data-open")); }); });
      var n = root.querySelector('[data-a="new"]'); if (n) n.addEventListener("click", create);
      var c = root.querySelector('[data-a="cat"]'); if (c) c.addEventListener("click", function (e) { e.preventDefault(); openCatalog(); });
    }
    function create() {
      if (state.busy) return; state.busy = true; setMsg(""); listView();
      gather(opts).then(function (g) {
        if (!g) throw { message: "Analyze this business first, then create the plan." };
        return opts.ai(draftPrompt(g, state.svc, opts.name, opts.address)).then(function (raw) {
          var content = normalize(raw, state.svc, g); if (!content.priorities.length) throw { message: "The AI did not return a usable plan. Try again." };
          state.cur = { id: null, title: "Game Plan for " + opts.name, status: "draft", version: (state.plans.reduce(function (a, p) { return Math.max(a, p.version); }, 0) + 1), content: content, snapshot: snapshotOf(g), engine: raw && raw._engine || null };
          state.busy = false; editor();
        });
      }).catch(function (e) { state.busy = false; setMsg((e && e.message) || "Could not draft the plan right now."); listView(); });
    }
    function open(id) {
      rpc("get_plan", { p_id: id }).then(function (p) { state.cur = p; editor(); }, function (e) { setMsg((e && e.message) || "Could not open that plan."); listView(); });
    }
    function ta(path, v, rows, ph) { return '<textarea data-p="' + path + '" data-l="1" rows="' + rows + '" placeholder="' + esc(ph || "One per line") + '"' + (ro() ? " disabled" : "") + ">" + esc((v || []).join("\n")) + "</textarea>"; }
    function ro() { return state.cur && state.cur.status !== "draft"; }
    function getP(o, path) { return path.split(".").reduce(function (a, k) { return a == null ? a : a[k]; }, o); }
    function setP(o, path, v) { var ks = path.split("."), t = o; for (var i = 0; i < ks.length - 1; i++) t = t[ks[i]]; t[ks[ks.length - 1]] = v; }
    function editor() {
      var p = state.cur, c = p.content, snap = p.snapshot || {}, inv = invest(c, state.svc), dis = ro() ? " disabled" : "";
      var h = state.msg + '<p class="soc-hint"><a href="#" data-a="back">‹ All plans</a> · v' + p.version + " · " + (p.status === "sent" ? "Sent (frozen)" : "Draft") + (p.engine ? " · drafted by " + esc(p.engine) : "") + "</p>";
      h += '<label class="gp-l">Plan title<input type="text" data-p="title" maxlength="160" value="' + esc(p.title) + '"' + dis + "></label>";
      h += '<div class="gp-sec"><h4>Where you stand today</h4>' + (snap.overall != null ? '<p class="gp-sm">Overall business health: <b>' + snap.overall + "/100</b>" + (snap.rating != null ? " · Google rating " + esc(snap.rating) + "/5" : "") + (snap.reviews ? " · " + esc(snap.reviews) + " Google reviews" : "") + (snap.seo != null ? " · Website SEO " + snap.seo : "") + (snap.social && snap.social.length ? " · " + snap.social.map(function (s) { return esc(s.platform) + " " + s.score; }).join(", ") : "") + "</p>" : "") +
        '<textarea data-p="standing.summary" rows="3"' + dis + ">" + esc(c.standing.summary) + '</textarea><div class="gp-two"><div><b class="g">What is working</b>' + ta("standing.strengths", c.standing.strengths, 4) + '</div><div><b class="r">Gaps to close</b>' + ta("standing.gaps", c.standing.gaps, 4) + "</div></div></div>";
      h += '<div class="gp-sec"><h4>Priority fixes</h4>' + c.priorities.map(function (x, i) {
        var opt = '<option value="">No service (advice only)</option>' + state.svc.filter(function (s) { return s.active || s.id === x.service_id; }).map(function (s) { return '<option value="' + s.id + '"' + (s.id === x.service_id ? " selected" : "") + ">" + esc(s.name) + " · " + money(s.price, s.unit) + "</option>"; }).join("");
        return '<div class="gp-pri"><div class="gp-n">' + (i + 1) + '</div><div class="gp-pb"><input type="text" data-p="priorities.' + i + '.title" maxlength="140" value="' + esc(x.title) + '"' + dis + '><textarea data-p="priorities.' + i + '.why" rows="2"' + dis + ">" + esc(x.why) + '</textarea><div class="gp-row"><label>Impact <select data-p="priorities.' + i + '.impact"' + dis + ">" + ["High", "Medium", "Low"].map(function (v) { return "<option" + (v === x.impact ? " selected" : "") + ">" + v + "</option>"; }).join("") + "</select></label><label>Effort <select data-p=\"priorities." + i + '.effort"' + dis + ">" + ["Low", "Medium", "High"].map(function (v) { return "<option" + (v === x.effort ? " selected" : "") + ">" + v + "</option>"; }).join("") + '</select></label><label class="gp-grow">Service <select data-p="priorities.' + i + '.service_id" data-svc="1"' + dis + ">" + opt + "</select></label>" + (ro() ? "" : '<a href="#" data-rm="' + i + '">Remove</a>') + "</div></div></div>";
      }).join("") + (ro() || c.priorities.length >= 6 ? "" : '<p><a href="#" data-a="addp">＋ Add a fix</a></p>') + "</div>";
      h += '<div class="gp-sec"><h4>90-day roadmap</h4><div class="gp-three">' + c.roadmap.map(function (r, i) { return "<div><b>Month " + r.month + '</b><input type="text" data-p="roadmap.' + i + '.title" maxlength="60" value="' + esc(r.title) + '"' + dis + ">" + ta("roadmap." + i + ".actions", r.actions, 5) + "</div>"; }).join("") + "</div></div>";
      var now = snap.overall, tg = c.results.score_target;
      h += '<div class="gp-sec"><h4>Expected results</h4><div class="gp-row"><div class="gp-big"><span>Today</span><b>' + (now == null ? "–" : now) + '</b></div><div class="gp-arrow">→</div><label class="gp-big"><span>In 90 days</span><input type="number" min="0" max="100" data-p="results.score_target" data-n="1" value="' + (tg == null ? "" : tg) + '"' + dis + ">" + "</label>" + (now != null && tg != null ? '<div class="gp-sm">AI rating ' + (now / 20).toFixed(1) + " → " + (tg / 20).toFixed(1) + " out of 5</div>" : "") + '</div><textarea data-p="results.note" rows="2"' + dis + ">" + esc(c.results.note) + "</textarea></div>";
      h += '<div class="gp-sec"><h4>Investment</h4>' + (inv.items.length ? '<div class="gp-inv">' + inv.items.map(function (i) { return "<div><span>" + esc(i.name) + "</span><b>" + money(i.price, i.unit) + "</b></div>"; }).join("") + '<div class="gp-tot"><span>' + (inv.total_once ? "One-time " + money(inv.total_once) : "") + (inv.total_once && inv.total_monthly ? " + " : "") + (inv.total_monthly ? money(inv.total_monthly, "per month") : "") + '</span><b>90-day total ' + money(inv.total_90) + "</b></div></div>" : '<p class="gp-sm">Pick a service on each fix to build the investment.</p>') + "</div>";
      h += '<p class="gp-err" id="gpM"></p><div class="gp-acts">' + (ro() ? '<button type="button" class="p2x-btn" data-a="ver">Create a new version</button>' : '<button type="button" class="soc-go" data-a="save">Save draft</button><button type="button" class="p2x-btn ghost" data-a="regen">Redraft with AI</button>') + (p.id ? '<button type="button" class="p2x-btn ghost" data-a="del">Delete</button>' : "") + "</div>";
      root.innerHTML = h; state.msg = ""; bindEd();
    }
    function bindEd() {
      var p = state.cur, c = p.content;
      root.querySelectorAll("[data-p]").forEach(function (f) {
        function upd() {
          var path = f.getAttribute("data-p"), v = f.value;
          if (f.hasAttribute("data-l")) v = lines(v); else if (f.hasAttribute("data-n")) { v = v === "" ? null : Math.max(0, Math.min(100, Math.round(Number(v)))); }
          if (path === "title") p.title = v; else setP(c, path, v);
        }
        f.addEventListener("input", upd);
        f.addEventListener("change", function () { upd(); if (f.hasAttribute("data-svc")) { var y = window.scrollY; editor(); window.scrollTo(0, y); } });
      });
      root.querySelectorAll("[data-rm]").forEach(function (a) { a.addEventListener("click", function (e) { e.preventDefault(); c.priorities.splice(Number(a.getAttribute("data-rm")), 1); editor(); }); });
      var back = root.querySelector('[data-a="back"]'); if (back) back.addEventListener("click", function (e) { e.preventDefault(); state.cur = null; loadList().then(listView); });
      var add = root.querySelector('[data-a="addp"]'); if (add) add.addEventListener("click", function (e) { e.preventDefault(); c.priorities.push({ title: "New fix", why: "", impact: "Medium", effort: "Medium", area: "Other", service_id: "" }); editor(); });
      function flash(t, ok) { var m2 = root.querySelector("#gpM"); if (m2) { m2.className = ok ? "gp-ok" : "gp-err"; m2.textContent = t; } }
      var sv = root.querySelector('[data-a="save"]'); if (sv) sv.addEventListener("click", function () {
        c.investment = Object.assign({ note: (c.investment && c.investment.note) || "" }, invest(c, state.svc));
        sv.disabled = true; sv.textContent = "Saving…";
        rpc("save_plan", { p_id: p.id, p_slug: opts.slug, p_name: opts.name, p_address: opts.address || "", p_title: p.title, p_content: c, p_snapshot: p.snapshot || {} }).then(function (r) { p.id = r.id; editor(); flash("Saved.", true); }, function (e) { sv.disabled = false; sv.textContent = "Save draft"; flash((e && e.message) || "Could not save.", false); });
      });
      var rg = root.querySelector('[data-a="regen"]'); if (rg) rg.addEventListener("click", function () {
        if (rg.getAttribute("data-armed") !== "1") { rg.setAttribute("data-armed", "1"); rg.textContent = "Click again: this replaces your edits"; return; }
        rg.disabled = true; rg.textContent = "Drafting…";
        gather(opts).then(function (g) { if (!g) throw { message: "Analyze this business first." }; return opts.ai(draftPrompt(g, state.svc, opts.name, opts.address)).then(function (raw) { var nc = normalize(raw, state.svc, g); if (!nc.priorities.length) throw { message: "The AI did not return a usable plan. Try again." }; p.content = nc; p.snapshot = snapshotOf(g); p.engine = raw && raw._engine || null; editor(); }); })
          .catch(function (e) { rg.disabled = false; rg.textContent = "Redraft with AI"; flash((e && e.message) || "Could not redraft right now.", false); });
      });
      var vr = root.querySelector('[data-a="ver"]'); if (vr) vr.addEventListener("click", function () { rpc("new_plan_version", { p_id: p.id }).then(function (r) { open(r.id); }, function (e) { flash((e && e.message) || "Could not create a new version.", false); }); });
      var dl = root.querySelector('[data-a="del"]'); if (dl) dl.addEventListener("click", function () {
        if (dl.getAttribute("data-armed") !== "1") { dl.setAttribute("data-armed", "1"); dl.textContent = "Click again to delete"; return; }
        rpc("delete_plan", { p_id: p.id }).then(function () { state.cur = null; loadList().then(listView); }, function (e) { flash((e && e.message) || "Could not delete.", false); });
      });
    }
    loadList().then(listView);
  }

  var css = ".gp{margin:18px 0;border:1px solid var(--line);border-radius:16px;padding:18px;background:var(--card)}.gp-body{margin-top:10px}.gp input[type=text],.gp input[type=number],.gp textarea,.gp select,.gp-dlg input,.gp-dlg textarea,.gp-dlg select{width:100%;box-sizing:border-box;border:1px solid var(--line);border-radius:10px;padding:9px 11px;font:inherit;font-size:14px;background:#fff;color:inherit;margin:4px 0;min-width:0}.gp textarea,.gp-dlg textarea{resize:vertical}" +
    ".gp-acts{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.gp-list,.gp-svcs{display:flex;flex-direction:column}.gp-item,.gp-svc{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 0;border-top:1px solid #f0ebe1;flex-wrap:wrap}.gp-svc.off{opacity:.55}.gp-pr{font-weight:700;white-space:nowrap}.gp-tag{display:inline-block;font-size:11px;font-weight:600;background:#f3efe8;border-radius:99px;padding:2px 8px;color:var(--ink-soft)}.gp-sm{font-size:12.5px;color:var(--ink-soft)}" +
    ".gp-sec{margin-top:18px;border-top:1px dashed var(--line);padding-top:12px}.gp-sec h4{margin:0 0 6px;font:700 13px 'Space Grotesk',sans-serif;text-transform:uppercase;letter-spacing:.08em;color:var(--ink-soft)}.gp-l{display:block;font-size:12.5px;font-weight:600;margin-top:10px}.gp-two,.gp-three{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.gp-three{grid-template-columns:repeat(3,minmax(0,1fr))}.gp-two b.g{color:#1D9E75}.gp-two b.r{color:#C24A34}" +
    ".gp-pri{display:flex;gap:10px;margin:10px 0}.gp-n{flex:0 0 26px;height:26px;border-radius:50%;background:#fff0d9;color:#c26a00;font-weight:700;display:flex;align-items:center;justify-content:center;font-size:13px;margin-top:6px}.gp-pb{flex:1;min-width:0}.gp-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.gp-row label{font-size:12.5px;font-weight:600;min-width:0}.gp-grow{flex:1 1 220px}.gp-row select{width:auto;max-width:100%}.gp-grow select{width:100%}" +
    ".gp-big{display:flex;flex-direction:column;font-size:12px;color:var(--ink-soft);min-width:80px}.gp-big b{font:700 30px 'Space Grotesk',sans-serif;color:var(--ink)}.gp-big input{width:90px;font:700 24px 'Space Grotesk',sans-serif}.gp-arrow{font-size:24px;color:var(--ink-soft)}.gp-inv>div{display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px solid #f0ebe1;font-size:14px}.gp-tot{font-weight:700;border-bottom:0!important}.gp-chk{display:flex;gap:8px;align-items:center;font-size:13px;margin:6px 0}.gp-chk input{width:auto!important}" +
    ".gp-err{color:var(--warn);font-size:13.5px;margin:8px 0 0}.gp-ok{color:#047857;font-size:13.5px;margin:8px 0 0}.gp-form{margin-top:14px;border-top:1px dashed var(--line);padding-top:12px}.gp-dlg{max-width:640px;width:calc(100% - 24px)}@media(max-width:640px){.gp{padding:14px}.gp-two,.gp-three{grid-template-columns:1fr}}";
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
  window.__p2pGamePlan = { mount: mount, openCatalog: openCatalog, services: services };
})();
