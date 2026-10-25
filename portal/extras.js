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
  var adm = el("dialog", { class: "p2x-modal p2x-wide" });
  document.body.appendChild(adm);
  function errText(r) { return (r && r.error && r.error.message) || ""; }
  function isStaff() { return !!(me && CAN_INVITE[me.role]) && me.role !== "owner"; }
  function agoDay(iso) { try { return new Date(iso).toLocaleDateString(); } catch (e) { return ""; } }

  function openAccess() {
    if (!me) return;
    var staff = isStaff(), owner = me.role === "owner";
    if (!staff && !owner) return;
    adm.textContent = "";
    var body = el("div", { class: "p2x-body" });
    body.appendChild(el("h3", null, staff ? "Invitations" : "My team"));
    body.appendChild(el("p", { class: "p2x-note" }, staff
      ? (me.role === "sales" ? "Invite business owners to Proof to Profit. You see the people you invited." : "Invite people to Proof to Profit. Only staff can see this list.")
      : "Add the managers and marketing people who work with you. They get their own sign-in. You can have up to 5."));
    var form = el("form", { class: "p2x-form" });
    var em = el("input", { type: "email", placeholder: "email@example.com", required: "", maxlength: "120" });
    form.appendChild(em);
    var sel = null, note = null;
    if (staff) {
      sel = el("select");
      CAN_INVITE[me.role].forEach(function (r) { var o = el("option", { value: r }, ROLES[r]); sel.appendChild(o); });
      if (me.role === "super" || me.role === "admin") sel.value = "owner";
      form.appendChild(sel);
    }
    note = el("input", { type: "text", placeholder: staff ? "Note (optional)" : "Title, e.g. Manager", maxlength: "60" });
    form.appendChild(note);
    var add = el("button", { class: "p2x-btn", type: "submit" }, staff ? "Invite" : "Add");
    form.appendChild(add);
    body.appendChild(form);
    var msg = el("p", { class: "p2x-msg" });
    body.appendChild(msg);
    var list = el("div");
    body.appendChild(list);
    var row = el("div", { class: "p2x-row" });
    var close = el("button", { class: "p2x-btn ghost", type: "button" }, "Close");
    close.addEventListener("click", function () { adm.close(); });
    row.appendChild(close); body.appendChild(row);
    adm.appendChild(body);

    function say(t, bad) { msg.textContent = t || ""; msg.style.color = bad ? "#b91c1c" : "#047857"; }
    function render(items) {
      list.textContent = "";
      if (!items.length) { list.appendChild(el("p", { class: "p2x-note" }, staff ? "No invitations yet." : "No team members yet.")); return; }
      items.forEach(function (it) {
        var li = el("div", { class: "p2x-li" });
        var info = el("div");
        var top = el("span", null, it.email);
        top.appendChild(el("span", { class: "p2x-tag" }, ROLES[it.role] || it.role));
        info.appendChild(top);
        var bits = [it.joined ? "Signed in" : "Not signed in yet"];
        if (it.title) bits.push(it.title);
        if (it.note) bits.push(it.note);
        if (staff && it.invited_by) bits.push("invited by " + it.invited_by);
        bits.push(agoDay(it.added_at));
        info.appendChild(el("small", null, bits.join(" · ")));
        li.appendChild(info);
        var acts = el("div", { class: "p2x-row", style: "flex:0 0 auto" });
        if (me.role === "super" && it.role !== "member" && it.email.toLowerCase() !== me.email.toLowerCase()) {
          var rs = el("select");
          ["admin", "sales", "owner", "super"].forEach(function (r) { rs.appendChild(el("option", { value: r }, ROLES[r])); });
          rs.value = it.role;
          rs.addEventListener("change", function () {
            sb.rpc("set_role", { p_email: it.email, p_role: rs.value }).then(function (r) {
              if (r.error) { say(errText(r), true); rs.value = it.role; } else { say("Role updated."); refresh(); }
            });
          });
          acts.appendChild(rs);
        }
        if (it.email.toLowerCase() !== me.email.toLowerCase()) {
          var rm = el("button", { class: "p2x-btn danger sm", type: "button" }, "Remove");
          var armed = false;
          rm.addEventListener("click", function () {
            if (!armed) { armed = true; rm.textContent = "Click again to confirm"; setTimeout(function () { armed = false; rm.textContent = "Remove"; }, 4000); return; }
            sb.rpc(staff ? "remove_user" : "remove_team_member", { p_email: it.email }).then(function (r) {
              if (r.error) say(errText(r), true); else { say("Removed."); refresh(); }
            });
          });
          acts.appendChild(rm);
        }
        li.appendChild(acts); list.appendChild(li);
      });
    }
    function refresh() {
      sb.rpc(staff ? "list_invites" : "list_team").then(function (r) {
        if (r.error) { say(errText(r), true); return; }
        render(r.data || []);
      });
    }
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      add.disabled = true; say("");
      var call = staff
        ? sb.rpc("invite_user", { p_email: em.value, p_role: sel.value, p_note: note.value || null })
        : sb.rpc("invite_team_member", { p_email: em.value, p_title: note.value || null });
      call.then(function (r) {
        add.disabled = false;
        if (r.error) { say(errText(r), true); return; }
        say("Invited. They will get an email with the sign-in link.");
        em.value = ""; note.value = ""; refresh();
      });
    });
    refresh();
    if (adm.showModal) adm.showModal();
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
