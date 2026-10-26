/* Choose which AI engine runs your assessments. Keys go to the Worker, are encrypted there and are never shown again. Admins can also set the organisation default. */
(function () {
  var dlg, S = { info: null, providers: [], cur: null, scope: "me" };
  function el(t, a, txt) { var e = document.createElement(t); if (a) Object.keys(a).forEach(function (k) { if (a[k] !== false && a[k] != null) e.setAttribute(k, a[k]); }); if (txt != null) e.textContent = txt; return e; }
  function api(p, b) { return window.__p2p.api(p, b || {}); }
  function prov(id) { return S.providers.filter(function (p) { return p.id === id; })[0]; }
  function fmt(ts) { try { return new Date(ts).toLocaleString("default", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); } catch (e) { return ""; } }

  function build() {
    dlg.textContent = "";
    var inf = S.info || {}, act = inf.active || {};
    var cur = (S.scope === "org" ? inf.org : inf.mine) || {}; cur.configured = !!(S.scope === "org" ? inf.org : inf.mine);
    var body = el("div", { class: "p2x-body" });
    body.appendChild(el("h3", null, "My AI engine"));
    body.appendChild(el("p", { class: "p2x-note" }, "Your assessments (review analysis, forecast, SEO plan, social report) run on the engine you pick here, using your own API key. Each result shows which engine wrote it."));
    var now = el("p", { class: "p2x-note", style: "background:#f9fafb;border-radius:10px;padding:10px 12px" });
    now.appendChild(el("b", null, "In use now: "));
    now.appendChild(document.createTextNode((act.label || "Google Gemini") + " · " + (act.model || "") + (act.source === "default" ? " (platform default)" : act.source === "org" ? " (organisation default)" : " (your own)")));
    body.appendChild(now);
    // Daily usage per engine, against the daily limit an admin has set for it.
    var U = S.usage;
    if (U) {
      var ub = el("div", { class: "p2x-usage" });
      ub.appendChild(el("b", null, "Daily usage"));
      ub.appendChild(el("p", { class: "p2x-note", style: "margin:2px 0 8px" }, "Counts every AI call made through each engine, across the whole portal. Resets at midnight UTC."));
      var byE = {}; (U.today || []).forEach(function (r) { byE[r.engine] = r; });
      var engines = [U.active].concat(Object.keys(byE)).filter(function (x, i, a) { return x && a.indexOf(x) === i; });
      var lims = {}; (U.limits || []).forEach(function (l) { lims[l.engine] = l.limit; });
      var days = []; for (var i = 6; i >= 0; i--) { var d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10); days.push(d); }
      engines.forEach(function (eg) {
        var r = byE[eg] || { calls: 0, errors: 0, blocked: 0 }, lim = lims[eg] == null ? null : lims[eg];
        var pct = lim ? Math.min(100, Math.round(r.calls / lim * 100)) : null, nm = eg.replace(":", " · ");
        var card = el("div", { class: "p2x-ucard" });
        var top = el("div", { class: "p2x-utop" }); top.appendChild(el("span", null, nm + (eg === U.active ? " (in use)" : ""))); top.appendChild(el("b", null, r.calls + (lim != null ? " / " + lim : "") + " today")); card.appendChild(top);
        var bar = el("div", { class: "p2x-ubar" }); var fill = el("i", { style: "width:" + (pct == null ? Math.min(100, r.calls) : pct) + "%;background:" + (pct != null && pct >= 90 ? "#C24A34" : pct != null && pct >= 70 ? "#F69500" : "#1D9E75") }); bar.appendChild(fill); card.appendChild(bar);
        card.appendChild(el("p", { class: "p2x-note", style: "margin:4px 0" }, (lim == null ? "No daily limit set. " : (lim - r.calls > 0 ? (lim - r.calls) + " calls left today. " : "Daily limit reached. ")) + r.errors + " failed" + (r.blocked ? ", " + r.blocked + " blocked by the limit" : "") + "."));
        var mx = 1, series = days.map(function (dy) { var v = 0; (U.days || []).forEach(function (q) { if (q.engine === eg && String(q.day).slice(0, 10) === dy) v += q.calls; }); mx = Math.max(mx, v); return v; });
        var spark = el("div", { class: "p2x-uspark", title: "Last 7 days: " + series.join(", ") });
        series.forEach(function (v) { spark.appendChild(el("i", { style: "height:" + Math.max(4, Math.round(v / mx * 100)) + "%" })); });
        card.appendChild(spark);
        if (U.is_admin) {
          var lrow = el("div", { class: "p2x-urow" });
          var li = el("input", { type: "number", min: "0", step: "1", placeholder: "No limit", value: lim == null ? "" : String(lim), "aria-label": "Daily limit for " + nm });
          var lb2 = el("button", { class: "p2x-btn ghost", type: "button" }, "Set limit");
          lb2.addEventListener("click", function () {
            lb2.disabled = true; lb2.textContent = "Saving…";
            api("/ai/limit", { engine: eg, limit: li.value.trim() === "" ? null : Number(li.value) }).then(function () { return loadUsage(); }).then(function () { build(); }).catch(function (er) { lb2.disabled = false; lb2.textContent = "Set limit"; var m = dlg.querySelector(".p2x-msg"); if (m) { m.style.color = "#b91c1c"; m.textContent = (er && er.message) || "Could not save the limit."; } });
          });
          lrow.appendChild(el("label", null, "Daily limit")); lrow.appendChild(li); lrow.appendChild(lb2); card.appendChild(lrow);
        }
        ub.appendChild(card);
      });
      body.appendChild(ub);
    }
    if (inf.is_admin) {
      var scopeSel = el("select", { "aria-label": "Apply to" });
      scopeSel.appendChild(el("option", { value: "me" }, "Just me"));
      scopeSel.appendChild(el("option", { value: "org" }, "Everyone without their own (organisation default)"));
      scopeSel.value = S.scope;
      var ls = el("label", null, "Apply to"); ls.appendChild(scopeSel); body.appendChild(ls);
      scopeSel.addEventListener("change", function () { S.scope = scopeSel.value; build(); });
    }

    var sel = el("select", { "aria-label": "AI engine" });
    S.providers.forEach(function (p) { sel.appendChild(el("option", { value: p.id }, p.label)); });
    var start = cur.configured ? cur.provider : "gemini"; sel.value = prov(start) ? start : "gemini";
    var l1 = el("label", null, "Engine"); l1.appendChild(sel); body.appendChild(l1);

    var model = el("input", { type: "text", maxlength: "120", autocomplete: "off", spellcheck: "false", list: "p2xModels" });
    var dl = el("datalist", { id: "p2xModels" });
    var l2 = el("label", null, "Model"); l2.appendChild(model); l2.appendChild(dl); body.appendChild(l2);
    var modelHint = el("p", { class: "p2x-note" }, "Type any model name the provider offers. New models work without an update.");
    body.appendChild(modelHint);

    var baseWrap = el("div", { style: "display:flex;flex-direction:column;gap:12px" });
    var base = el("input", { type: "text", placeholder: "https://api.example.com/v1", autocomplete: "off", spellcheck: "false" });
    var lb = el("label", null, "API address"); lb.appendChild(base); baseWrap.appendChild(lb);
    var fmtSel = el("select", { "aria-label": "API format" });
    [["openai", "OpenAI-style (most providers)"], ["anthropic", "Anthropic-style"], ["gemini", "Gemini-style"]].forEach(function (o) { fmtSel.appendChild(el("option", { value: o[0] }, o[1])); });
    var lf = el("label", null, "API format"); lf.appendChild(fmtSel); baseWrap.appendChild(lf);
    body.appendChild(baseWrap);

    var key = el("input", { type: "password", autocomplete: "new-password", spellcheck: "false", placeholder: "" });
    var lk = el("label", null, "API key"); lk.appendChild(key); body.appendChild(lk);
    var keyHint = el("p", { class: "p2x-note" }); body.appendChild(keyHint);
    body.appendChild(el("p", { class: "p2x-note" }, "Your key is encrypted on the server and is never shown again. Your business and review text is sent to the engine you choose, so pick one you are comfortable with. Billing happens on your account with that provider. If you set nothing, the platform default (Google Gemini) is used."));
    var warn = el("p", { class: "p2x-note", style: "color:#92400e" });
    body.appendChild(warn);
    var msg = el("p", { class: "p2x-msg", "aria-live": "polite" }); body.appendChild(msg);

    function sync(first) {
      var p = prov(sel.value) || {};
      dl.textContent = ""; (p.models || []).forEach(function (m) { dl.appendChild(el("option", { value: m })); });
      if (!first || !(cur.configured && cur.provider === sel.value)) model.value = p.model || "";
      else model.value = cur.model || p.model || "";
      baseWrap.style.display = p.custom ? "flex" : "none";
      if (p.custom) { base.value = (cur.configured && cur.provider === "custom" && cur.base_url) || base.value || ""; fmtSel.value = (cur.configured && cur.provider === "custom" && cur.kind) || fmtSel.value; }
      var has = cur.configured && cur.provider === sel.value && cur.has_key;
      key.placeholder = has ? "•••• " + (cur.key_last4 || "") + " saved. Leave blank to keep it." : (p.kind === "gemini" && !p.custom ? "Optional: leave blank to use the platform's Gemini key" : "Paste the API key");
      keyHint.textContent = has ? "A key ending in " + (cur.key_last4 || "••••") + " is saved for this engine." : "";
      warn.textContent = (p.kind === "gemini" && !p.custom) || (p.custom && fmtSel.value === "gemini") ? "" : "Heads up: live web lookups (used for review search and social research) only work with Google Gemini. With this engine those parts are skipped and the AI relies on the data you give it.";
      msg.textContent = ""; msg.style.color = "";
    }
    sel.addEventListener("change", function () { key.value = ""; sync(false); });
    fmtSel.addEventListener("change", function () { sync(true); });
    sync(true);

    function payload() { return { scope: S.scope, provider: sel.value, model: model.value.trim(), base_url: base.value.trim(), kind: fmtSel.value, api_key: key.value.trim() }; }
    function busy(on, t) { [bt, bs, br].forEach(function (b) { b.disabled = on; }); if (t) { msg.style.color = "#6b7280"; msg.textContent = t; } }
    var row = el("div", { class: "p2x-row" });
    var br = el("button", { class: "p2x-btn ghost", type: "button" }, S.scope === "org" ? "Remove default" : "Use the default");
    var bt = el("button", { class: "p2x-btn ghost", type: "button" }, "Test");
    var bs = el("button", { class: "p2x-btn", type: "button" }, "Save");
    var bc = el("button", { class: "p2x-btn ghost", type: "button" }, "Close");
    [br, bt, bs, bc].forEach(function (b) { row.appendChild(b); }); body.appendChild(row);
    bc.addEventListener("click", function () { dlg.close(); });
    function fail(e) { msg.style.color = "#b91c1c"; msg.textContent = (e && e.message) || "Something went wrong."; }
    bt.addEventListener("click", function () {
      busy(true, "Testing the connection…");
      api("/ai/test", payload()).then(function (r) {
        busy(false);
        if (r.ok) { msg.style.color = "#047857"; msg.textContent = "Connected. The engine answered in " + (r.ms || 0) + " ms."; }
        else { msg.style.color = "#b91c1c"; msg.textContent = "Not working: " + (r.error || "no answer") + (r.status ? " (" + r.status + ")" : ""); }
      }).catch(function (e) { busy(false); fail(e); });
    });
    bs.addEventListener("click", function () {
      busy(true, "Saving…");
      api("/ai/save", payload()).then(function () { return load(); }).then(function () { build(); var m = dlg.querySelector(".p2x-msg"); if (m) { m.style.color = "#047857"; m.textContent = "Saved. Your new assessments use this engine."; } })
        .catch(function (e) { busy(false); fail(e); });
    });
    br.addEventListener("click", function () {
      busy(true, "Resetting…");
      api("/ai/reset", {}).then(function () { return load(); }).then(function () { build(); var m = dlg.querySelector(".p2x-msg"); if (m) { m.style.color = "#047857"; m.textContent = "Done. Using the default engine again."; } })
        .catch(function (e) { busy(false); fail(e); });
    });
    dlg.appendChild(body);
  }
  function loadUsage() { return api("/ai/usage", {}).then(function (r) { S.usage = r; }, function () { S.usage = null; }); }
  function load() { return api("/ai/info", {}).then(function (r) { S.info = r; S.providers = r.providers || []; }).then(loadUsage); }
  function open() {
    S.scope = "me";
    if (!dlg) { dlg = el("dialog", { class: "p2x-modal" }); document.body.appendChild(dlg); }
    dlg.textContent = ""; dlg.appendChild(el("div", { class: "p2x-body" }, "Loading…"));
    if (!dlg.open) dlg.showModal();
    load().then(build).catch(function (e) { dlg.textContent = ""; var b = el("div", { class: "p2x-body" }); b.appendChild(el("h3", null, "My AI engine")); b.appendChild(el("p", { class: "p2x-note" }, (e && e.code === "forbidden") ? e.message : "Could not load the AI engine settings. Try again in a moment.")); var c = el("button", { class: "p2x-btn ghost", type: "button" }, "Close"); c.addEventListener("click", function () { dlg.close(); }); b.appendChild(c); dlg.appendChild(b); });
  }
  var st = document.createElement("style");
  st.textContent = ".p2x-body input[type=password]{padding:10px 12px;border:1px solid #d1d5db;border-radius:10px;font:14px system-ui,sans-serif;background:#fff;color:#1f2430;min-width:0}.p2x-modal{overflow-y:auto}.p2p-eng{margin:2px 0 8px;font-size:12.5px;color:var(--ink-soft)}.p2p-eng b{color:var(--ink);font-weight:600}";
  st.textContent += ".p2x-usage{border:1px solid #e6dfd3;border-radius:12px;padding:12px;margin:12px 0;background:#fff}.p2x-ucard{padding:10px 0;border-top:1px solid #f0ebe1}.p2x-ucard:first-of-type{border-top:0}.p2x-utop{display:flex;justify-content:space-between;gap:8px;font-size:13px;flex-wrap:wrap}.p2x-ubar{height:8px;border-radius:6px;background:#ece5d9;overflow:hidden;margin-top:6px}.p2x-ubar i{display:block;height:100%;border-radius:6px;transition:width .8s}.p2x-uspark{display:flex;align-items:flex-end;gap:3px;height:28px}.p2x-uspark i{flex:1;background:#E8943A;opacity:.7;border-radius:2px}.p2x-urow{display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap}.p2x-urow label{font-size:12px;color:#6b7280}.p2x-urow input{width:110px;padding:8px 10px;border:1px solid #d1d5db;border-radius:10px;font:14px system-ui,sans-serif}";
  document.head.appendChild(st);
  window.__p2pEngine = { open: open };
})();
