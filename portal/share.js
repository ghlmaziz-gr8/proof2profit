// "Share by email" for a single-business analysis or a two-business comparison.
// Sends only the structured report data to the share_report function; the email itself is built and escaped on the server.
(function () {
  "use strict";
  var dlg = null, state = null, recips = [];
  var KEY = "p2p_recent_recipients";

  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) { if (k === "class") e.className = attrs[k]; else e.setAttribute(k, attrs[k]); }
    if (text != null) e.textContent = text;
    return e;
  }
  function recent() { try { return JSON.parse(localStorage.getItem(KEY) || "[]").slice(0, 5); } catch (e) { return []; } }
  function remember(list) {
    try { var all = list.concat(recent().filter(function (x) { return list.indexOf(x) < 0; })).slice(0, 5); localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) { }
  }
  var EMAIL = /^[a-z0-9._%+'-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

  var css = [
    ".p2x-share-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:44px;padding:0 18px;border-radius:12px;border:1.5px solid rgba(232,148,58,.55)!important;background:transparent!important;color:#b45309!important;font:600 14px system-ui,sans-serif;cursor:pointer;transition:transform .15s,background .15s}",
    ".p2x-share-btn:hover{background:rgba(245,158,11,.12)!important;transform:translateY(-1px)}",
    ".p2s-top{display:flex;gap:12px;align-items:center;background:linear-gradient(135deg,#14161A,#2a2118);color:#fff;padding:18px 22px}",
    ".p2s-top .ic{width:42px;height:42px;border-radius:12px;background:#f59e0b;display:flex;align-items:center;justify-content:center;font-size:20px;flex:0 0 auto}",
    ".p2s-top b{display:block;font:700 17px 'Space Grotesk',system-ui,sans-serif}.p2s-top small{color:#c9c3b8;display:block;overflow-wrap:anywhere}",
    ".p2s-chips{display:flex;flex-wrap:wrap;gap:6px;padding:8px 10px;border:1px solid #d1d5db;border-radius:10px;background:#fff;cursor:text}",
    ".p2s-chips:focus-within{border-color:#f59e0b;box-shadow:0 0 0 3px rgba(245,158,11,.2)}",
    ".p2s-chip{display:inline-flex;align-items:center;align-self:center;height:auto;gap:6px;background:#fef3c7;color:#92400e;border-radius:99px;padding:4px 6px 4px 11px;font:600 13px system-ui,sans-serif;max-width:100%;overflow-wrap:anywhere}",
    ".p2s-chip button{border:0!important;background:rgba(146,64,14,.15)!important;color:#92400e!important;border-radius:50%!important;width:24px!important;height:24px!important;min-width:0!important;min-height:0!important;line-height:24px;padding:0!important;margin:0!important;cursor:pointer;font-size:15px;flex:0 0 auto}",
    ".p2s-chips input{flex:1 1 140px;min-width:120px;border:0!important;outline:0;padding:6px 2px!important;font:16px system-ui,sans-serif!important;background:transparent!important;box-shadow:none!important}",
    ".p2s-quick{display:flex;flex-wrap:wrap;gap:6px}",
    ".p2s-quick button{border:1px dashed #d1d5db;background:#fff;border-radius:99px;padding:6px 12px;font:13px system-ui,sans-serif;color:#374151;cursor:pointer;min-height:34px}",
    ".p2s-ta{width:100%;box-sizing:border-box;min-height:84px;padding:10px 12px;border:1px solid #d1d5db;border-radius:10px;font:16px/1.4 system-ui,sans-serif;resize:vertical;color:#1f2430;background:#fff}",
    ".p2s-cnt{font-weight:500;color:#6b7280;font-size:12px;align-self:flex-end}",
    ".p2s-ok{text-align:center;padding:34px 24px 26px;display:flex;flex-direction:column;align-items:center;gap:10px}",
    ".p2s-ok svg{width:74px;height:74px}.p2s-ok circle{stroke:#1F9D74;stroke-width:4;fill:none;stroke-dasharray:190;stroke-dashoffset:190;animation:p2sd .7s ease forwards}",
    ".p2s-ok path{stroke:#1F9D74;stroke-width:5;fill:none;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:50;stroke-dashoffset:50;animation:p2sd .45s .55s ease forwards}",
    "@keyframes p2sd{to{stroke-dashoffset:0}}",
    "@media(prefers-reduced-motion:reduce){.p2s-ok circle,.p2s-ok path{animation:none;stroke-dashoffset:0}}",
    "@media(max-width:640px){.p2s-modal{width:100vw!important;max-width:100vw!important;max-height:100dvh!important;height:100dvh;margin:0;border-radius:0!important}",
    ".p2s-modal .p2x-body{padding-bottom:96px}.p2s-send{position:fixed;left:0;right:0;bottom:0;z-index:5;min-height:58px;border-radius:0!important;font-size:16px!important;padding-bottom:env(safe-area-inset-bottom,0)}}"
  ].join("");
  var st = el("style"); st.textContent = css; document.head.appendChild(st);

  function slim(r) {
    if (!r) return null;
    var asp = (r.aspects || []).filter(function (a) { return a && a.name != null && a.score != null; }).slice(0, 12).map(function (a) { return { name: String(a.name).slice(0, 60), score: Number(a.score) }; });
    function strs(x, n) { return (x || []).slice(0, n).map(function (v) { return String(v).slice(0, 300); }); }
    return {
      name: String(r.name || "").slice(0, 80), address: String(r.address || "").slice(0, 120), rating: r.rating == null ? null : r.rating, review_count: r.review_count == null ? null : String(r.review_count),
      aspects: asp, likes: strs(r.likes, 6), dislikes: strs(r.dislikes, 6), suggestions: strs(r.suggestions, 6),
      seasonal_outlook: { guidance: String((r.seasonal_outlook && r.seasonal_outlook.guidance) || "").slice(0, 500) }
    };
  }

  function addFrom(input) {
    var parts = input.value.split(/[\s,;]+/).filter(Boolean), bad = [];
    parts.forEach(function (p) {
      p = p.toLowerCase();
      if (!EMAIL.test(p)) bad.push(p); else if (recips.indexOf(p) < 0 && recips.length < 5) recips.push(p);
    });
    input.value = bad.join(" ");
    return bad.length === 0;
  }

  function build() {
    var last = window.__p2pLast; if (!last) return;
    var isCmp = last.kind === "compare";
    var title = isCmp ? (last.a.name || "A") + " vs " + (last.b.name || "B") : (last.a.name || "this business");
    recips = [];
    if (!dlg) { dlg = el("dialog", { class: "p2x-modal p2s-modal" }); document.body.appendChild(dlg); dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); }); }
    dlg.innerHTML = "";
    var top = el("div", { class: "p2s-top" });
    top.appendChild(el("div", { class: "ic" }, "✉"));
    var tt = el("div"); tt.appendChild(el("b", null, isCmp ? "Share this comparison" : "Share this analysis")); tt.appendChild(el("small", null, title));
    top.appendChild(tt); dlg.appendChild(top);

    var body = el("div", { class: "p2x-body" });
    var l1 = el("label", null, "Send to"); var chips = el("div", { class: "p2s-chips" });
    var inp = el("input", { type: "email", inputmode: "email", autocomplete: "off", autocapitalize: "off", placeholder: "name@email.com", "aria-label": "Email address" });
    chips.appendChild(inp); l1.appendChild(chips); body.appendChild(l1);
    var msg = el("p", { class: "p2x-msg", role: "status" });

    function draw() {
      Array.prototype.slice.call(chips.querySelectorAll(".p2s-chip")).forEach(function (c) { c.remove(); });
      recips.forEach(function (r, i) {
        var c = el("span", { class: "p2s-chip" }); c.appendChild(document.createTextNode(r));
        var x = el("button", { type: "button", "aria-label": "Remove " + r }, "×"); x.addEventListener("click", function () { recips.splice(i, 1); draw(); });
        c.appendChild(x); chips.insertBefore(c, inp);
      });
      inp.placeholder = recips.length ? (recips.length >= 5 ? "" : "Add another") : "name@email.com";
      inp.disabled = recips.length >= 5;
    }
    chips.addEventListener("click", function () { inp.focus(); });
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === "," || e.key === " " || e.key === ";") { if (inp.value.trim()) { e.preventDefault(); if (!addFrom(inp)) msg.textContent = "That doesn't look like an email address."; else msg.textContent = ""; draw(); } else if (e.key === "Enter") e.preventDefault(); } else if (e.key === "Backspace" && !inp.value && recips.length) { recips.pop(); draw(); } });
    inp.addEventListener("blur", function () { if (inp.value.trim()) { addFrom(inp); draw(); } });
    inp.addEventListener("paste", function () { setTimeout(function () { addFrom(inp); draw(); }, 0); });

    var rc = recent();
    if (rc.length) {
      var q = el("div", { class: "p2s-quick" }); q.appendChild(el("span", { class: "p2x-note" }, "Recent:"));
      rc.forEach(function (r) { var b = el("button", { type: "button" }, r); b.addEventListener("click", function () { if (recips.indexOf(r) < 0 && recips.length < 5) recips.push(r); draw(); }); q.appendChild(b); });
      body.appendChild(q);
    }

    var l2 = el("label", null, "Add a note (optional)"); var cnt = el("span", { class: "p2s-cnt" }, "0 / 300");
    var ta = el("textarea", { class: "p2s-ta", maxlength: "300", placeholder: isCmp ? "Here's how the two stack up. Look at the verdict at the bottom." : "Thought you'd want to see this one." });
    ta.addEventListener("input", function () { cnt.textContent = ta.value.length + " / 300"; });
    l2.appendChild(ta); l2.appendChild(cnt); body.appendChild(l2);

    var l3 = el("label", { class: "p2x-toggle" }); var cp = el("input", { type: "checkbox" }); l3.appendChild(cp); l3.appendChild(document.createTextNode(" Send me a copy too")); body.appendChild(l3);
    body.appendChild(el("p", { class: "p2x-note" }, "They get a clean, read-only summary by email: scores, what guests love, where it slips" + (isCmp ? ", and the verdict." : ", and next steps.") + " They don't need an account. Up to 5 people at a time."));
    body.appendChild(msg);

    var row = el("div", { class: "p2x-row" });
    var cancel = el("button", { class: "p2x-btn ghost", type: "button" }, "Cancel"); cancel.addEventListener("click", function () { dlg.close(); });
    var send = el("button", { class: "p2x-btn p2s-send", type: "button" }, "Send email");
    row.appendChild(cancel); row.appendChild(send); body.appendChild(row); dlg.appendChild(body);
    draw();

    send.addEventListener("click", function () {
      if (inp.value.trim()) { if (!addFrom(inp)) { msg.style.color = "#b91c1c"; msg.textContent = "That doesn't look like an email address."; draw(); return; } draw(); }
      if (!recips.length) { msg.style.color = "#b91c1c"; msg.textContent = "Add at least one email address."; inp.focus(); return; }
      msg.textContent = ""; send.disabled = true; send.textContent = "Sending…";
      var sb = window.__p2p && window.__p2p.sb;
      if (!sb) { msg.style.color = "#b91c1c"; msg.textContent = "Not signed in."; send.disabled = false; send.textContent = "Send email"; return; }
      sb.rpc("share_report", { p_to: recips, p_note: ta.value.trim(), p_kind: last.kind, p_a: slim(last.a), p_b: isCmp ? slim(last.b) : null, p_copy: cp.checked }).then(function (r) {
        if (r.error) {
          var m = String(r.error.message || "");
          msg.style.color = "#b91c1c";
          msg.textContent = /limit/i.test(m) ? "Daily sharing limit reached. Try again tomorrow." : /bad email|at least one|up to 5/i.test(m) ? m.replace(/^.*?(bad email|Add at least|You can share)/i, "$1") : "Couldn't send. Please try again.";
          send.disabled = false; send.textContent = "Send email"; return;
        }
        remember(recips.slice());
        var n = recips.length;
        dlg.innerHTML = "";
        var ok = el("div", { class: "p2s-ok" });
        ok.innerHTML = '<svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="30"/><path d="M26 41l10 10 19-21"/></svg>';
        ok.appendChild(el("b", { style: "font:700 20px 'Space Grotesk',system-ui,sans-serif" }, "On its way"));
        ok.appendChild(el("p", { class: "p2x-note" }, "Sending to " + n + (n === 1 ? " person" : " people") + (cp.checked ? " plus a copy to you" : "") + ". It usually arrives within a few minutes."));
        var done = el("button", { class: "p2x-btn", type: "button" }, "Done"); done.addEventListener("click", function () { dlg.close(); });
        ok.appendChild(done); dlg.appendChild(ok);
      });
    });
    dlg.showModal();
    try { dlg.scrollTop = 0; } catch (e) { }
    setTimeout(function () { try { inp.focus({ preventScroll: true }); } catch (e) { } }, 60);
  }

  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-share]");
    if (b) build();
  });
  window.__p2pShare = { open: build };
})();
