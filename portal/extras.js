// Notifications bell + profile settings for the portal. Loaded after shim.js.
(function () {
  var sb, profile = null, notes = [], open = false, me = null;
  var ROLES = { super: "Super user", admin: "Admin", sales: "Sales", owner: "Business owner", member: "Team member" };
  var CAN_INVITE = { super: ["admin", "sales", "owner", "super"], admin: ["sales", "owner"], sales: ["owner"] };
  var KINDS = {
    welcome: "Welcome and access messages",
    limit: "Daily limit reached",
    weekly: "Weekly summary",
    alerts: "Saved-business change alerts",
  };

  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) { if (k === "class") e.className = attrs[k]; else e.setAttribute(k, attrs[k]); }
    if (text != null) e.textContent = text;
    return e;
  }

  var css = [
    ".p2x-bell{position:fixed;top:14px;right:64px;z-index:60;width:40px;height:40px;border-radius:50%;border:1px solid rgba(0,0,0,.12);background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.08);padding:0!important;background:#fff!important;color:#374151!important}",
    ".p2x-bell svg{width:20px;height:20px;stroke:#374151!important;fill:none!important;display:block;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}",
    ".p2x-badge{position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;border-radius:9px;background:#e11d48;color:#fff;font:700 11px/18px system-ui,sans-serif;text-align:center;padding:0 4px}",
    ".p2x-panel{position:fixed;top:62px;right:16px;z-index:61;width:min(360px,calc(100vw - 32px));max-height:70vh;overflow:auto;background:#fff;color:#1f2430;border-radius:16px;box-shadow:0 18px 50px rgba(0,0,0,.28);font:14px/1.45 system-ui,sans-serif}",
    ".p2x-head{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid #eef0f3;font-weight:700}",
    ".p2x-link{background:none;border:0;color:#b45309;cursor:pointer;font:600 12.5px system-ui,sans-serif;padding:0}",
    ".p2x-item{padding:12px 16px;border-bottom:1px solid #f3f4f6;cursor:pointer}",
    ".p2x-item.unread{background:#fff7ed}",
    ".p2x-item b{display:block;margin-bottom:2px}",
    ".p2x-item small{color:#6b7280}",
    ".p2x-empty{padding:26px 16px;text-align:center;color:#6b7280}",
    "#userChip{cursor:pointer}",
    ".p2x-modal{border:none;border-radius:18px;padding:0;width:min(460px,calc(100vw - 32px));max-height:88vh;box-shadow:0 24px 60px rgba(0,0,0,.35);color:#1f2430;font:14px/1.45 system-ui,sans-serif}",
    ".p2x-modal::backdrop{background:rgba(10,12,18,.55)}",
    ".p2x-body{padding:22px 24px;display:flex;flex-direction:column;gap:12px}",
    ".p2x-body h3{margin:0;font:700 20px 'Space Grotesk',system-ui,sans-serif}",
    ".p2x-body h4{margin:8px 0 0;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#6b7280}",
    ".p2x-body label{display:flex;flex-direction:column;gap:4px;font-weight:600;font-size:13px}",
    ".p2x-body input[type=text]{padding:10px 12px;border:1px solid #d1d5db;border-radius:10px;font:14px system-ui,sans-serif}",
    ".p2x-toggle{display:flex!important;flex-direction:row!important;align-items:center;gap:10px;font-weight:500!important}",
    ".p2x-row{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap}",
    ".p2x-btn{border:0;border-radius:10px;padding:10px 16px;font:600 14px system-ui,sans-serif;cursor:pointer;background:#f59e0b;color:#fff}",
    ".p2x-btn.ghost{background:#f3f4f6;color:#374151}",
    ".p2x-btn.danger{background:#dc2626}",
    ".p2x-note{color:#6b7280;font-size:12.5px;margin:0}",
    ".p2x-msg{font-size:13px;min-height:18px;margin:0}",
    ".p2x-wide{width:min(680px,calc(100vw - 32px))}",
    ".p2x-body input[type=email],.p2x-body select{padding:10px 12px;border:1px solid #d1d5db;border-radius:10px;font:14px system-ui,sans-serif;background:#fff;color:#1f2430;min-width:0}",
    ".p2x-form{display:flex;gap:8px;flex-wrap:wrap}.p2x-form>*{flex:1 1 150px}.p2x-form .p2x-btn{flex:0 0 auto}",
    ".p2x-li{display:flex;gap:8px;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid #f3f4f6;flex-wrap:wrap}",
    ".p2x-li>div{min-width:0;flex:1 1 200px;overflow-wrap:anywhere}",
    ".p2x-li small{display:block;color:#6b7280}",
    ".p2x-tag{display:inline-block;padding:1px 8px;border-radius:99px;background:#fef3c7;color:#92400e;font:600 11.5px system-ui,sans-serif;margin-left:6px}",
    ".p2x-btn.sm{padding:6px 11px;font-size:12.5px}"
  ].join("");
  var st = el("style"); st.textContent = css; document.head.appendChild(st);

  // ---------- bell ----------
  var bell = el("button", { class: "p2x-bell", type: "button", "aria-label": "Notifications", hidden: "" });
  bell.innerHTML = '<svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 01-3.4 0"/></svg>';
  var badge = el("span", { class: "p2x-badge", hidden: "" });
  bell.appendChild(badge);
  var panel = el("div", { class: "p2x-panel", hidden: "" });
  document.body.appendChild(bell); document.body.appendChild(panel);

  function ago(iso) {
    var s = Math.max(1, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 3600) return Math.round(s / 60) + " min ago";
    if (s < 86400) return Math.round(s / 3600) + " h ago";
    return Math.round(s / 86400) + " d ago";
  }

  function unread() { return notes.filter(function (n) { return !n.read_at; }).length; }

  function renderBell() {
    var u = unread();
    badge.hidden = !u; badge.textContent = u > 9 ? "9+" : String(u);
    panel.textContent = "";
    var head = el("div", { class: "p2x-head" });
    head.appendChild(el("span", null, "Notifications"));
    var mark = el("button", { class: "p2x-link", type: "button" }, "Mark all read");
    mark.addEventListener("click", markAll);
    head.appendChild(mark);
    panel.appendChild(head);
    if (!notes.length) panel.appendChild(el("div", { class: "p2x-empty" }, "You're all caught up."));
    notes.forEach(function (n) {
      var it = el("div", { class: "p2x-item" + (n.read_at ? "" : " unread") });
      it.appendChild(el("b", null, n.title));
      if (n.body) it.appendChild(el("div", null, n.body));
      it.appendChild(el("small", null, ago(n.created_at)));
      it.addEventListener("click", function () { markOne(n.id); });
      panel.appendChild(it);
    });
  }

  function load() {
    return sb.from("notifications").select("id,kind,title,body,read_at,created_at").order("created_at", { ascending: false }).limit(30)
      .then(function (r) { if (!r.error) { notes = r.data || []; renderBell(); } });
  }
  function markOne(id) {
    var n = notes.filter(function (x) { return x.id === id; })[0];
    if (!n || n.read_at) return;
    n.read_at = new Date().toISOString(); renderBell();
    sb.from("notifications").update({ read_at: n.read_at }).eq("id", id).then(function () {});
  }
  function markAll() {
    var ids = notes.filter(function (n) { return !n.read_at; }).map(function (n) { return n.id; });
    if (!ids.length) return;
    var t = new Date().toISOString();
    notes.forEach(function (n) { if (!n.read_at) n.read_at = t; });
    renderBell();
    sb.from("notifications").update({ read_at: t }).in("id", ids).then(function () {});
  }
  bell.addEventListener("click", function (e) {
    e.stopPropagation(); open = !open; panel.hidden = !open; if (open) load();
  });
  document.addEventListener("click", function (e) {
    if (open && !panel.contains(e.target) && e.target !== bell) { open = false; panel.hidden = true; }
  });

  // ---------- profile settings ----------
  var dlg = el("dialog", { class: "p2x-modal" });
  document.body.appendChild(dlg);

  function prefsOf() { return Object.assign({ welcome: true, limit: true, weekly: true, alerts: true, email: true }, (profile && profile.prefs) || {}); }

  function buildSettings() {
    dlg.textContent = "";
    var body = el("form", { class: "p2x-body", method: "dialog" });
    body.appendChild(el("h3", null, "Your profile"));
    var email = (window.__p2p && window.__p2p.session() && window.__p2p.session().user.email) || "";
    body.appendChild(el("p", { class: "p2x-note" }, "Signed in as " + email));

    if (me && me.role) {
      body.appendChild(el("p", { class: "p2x-note" }, "Your role: " + (ROLES[me.role] || me.role)));
      if (me.role !== "member") {
        var ab = el("button", { class: "p2x-btn ghost", type: "button" }, me.role === "owner" ? "My team" : "Invitations");
        ab.addEventListener("click", function () { dlg.close(); openAccess(); });
        body.appendChild(ab);
      }
      if (me.role === "super" || me.role === "admin" || me.role === "sales") {
        var tb = el("button", { class: "p2x-btn ghost", type: "button" }, "Invitation tracker");
        tb.addEventListener("click", function () { dlg.close(); if (window.__p2pInsights) window.__p2pInsights.open("invites"); });
        body.appendChild(tb);
      }
      if (me.role === "super" || me.role === "admin") {
        var hb = el("button", { class: "p2x-btn ghost", type: "button" }, "Behavior & heat map");
        hb.addEventListener("click", function () { dlg.close(); if (window.__p2pInsights) window.__p2pInsights.open("behavior"); });
        body.appendChild(hb);
        var eb = el("button", { class: "p2x-btn ghost", type: "button" }, "AI engine");
        eb.addEventListener("click", function () { dlg.close(); if (window.__p2pEngine) window.__p2pEngine.open(); });
        body.appendChild(eb);
      }
    }
    function field(label, key, ph) {
      var l = el("label", null, label);
      var i = el("input", { type: "text", maxlength: "80", placeholder: ph || "" });
      i.value = (profile && profile[key]) || "";
      i.dataset.key = key;
      l.appendChild(i); body.appendChild(l); return i;
    }
    var f1 = field("Display name", "display_name", "How we greet you");
    var f2 = field("Business name", "business_name", "Your business");
    var f3 = field("Default location", "default_location", "e.g. Jersey City, NJ");
    var f4 = field("Industry", "industry", "e.g. Restaurant, salon, retail");
    body.appendChild(el("p", { class: "p2x-note" }, "Your default location is added to plain business names when you analyze, so you can type just the name."));

    body.appendChild(el("h4", null, "Notifications"));
    var p = prefsOf(), checks = {};
    Object.keys(KINDS).forEach(function (k) {
      var l = el("label", { class: "p2x-toggle" });
      var c = el("input", { type: "checkbox" }); c.checked = p[k] !== false; checks[k] = c;
      l.appendChild(c); l.appendChild(el("span", null, KINDS[k]));
      body.appendChild(l);
    });
    var lm = el("label", { class: "p2x-toggle" });
    var cm = el("input", { type: "checkbox" }); cm.checked = p.email !== false;
    lm.appendChild(cm); lm.appendChild(el("span", null, "Also send these by email (when email is switched on)"));
    body.appendChild(lm);

    var msg = el("p", { class: "p2x-msg" });
    body.appendChild(msg);
    var row = el("div", { class: "p2x-row" });
    var cancel = el("button", { class: "p2x-btn ghost", type: "button" }, "Close");
    cancel.addEventListener("click", function () { dlg.close(); });
    var save = el("button", { class: "p2x-btn", type: "button" }, "Save");
    save.addEventListener("click", function () {
      var prefs = { email: cm.checked };
      Object.keys(checks).forEach(function (k) { prefs[k] = checks[k].checked; });
      var row_ = {
        user_id: window.__p2p.session().user.id,
        display_name: f1.value.trim() || null, business_name: f2.value.trim() || null,
        default_location: f3.value.trim() || null, industry: f4.value.trim() || null,
        prefs: prefs, updated_at: new Date().toISOString()
      };
      save.disabled = true; msg.style.color = "#6b7280"; msg.textContent = "Saving…";
      sb.from("profiles").upsert(row_, { onConflict: "user_id" }).then(function (r) {
        save.disabled = false;
        if (r.error) { msg.style.color = "#dc2626"; msg.textContent = "Couldn't save: " + r.error.message; return; }
        profile = row_; applyProfile();
        msg.style.color = "#15803d"; msg.textContent = "Saved.";
      });
    });
    row.appendChild(cancel); row.appendChild(save); body.appendChild(row);

    body.appendChild(el("h4", null, "Your data"));
    body.appendChild(el("p", { class: "p2x-note" }, "Delete your saved businesses, history, notifications and profile. Your login and invite stay, so you can start fresh. This can't be undone."));
    var conf = el("input", { type: "text", placeholder: "Type DELETE to confirm" });
    var del = el("button", { class: "p2x-btn danger", type: "button" }, "Delete my data");
    del.addEventListener("click", function () {
      if (conf.value.trim() !== "DELETE") { msg.style.color = "#dc2626"; msg.textContent = "Type DELETE in the box first."; return; }
      del.disabled = true; msg.style.color = "#6b7280"; msg.textContent = "Deleting…";
      sb.rpc("delete_my_data").then(function (r) {
        if (r.error) { del.disabled = false; msg.style.color = "#dc2626"; msg.textContent = "Couldn't delete: " + r.error.message; return; }
        location.reload();
      });
    });
    body.appendChild(conf);
    var r2 = el("div", { class: "p2x-row" }); r2.appendChild(del); body.appendChild(r2);
    dlg.appendChild(body);
  }


  // ---------- team & access (roles) ----------
  var adm = el("dialog", { class: "p2x-modal p2x-wide p2x-rich" });
  document.body.appendChild(adm);
  function errText(r) { return (r && r.error && r.error.message) || ""; }
  function isStaff() { return !!(me && CAN_INVITE[me.role]) && me.role !== "owner"; }
  function agoDay(iso) { try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); } catch (e) { return ""; } }
  var ROLE_INFO = {
    super: ["Super user", "Full control of everything", "M12 2l2.6 6.2L21 9l-5 4.4L17.5 20 12 16.6 6.5 20 8 13.4 3 9l6.4-.8z"],
    admin: ["Admin", "Manages sales and owners", "M12 3l8 3v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6z"],
    sales: ["Sales", "Brings in business owners", "M3 17l6-6 4 4 8-8M15 7h6v6"],
    owner: ["Business owner", "Analyzes and builds a team", "M4 10l1.5-5h13L20 10M5 10v9h14v-9M9 19v-5h6v5"],
    member: ["Team member", "Manager or marketing crew", "M16 11a4 4 0 10-8 0 4 4 0 008 0zM4 21c0-4 3.6-6 8-6s8 2 8 6"]
  };
  function svgIcon(d) {
    var s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("aria-hidden", "true");
    var p = document.createElementNS("http://www.w3.org/2000/svg", "path"); p.setAttribute("d", d); s.appendChild(p); return s;
  }
  function initials(email) { var n = (email || "?").split("@")[0].replace(/[^a-z0-9]/gi, " ").trim().split(/\s+/); return ((n[0] || "?")[0] + ((n[1] || "")[0] || "")).toUpperCase(); }
  function hue(email) { var h = 0; for (var i = 0; i < email.length; i++) h = (h * 31 + email.charCodeAt(i)) % 360; return h; }
  (function () {
    var l = document.createElement("link"); l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@700;800&family=Instrument+Sans:wght@500;600&display=swap";
    document.head.appendChild(l);
    var c = [
      ".p2x-rich{width:min(720px,calc(100vw - 24px));overflow:hidden;background:#FBF8F3;font-family:'Instrument Sans',system-ui,sans-serif}",
      ".p2x-rich .p2x-body{padding:0;gap:0}",
      ".p2x-hero{position:relative;overflow:hidden;background:#14161A;color:#F3EFE8;padding:26px 26px 22px;display:flex;gap:18px;align-items:center;justify-content:space-between;flex-wrap:wrap}",
      ".p2x-hero:before{content:'';position:absolute;width:340px;height:340px;left:-80px;top:-150px;border-radius:50%;background:radial-gradient(circle,rgba(246,149,0,.42),transparent 65%);animation:p2xDrift 9s ease-in-out infinite alternate}",
      ".p2x-hero:after{content:'';position:absolute;width:300px;height:300px;right:-90px;bottom:-170px;border-radius:50%;background:radial-gradient(circle,rgba(0,140,187,.38),transparent 65%);animation:p2xDrift 11s ease-in-out infinite alternate-reverse}",
      ".p2x-hgrid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px);background-size:26px 26px}",
      ".p2x-hero>div{position:relative;z-index:1}",
      ".p2x-hero small{display:block;font:600 10.5px 'Instrument Sans',sans-serif;letter-spacing:.16em;color:#FFB438;margin-bottom:8px}",
      ".p2x-hero h3{font:800 27px/1.05 'Bricolage Grotesque','Space Grotesk',sans-serif!important;letter-spacing:-.01em;margin:0}",
      ".p2x-hero h3 span{color:#F69500}",
      ".p2x-hero p{margin:8px 0 0;font-size:13.5px;color:#C9C4BA;max-width:360px}",
      ".p2x-mini{margin-top:22px;width:178px;background:#fff;border-radius:14px;padding:12px 13px;box-shadow:0 18px 34px -12px rgba(0,0,0,.65);animation:p2xFloat 5s ease-in-out infinite}",
      ".p2x-mini b{display:flex;justify-content:space-between;font:800 11px 'Bricolage Grotesque',sans-serif;color:#14161A}",
      ".p2x-mini i{display:block;height:6px;border-radius:3px;background:#F3EEE6;margin-top:7px;overflow:hidden}",
      ".p2x-mini i:after{content:'';display:block;height:100%;border-radius:3px;width:0;background:var(--c);animation:p2xBar 3.6s cubic-bezier(.2,.8,.2,1) infinite;animation-delay:var(--d)}",
      ".p2x-x{position:absolute;top:12px;right:12px;z-index:2;width:30px;height:30px;border-radius:50%;border:0;background:rgba(255,255,255,.12);color:#fff;cursor:pointer;font-size:17px;line-height:1;padding:0}",
      ".p2x-x:hover{background:rgba(255,255,255,.24)}",
      ".p2x-main{padding:20px 26px 8px;display:flex;flex-direction:column;gap:14px;max-height:calc(88vh - 150px);overflow:auto}",
      ".p2x-sec{font:700 11px 'Instrument Sans',sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#A85A00;margin:0}",
      ".p2x-roles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}",
      ".p2x-rc{position:relative;text-align:left;border:1.5px solid #E6DFD3;background:#fff;border-radius:14px;padding:12px 12px 11px;cursor:pointer;font:inherit;color:#14161A;transition:transform .18s,box-shadow .18s,border-color .18s;opacity:0;animation:p2xIn .45s cubic-bezier(.2,.8,.2,1) forwards;animation-delay:var(--d)}",
      ".p2x-rc:hover{transform:translateY(-2px);box-shadow:0 12px 24px -14px rgba(20,22,26,.4)}",
      ".p2x-rc svg{width:22px;height:22px;stroke:#A85A00;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;margin-bottom:6px;display:block;transition:transform .3s}",
      ".p2x-rc b{display:block;font:800 14px 'Bricolage Grotesque',sans-serif}",
      ".p2x-rc span{display:block;font-size:11.5px;color:#6b665e;margin-top:1px}",
      ".p2x-rc.on{border-color:#F69500;background:#FFF6E6;box-shadow:0 0 0 3px rgba(246,149,0,.2)}",
      ".p2x-rc.on svg{transform:scale(1.18) rotate(-6deg);stroke:#F69500}",
      ".p2x-rc.on:after{content:'\\2713';position:absolute;top:8px;right:9px;width:18px;height:18px;border-radius:50%;background:#F69500;color:#14161A;font:800 11px/18px sans-serif;text-align:center;animation:p2xPop .3s}",
      ".p2x-fields{display:grid;grid-template-columns:1fr 1fr;gap:10px}@media(max-width:560px){.p2x-fields{grid-template-columns:1fr}}",
      ".p2x-fields label{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:600;color:#5E5A54}",
      ".p2x-fields input{padding:12px 13px;border:1.5px solid #E6DFD3;border-radius:12px;font:500 14px 'Instrument Sans',sans-serif;background:#fff;color:#14161A;min-width:0;transition:border-color .15s,box-shadow .15s}",
      ".p2x-fields input:focus{outline:0;border-color:#008CBB;box-shadow:0 0 0 3px rgba(0,140,187,.18)}",
      ".p2x-fields textarea{padding:12px 13px;border:1.5px solid #E6DFD3;border-radius:12px;font:500 14px/1.45 'Instrument Sans',sans-serif;background:#fff;color:#14161A;min-width:0;resize:vertical;transition:border-color .15s,box-shadow .15s}",
      ".p2x-fields textarea:focus{outline:0;border-color:#008CBB;box-shadow:0 0 0 3px rgba(0,140,187,.18)}",
      ".p2x-note-field{grid-column:1/-1}",
      ".p2x-rich:focus,.p2x-rich *:focus-visible:not(input):not(textarea):not(select){outline:none}",
      ".p2x-tplrow{display:flex;gap:10px;align-items:flex-start;justify-content:space-between}",
      ".p2x-tpl{display:flex;gap:6px;flex-wrap:wrap;flex:1}",
      ".p2x-tplb{border:1.5px solid #E6DFD3;background:#fff;color:#5E5A54;border-radius:99px;padding:7px 12px;font:600 12px 'Instrument Sans',sans-serif;cursor:pointer;min-height:34px;text-align:left}",
      ".p2x-tplb:active{background:#FFF6E6;border-color:#F69500}",
      ".p2x-cnt{font:600 11.5px 'Instrument Sans',sans-serif;color:#8a857d;white-space:nowrap;padding-top:8px}",
      "@media (max-width:640px){",
      " .p2x-rich{width:100vw!important;max-width:100vw!important;height:100dvh;max-height:100dvh!important;margin:0!important;border-radius:0!important;top:0;left:0}",
      " .p2x-rich .p2x-body,.p2i .p2x-body{height:100dvh;max-height:100dvh!important;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}",
      " .p2x-main{max-height:none!important;overflow:visible!important;padding:16px 16px 6px}",
      " .p2x-listwrap{padding:8px 16px calc(24px + env(safe-area-inset-bottom))}",
      " .p2x-hero{padding:56px 18px 16px}",
      " .p2x-hero h3{font-size:22px!important}.p2x-hero p{font-size:12.5px}",
      " .p2x-hero>div:nth-child(3){display:none}",
      " .p2x-x{width:44px;height:44px;top:max(10px,env(safe-area-inset-top));right:10px;font-size:24px;background:rgba(255,255,255,.2)}",
      " .p2x-roles{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}",
      " .p2x-rc{padding:11px 10px;min-height:76px}.p2x-rc span{font-size:11px}",
      " .p2x-fields{grid-template-columns:minmax(0,1fr)}",
      " .p2x-fields input,.p2x-fields textarea{font-size:16px!important;padding:14px 14px}",
      " .p2x-fields input{min-height:52px}",
      " .p2x-send{position:sticky;bottom:calc(10px + env(safe-area-inset-bottom));z-index:6;min-height:58px;font-size:18px;box-shadow:0 14px 30px -10px rgba(246,149,0,.75),0 0 0 6px #FBF8F3}",
      " .p2x-prev{font-size:12.5px}",
      " .p2x-person{padding:10px}.p2x-person .p2x-row{width:100%;justify-content:flex-end}",
      " .p2x-btn.sm{padding:10px 14px;min-height:40px}",
      " .p2i-pad{padding:16px 16px calc(24px + env(safe-area-inset-bottom))}",
      " .p2i-tab{padding:11px 16px;min-height:44px}",
      " .p2i-chip{padding:9px 14px;min-height:40px}",
      "}",
      ".p2x-prev{display:flex;gap:11px;align-items:center;background:#14161A;color:#F3EFE8;border-radius:14px;padding:11px 14px;font-size:13px;min-width:0}",
      ".p2x-prev .av{flex:0 0 34px;height:34px;border-radius:10px;background:#F69500;color:#14161A;font:800 13px/34px 'Bricolage Grotesque',sans-serif;text-align:center}",
      ".p2x-prev div{min-width:0;overflow-wrap:anywhere}.p2x-prev em{font-style:normal;color:#FFB438;font-weight:600}",
      ".p2x-send{position:relative;overflow:hidden;border:0;border-radius:14px;padding:14px 20px;background:#F69500;color:#14161A;font:800 16px 'Bricolage Grotesque',sans-serif;cursor:pointer;display:flex;gap:9px;align-items:center;justify-content:center;transition:transform .15s,box-shadow .15s}",
      ".p2x-send:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 14px 26px -12px rgba(246,149,0,.8)}",
      ".p2x-send:disabled{opacity:.6;cursor:default}",
      ".p2x-send:before{content:'';position:absolute;inset:0;background:linear-gradient(100deg,transparent 30%,rgba(255,255,255,.5) 50%,transparent 70%);transform:translateX(-120%);animation:p2xShine 3.4s ease-in-out infinite}",
      ".p2x-send svg{width:19px;height:19px;stroke:#14161A;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;position:relative}",
      ".p2x-send.go svg{animation:p2xFly .7s ease-in forwards}",
      ".p2x-ok{display:none;text-align:center;padding:18px 8px 6px;position:relative}",
      ".p2x-ok.show{display:block;animation:p2xIn .4s forwards}",
      ".p2x-ok .ck{width:64px;height:64px;margin:0 auto 10px;border-radius:50%;background:#7FA10A;display:flex;align-items:center;justify-content:center;animation:p2xPop .5s}",
      ".p2x-ok .ck svg{width:34px;height:34px;stroke:#fff;fill:none;stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:30;stroke-dashoffset:30;animation:p2xDraw .5s .25s forwards}",
      ".p2x-ok h4{font:800 20px 'Bricolage Grotesque',sans-serif;margin:0;color:#14161A;text-transform:none;letter-spacing:0}",
      ".p2x-ok p{margin:4px 0 12px;color:#5E5A54;font-size:13.5px;overflow-wrap:anywhere}",
      ".p2x-conf{position:absolute;left:50%;top:30px;width:8px;height:12px;border-radius:2px;opacity:0;animation:p2xConf 1.1s ease-out forwards}",
      ".p2x-listwrap{padding:8px 26px 22px}",
      ".p2x-person{display:flex;gap:12px;align-items:center;padding:11px 12px;background:#fff;border:1px solid #EFE9DE;border-radius:14px;margin-top:8px;opacity:0;animation:p2xIn .4s forwards;animation-delay:var(--d);flex-wrap:wrap}",
      ".p2x-person .av{flex:0 0 38px;height:38px;border-radius:12px;font:800 14px/38px 'Bricolage Grotesque',sans-serif;text-align:center;color:#14161A}",
      ".p2x-person .info{flex:1 1 200px;min-width:0;overflow-wrap:anywhere}",
      ".p2x-person .info b{font-size:14px;color:#14161A;font-weight:600}",
      ".p2x-person .info small{display:flex;align-items:center;gap:6px;color:#6b665e;font-size:12px;margin-top:1px;flex-wrap:wrap}",
      ".p2x-dot{width:8px;height:8px;border-radius:50%;background:#C9C4BA;display:inline-block}.p2x-dot.on{background:#7FA10A;box-shadow:0 0 0 3px rgba(127,161,10,.2)}",
      ".p2x-pill{display:inline-block;padding:2px 9px;border-radius:99px;background:#FDEBCF;color:#8a4c00;font:700 10.5px 'Instrument Sans',sans-serif;letter-spacing:.04em;margin-left:6px;vertical-align:1px}",
      ".p2x-rich select{padding:7px 9px;border:1.5px solid #E6DFD3;border-radius:10px;font:500 12.5px 'Instrument Sans',sans-serif;background:#fff;color:#14161A}",
      ".p2x-msgx{font-size:13px;min-height:0;margin:0;color:#b91c1c;font-weight:600}",
      "@keyframes p2xIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}",
      "@keyframes p2xPop{0%{transform:scale(0)}70%{transform:scale(1.2)}100%{transform:scale(1)}}",
      "@keyframes p2xDraw{to{stroke-dashoffset:0}}",
      "@keyframes p2xBar{0%{width:0}35%,85%{width:var(--w)}100%{width:0}}",
      "@keyframes p2xFloat{0%,100%{transform:translateY(0) rotate(-1deg)}50%{transform:translateY(-7px) rotate(1deg)}}",
      "@keyframes p2xDrift{from{transform:translate(0,0)}to{transform:translate(50px,30px)}}",
      "@keyframes p2xShine{0%,55%{transform:translateX(-120%)}100%{transform:translateX(120%)}}",
      "@keyframes p2xFly{0%{transform:translate(0,0)}60%{transform:translate(40px,-14px);opacity:0}61%{transform:translate(-40px,12px);opacity:0}100%{transform:none;opacity:1}}",
      "@keyframes p2xConf{0%{opacity:1;transform:translate(0,0) rotate(0)}100%{opacity:0;transform:translate(var(--x),var(--y)) rotate(var(--r))}}",
      "@media (prefers-reduced-motion:reduce){.p2x-rich *,.p2x-rich *:before,.p2x-rich *:after{animation-duration:.001s!important;animation-iteration-count:1!important}}"
    ].join("");
    var st2 = document.createElement("style"); st2.textContent = c; document.head.appendChild(st2);
  })();

  function openAccess() {
    if (!me) return;
    var staff = isStaff(), owner = me.role === "owner";
    if (!staff && !owner) return;
    var roles = staff ? CAN_INVITE[me.role].slice() : ["member"];
    if (staff) roles.sort(function (a, b) { var o = ["owner", "sales", "admin", "super"]; return o.indexOf(a) - o.indexOf(b); });
    var chosen = staff ? (roles.indexOf("owner") > -1 ? "owner" : roles[0]) : "member";
    adm.textContent = "";
    var body = el("div", { class: "p2x-body" });

    var hero = el("div", { class: "p2x-hero" });
    hero.appendChild(el("div", { class: "p2x-hgrid", style: "position:absolute;inset:0" }));
    var ht = el("div");
    ht.appendChild(el("small", null, staff ? "INVITE-ONLY PLATFORM" : "YOUR TEAM"));
    var h3 = el("h3"); h3.appendChild(document.createTextNode(staff ? "Bring someone to " : ""));
    var sp = el("span", null, staff ? "Proof to Profit" : "Grow together"); h3.appendChild(sp); ht.appendChild(h3);
    ht.appendChild(el("p", null, staff
      ? "They get a beautiful invitation by email, then sign in with Google. " + (me.role === "sales" ? "You see everyone you invite." : "Only staff can see this list.")
      : "Add your managers and marketing crew. They get their own sign-in. Up to 5 people."));
    hero.appendChild(ht);
    var mini = el("div", { class: "p2x-mini" });
    [["Food", 88, "#7FA10A", "0s"], ["Service", 76, "#F69500", ".15s"], ["Value", 80, "#008CBB", ".3s"], ["Wait", 46, "#E0522D", ".45s"]].forEach(function (b) {
      var bb = el("b", null, b[0]); bb.appendChild(el("span", null, (b[1] / 20).toFixed(1)));
      mini.appendChild(bb); var i = el("i"); i.style.setProperty("--w", b[1] + "%"); i.style.setProperty("--c", b[2]); i.style.setProperty("--d", b[3]); mini.appendChild(i);
    });
    var wrapMini = el("div"); wrapMini.appendChild(mini); hero.appendChild(wrapMini);
    var x = el("button", { class: "p2x-x", type: "button", "aria-label": "Close" }, "×");
    x.addEventListener("click", function () { adm.close(); });
    hero.appendChild(x);
    body.appendChild(hero);

    var main = el("div", { class: "p2x-main" });
    var form = el("form");
    form.style.cssText = "display:flex;flex-direction:column;gap:14px";

    if (staff) {
      form.appendChild(el("p", { class: "p2x-sec" }, "1 · Choose a role"));
      var grid = el("div", { class: "p2x-roles" });
      var cards = {};
      roles.forEach(function (r, idx) {
        var c = el("button", { type: "button", class: "p2x-rc" + (r === chosen ? " on" : ""), "aria-pressed": r === chosen ? "true" : "false" });
        c.style.setProperty("--d", (idx * 70) + "ms");
        c.appendChild(svgIcon(ROLE_INFO[r][2]));
        c.appendChild(el("b", null, ROLE_INFO[r][0])); c.appendChild(el("span", null, ROLE_INFO[r][1]));
        c.addEventListener("click", function () {
          chosen = r; Object.keys(cards).forEach(function (k) { cards[k].classList.toggle("on", k === r); cards[k].setAttribute("aria-pressed", k === r ? "true" : "false"); }); preview();
        });
        cards[r] = c; grid.appendChild(c);
      });
      form.appendChild(grid);
    }
    form.appendChild(el("p", { class: "p2x-sec" }, staff ? "2 · Who is it for?" : "Who are you adding?"));
    var fields = el("div", { class: "p2x-fields" });
    var l1 = el("label", null, "Email address"); var em = el("input", { type: "email", inputmode: "email", placeholder: "name@company.com", required: "", maxlength: "120", autocomplete: "off", autocapitalize: "none", autocorrect: "off", spellcheck: "false", enterkeyhint: "next" }); l1.appendChild(em);
    var l2 = el("label", { class: "p2x-note-field" }, staff ? "Personal message (optional)" : "Job title (optional)");
    var note = staff
      ? el("textarea", { rows: "3", placeholder: "Write a short, friendly welcome\u2026", maxlength: "200", autocomplete: "off", enterkeyhint: "done" })
      : el("input", { type: "text", placeholder: "Manager, Marketing\u2026", maxlength: "60", autocomplete: "off", enterkeyhint: "done" });
    l2.appendChild(note);
    var count = function () { };
    if (staff) {
      var tpl = el("div", { class: "p2x-tpl" });
      ["Welcome aboard!", "Excited to have you on the platform.", "Here is your access. Tell me what you think!"].forEach(function (t) {
        var c = el("button", { type: "button", class: "p2x-tplb" }, t);
        c.addEventListener("click", function () { note.value = t; count(); preview(); note.focus(); });
        tpl.appendChild(c);
      });
      var cnt = el("span", { class: "p2x-cnt" }, "0/200");
      count = function () { cnt.textContent = note.value.length + "/200"; };
      note.addEventListener("input", function () { count(); preview(); });
      var meta = el("div", { class: "p2x-tplrow" }); meta.appendChild(tpl); meta.appendChild(cnt);
      l2.appendChild(meta);
    }
    em.addEventListener("focus", function () { setTimeout(function () { try { em.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (e) { } }, 250); });
    note.addEventListener("focus", function () { setTimeout(function () { try { note.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (e) { } }, 250); });
    fields.appendChild(l1); fields.appendChild(l2); form.appendChild(fields);

    var prev = el("div", { class: "p2x-prev" });
    var pav = el("span", { class: "av" }, "✉"); var ptx = el("div"); prev.appendChild(pav); prev.appendChild(ptx); form.appendChild(prev);
    function preview() {
      var v = em.value.trim(); pav.textContent = v ? initials(v) : "✉";
      ptx.textContent = "";
      ptx.appendChild(document.createTextNode(v ? v : "They"));
      ptx.appendChild(document.createTextNode(" will get an invitation as "));
      ptx.appendChild(el("em", null, ROLE_INFO[chosen][0])); ptx.appendChild(document.createTextNode(" with a button to sign in with Google."));
      if (staff && note.value.trim()) { var q = el("div", null, "\u201c" + note.value.trim().slice(0, 90) + (note.value.trim().length > 90 ? "\u2026" : "") + "\u201d"); q.style.cssText = "margin-top:4px;color:#C9C4BA;font-style:italic"; ptx.appendChild(q); }
    }
    em.addEventListener("input", preview); preview();

    var msg = el("p", { class: "p2x-msgx" }); form.appendChild(msg);
    var send = el("button", { class: "p2x-send", type: "submit" });
    send.appendChild(el("span", null, staff ? "Send invitation" : "Add to my team"));
    send.appendChild(svgIcon("M22 2L11 13M22 2l-7 20-4-9-9-4z"));
    form.appendChild(send);

    var ok = el("div", { class: "p2x-ok" });
    var ck = el("div", { class: "ck" }); ck.appendChild(svgIcon("M5 12.5l4.5 4.5L19 7.5")); ok.appendChild(ck);
    ok.appendChild(el("h4", null, "Invitation sent!")); var okp = el("p"); ok.appendChild(okp);
    var again = el("button", { class: "p2x-btn ghost", type: "button" }, "Invite another"); ok.appendChild(again);
    main.appendChild(form); main.appendChild(ok);
    body.appendChild(main);

    var lw = el("div", { class: "p2x-listwrap" });
    lw.appendChild(el("p", { class: "p2x-sec" }, staff ? "Invitations" : "My team"));
    var list = el("div"); lw.appendChild(list); body.appendChild(lw);
    adm.appendChild(body);

    function confetti() {
      var cols = ["#F69500", "#008CBB", "#7FA10A", "#FFB438", "#E0522D"];
      for (var i = 0; i < 26; i++) {
        var c = el("span", { class: "p2x-conf" });
        c.style.background = cols[i % cols.length];
        c.style.setProperty("--x", (Math.random() * 360 - 180) + "px"); c.style.setProperty("--y", (Math.random() * 150 - 40) + "px"); c.style.setProperty("--r", (Math.random() * 540 - 270) + "deg");
        c.style.animationDelay = (Math.random() * 120) + "ms"; ok.appendChild(c);
        setTimeout((function (n) { return function () { if (n.parentNode) n.parentNode.removeChild(n); }; })(c), 1500);
      }
    }
    again.addEventListener("click", function () { ok.classList.remove("show"); form.style.display = "flex"; em.value = ""; note.value = ""; count(); preview(); body.scrollTop = 0; em.focus(); });

    function render(items) {
      list.textContent = "";
      if (!items.length) { list.appendChild(el("p", { class: "p2x-note", style: "margin-top:8px" }, staff ? "No invitations yet. Your first one is a click away." : "No team members yet.")); return; }
      items.forEach(function (it, idx) {
        var row = el("div", { class: "p2x-person" }); row.style.setProperty("--d", Math.min(idx, 8) * 50 + "ms");
        var av = el("span", { class: "av" }, initials(it.email)); av.style.background = "hsl(" + hue(it.email) + ",78%,80%)"; row.appendChild(av);
        var info = el("div", { class: "info" });
        var top = el("b", null, it.email); top.appendChild(el("span", { class: "p2x-pill" }, (ROLE_INFO[it.role] || [it.role])[0])); info.appendChild(top);
        var sm = el("small"); sm.appendChild(el("span", { class: "p2x-dot" + (it.joined ? " on" : "") }));
        var bits = [it.joined ? "Signed in" : "Invitation pending"];
        if (it.title) bits.push(it.title);
        if (staff && it.invited_by) bits.push("by " + it.invited_by);
        bits.push(agoDay(it.added_at));
        sm.appendChild(document.createTextNode(bits.join(" · "))); info.appendChild(sm); row.appendChild(info);
        var acts = el("div", { class: "p2x-row", style: "flex:0 0 auto;align-items:center" });
        var self = it.email.toLowerCase() === me.email.toLowerCase();
        if (me.role === "super" && it.role !== "member" && !self) {
          var rs = el("select");
          ["admin", "sales", "owner", "super"].forEach(function (r) { rs.appendChild(el("option", { value: r }, ROLE_INFO[r][0])); });
          rs.value = it.role;
          rs.addEventListener("change", function () {
            sb.rpc("set_role", { p_email: it.email, p_role: rs.value }).then(function (r) {
              if (r.error) { msg.textContent = errText(r); rs.value = it.role; } else { msg.textContent = ""; refresh(); }
            });
          });
          acts.appendChild(rs);
        }
        if (!self) {
          var rm = el("button", { class: "p2x-btn danger sm", type: "button" }, "Remove"), armed = false;
          rm.addEventListener("click", function () {
            if (!armed) { armed = true; rm.textContent = "Click again to confirm"; setTimeout(function () { armed = false; rm.textContent = "Remove"; }, 4000); return; }
            sb.rpc(staff ? "remove_user" : "remove_team_member", { p_email: it.email }).then(function (r) {
              if (r.error) msg.textContent = errText(r); else { msg.textContent = ""; refresh(); }
            });
          });
          acts.appendChild(rm);
        }
        row.appendChild(acts); list.appendChild(row);
      });
    }
    function refresh() {
      sb.rpc(staff ? "list_invites" : "list_team").then(function (r) {
        if (r.error) { msg.textContent = errText(r); return; }
        render(r.data || []);
      });
    }
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      send.disabled = true; msg.textContent = ""; send.classList.add("go");
      var addr = em.value.trim();
      var call = staff
        ? sb.rpc("invite_user", { p_email: addr, p_role: chosen, p_note: note.value || null })
        : sb.rpc("invite_team_member", { p_email: addr, p_title: note.value || null });
      call.then(function (r) {
        send.disabled = false; send.classList.remove("go");
        if (r.error) { msg.textContent = errText(r); return; }
        okp.textContent = (r.data && r.data.existing) ? addr + " already has an account, so they are now on your team too. No email needed." : addr + " will get an email now, and can sign in with Google as " + ROLE_INFO[chosen][0] + ".";
        form.style.display = "none"; ok.classList.add("show"); confetti(); refresh();
      });
    });
    refresh();
    if (adm.showModal) adm.showModal();
    setTimeout(function () { body.scrollTop = 0; try { document.activeElement && document.activeElement.blur(); } catch (e) { } }, 30);
  }

  function openSettings() { buildSettings(); if (dlg.showModal) dlg.showModal(); }

  // ---------- applying the profile to the page ----------
  function applyProfile() {
    var emailEl = document.getElementById("userEmail");
    var s = window.__p2p && window.__p2p.session();
    if (emailEl && s) {
      var name = profile && profile.display_name;
      emailEl.textContent = name ? name : s.user.email;
      var chip = document.getElementById("userChip");
      if (chip) chip.title = s.user.email + " — click to edit your profile";
    }
  }

  function withLocation() {
    var input = document.getElementById("urlInput");
    var loc = profile && profile.default_location;
    if (!input || !loc) return;
    var v = input.value.trim();
    if (!v || /^https?:\/\//i.test(v) || /maps|goo\.gl/i.test(v) || v.indexOf(",") !== -1) return;
    input.value = v + ", " + loc;
  }

  function init() {
    sb = window.__p2p.sb;
    bell.hidden = false;
    var chip = document.getElementById("userChip");
    if (chip && !chip.dataset.p2x) {
      chip.dataset.p2x = "1";
      chip.addEventListener("click", function (e) {
        if (e.target && e.target.id === "signOutBtn") return;
        openSettings();
      });
    }
    var an = document.getElementById("analyzeBtn");
    if (an) an.addEventListener("click", withLocation, true);
    var inp = document.getElementById("urlInput");
    if (inp) inp.addEventListener("keydown", function (e) { if (e.key === "Enter") withLocation(); }, true);

    sb.rpc("my_role").then(function (r) { if (!r.error) me = r.data || null; });
    sb.from("profiles").select("*").maybeSingle().then(function (r) {
      profile = r.data || null; applyProfile();
    });
    load();
    setInterval(load, 60000);
  }

  var started = false;
  function start() { if (started) return; started = true; init(); }
  window.addEventListener("p2p:ready", start);
  if (window.__p2p && window.__p2p.ready) start();
  window.addEventListener("p2p:notify", load);
})();
