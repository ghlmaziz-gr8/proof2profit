/* Admin: choose which AI engine runs every assessment. Keys go to the Worker, are encrypted there and are never shown again. */
(function () {
  var dlg, S = { info: null, providers: [], cur: null };
  function el(t, a, txt) { var e = document.createElement(t); if (a) Object.keys(a).forEach(function (k) { if (a[k] !== false && a[k] != null) e.setAttribute(k, a[k]); }); if (txt != null) e.textContent = txt; return e; }
  function api(p, b) { return window.__p2p.api(p, b || {}); }
  function prov(id) { return S.providers.filter(function (p) { return p.id === id; })[0]; }
  function fmt(ts) { try { return new Date(ts).toLocaleString("default", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); } catch (e) { return ""; } }

  function build() {
    dlg.textContent = "";
    var cur = S.cur || {}, act = S.info && S.info.active || {};
    var body = el("div", { class: "p2x-body" });
    body.appendChild(el("h3", null, "AI engine"));
    body.appendChild(el("p", { class: "p2x-note" }, "Every assessment (review analysis, forecast, SEO plan, social report) runs on the engine you pick here. Applies to everyone using the platform."));
    var now = el("p", { class: "p2x-note", style: "background:#f9fafb;border-radius:10px;padding:10px 12px" });
    now.appendChild(el("b", null, "In use now: "));
    now.appendChild(document.createTextNode((act.label || "Google Gemini") + " · " + (act.model || "") + (act.source === "default" ? " (platform default)" : "")));
    if (cur.updated_by && cur.configured) now.appendChild(document.createTextNode(" · set by " + cur.updated_by + " " + fmt(cur.updated_at)));
    body.appendChild(now);

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
    body.appendChild(el("p", { class: "p2x-note" }, "Your key is encrypted on the server and is never shown again. Review and business text is sent to the engine you choose, so pick one you are comfortable with. Billing happens on your account with that provider."));
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

    function payload() { return { provider: sel.value, model: model.value.trim(), base_url: base.value.trim(), kind: fmtSel.value, api_key: key.value.trim() }; }
    function busy(on, t) { [bt, bs, br].forEach(function (b) { b.disabled = on; }); if (t) { msg.style.color = "#6b7280"; msg.textContent = t; } }
    var row = el("div", { class: "p2x-row" });
    var br = el("button", { class: "p2x-btn ghost", type: "button" }, "Use platform default");
    var bt = el("button", { class: "p2x-btn ghost", type: "button" }, "Test");
    var bs = el("button", { class: "p2x-btn", type: "button" }, "Save");
    var bc = el("button", { class: "p2x-btn ghost", type: "button" }, "Close");
    [br, bt, bs, bc].forEach(function (b) { row.appendChild(b); }); body.appendChild(row);
    bc.addEventListener("click", function () { dlg.close(); });
    function fail(e) { msg.style.color = "#b91c1c"; msg.textContent = (e && e.message) || "Something went wrong."; }
    bt.addEventListener("click", function () {
      busy(true, "Testing the connection…");
      api("/admin/ai/test", payload()).then(function (r) {
        busy(false);
        if (r.ok) { msg.style.color = "#047857"; msg.textContent = "Connected. The engine answered in " + (r.ms || 0) + " ms."; }
        else { msg.style.color = "#b91c1c"; msg.textContent = "Not working: " + (r.error || "no answer") + (r.status ? " (" + r.status + ")" : ""); }
      }).catch(function (e) { busy(false); fail(e); });
    });
    bs.addEventListener("click", function () {
      busy(true, "Saving…");
      api("/admin/ai/save", payload()).then(function () { return load(); }).then(function () { build(); var m = dlg.querySelector(".p2x-msg"); if (m) { m.style.color = "#047857"; m.textContent = "Saved. All new assessments use this engine."; } })
        .catch(function (e) { busy(false); fail(e); });
    });
    br.addEventListener("click", function () {
      busy(true, "Resetting…");
      api("/admin/ai/reset", {}).then(function () { return load(); }).then(function () { build(); var m = dlg.querySelector(".p2x-msg"); if (m) { m.style.color = "#047857"; m.textContent = "Back to the platform default (Google Gemini)."; } })
        .catch(function (e) { busy(false); fail(e); });
    });
    dlg.appendChild(body);
  }
  function load() { return api("/admin/ai/info", {}).then(function (r) { S.info = r; S.providers = r.providers || []; S.cur = r.current || {}; }); }
  function open() {
    if (!dlg) { dlg = el("dialog", { class: "p2x-modal" }); document.body.appendChild(dlg); }
    dlg.textContent = ""; dlg.appendChild(el("div", { class: "p2x-body" }, "Loading…"));
    if (!dlg.open) dlg.showModal();
    load().then(build).catch(function (e) { dlg.textContent = ""; var b = el("div", { class: "p2x-body" }); b.appendChild(el("h3", null, "AI engine")); b.appendChild(el("p", { class: "p2x-note" }, (e && e.code === "forbidden") ? e.message : "Could not load the AI engine settings. Update the Worker and run supabase/ai_config.sql, then try again.")); var c = el("button", { class: "p2x-btn ghost", type: "button" }, "Close"); c.addEventListener("click", function () { dlg.close(); }); b.appendChild(c); dlg.appendChild(b); });
  }
  var st = document.createElement("style");
  st.textContent = ".p2x-body input[type=password]{padding:10px 12px;border:1px solid #d1d5db;border-radius:10px;font:14px system-ui,sans-serif;background:#fff;color:#1f2430;min-width:0}.p2x-modal{overflow-y:auto}";
  document.head.appendChild(st);
  window.__p2pEngine = { open: open };
})();
