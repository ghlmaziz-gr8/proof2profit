// Insights for staff: invitation tracker (who was invited, did they sign in, how often) and behaviour analytics (click heat map,
// time per section, where people leave). Data comes only from role-checked database functions.
(function () {
  "use strict";
  var sb = null, role = null, dlg = null, RM = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var NAMES = { home: "Search (home)", report: "Report", compare: "Compare setup", "compare-report": "Compare report", saved: "My Businesses", "saved-detail": "Business trend", analytics: "Analytics", loading: "Analysis loading", profile: "Profile", invitations: "Invitations", share: "Share by email", privacy: "Privacy notice" };
  var DEVICES = { d: "Desktop", t: "Tablet", m: "Mobile" };
  function nm(s) { return NAMES[s] || s; }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function fmtDate(iso) { try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); } catch (e) { return ""; } }
  function fmtDT(iso) { try { return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); } catch (e) { return ""; } }
  function ago(iso) { var s = (Date.now() - new Date(iso).getTime()) / 1000; if (s < 90) return "just now"; if (s < 5400) return Math.round(s / 60) + " min ago"; if (s < 129600) return Math.round(s / 3600) + " h ago"; return Math.round(s / 86400) + " d ago"; }
  function fmtSec(s) { s = Math.round(s); if (s < 60) return s + "s"; var m = Math.floor(s / 60); if (m < 60) return m + "m " + (s % 60) + "s"; return Math.floor(m / 60) + "h " + (m % 60) + "m"; }
  function initials(e) { var n = (e || "?").split("@")[0].replace(/[^a-z0-9]/gi, " ").trim().split(/\s+/); return ((n[0] || "?")[0] + ((n[1] || "")[0] || "")).toUpperCase(); }
  function hue(e) { var h = 0; for (var i = 0; i < e.length; i++) h = (h * 31 + e.charCodeAt(i)) % 360; return h; }
  function errText(r) { return (r && r.error && r.error.message) || "Something went wrong"; }
  function count(elm, to, dur) {
    if (RM) { elm.textContent = to.toLocaleString(); return; }
    var t0 = null; (function step(ts) { if (t0 == null) t0 = ts; var p = Math.min(1, (ts - t0) / (dur || 1100)); elm.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))).toLocaleString(); if (p < 1) requestAnimationFrame(step); })(performance.now());
  }
  function grow(bar, pct, delay) { bar.style.width = "0%"; setTimeout(function () { bar.style.width = pct + "%"; }, RM ? 0 : 60 + (delay || 0)); }

  var css = [
    ".p2i{width:min(860px,calc(100vw - 20px))!important;max-height:92vh}",
    ".p2i .p2x-body{max-height:92vh;overflow:auto}",
    ".p2i-tabs{display:flex;gap:6px;position:relative;z-index:2;margin-top:14px;flex-wrap:wrap}",
    ".p2i-tab{border:0;border-radius:99px;padding:8px 16px;font:700 13px 'Instrument Sans',sans-serif;background:rgba(255,255,255,.1);color:#E8E3D9;cursor:pointer;transition:background .2s,color .2s,transform .15s}",
    ".p2i-tab:hover{background:rgba(255,255,255,.2)}.p2i-tab.on{background:#F69500;color:#14161A}",
    ".p2i-pad{padding:20px 24px 26px;display:flex;flex-direction:column;gap:16px}",
    ".p2i-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}",
    ".p2i-kpi{background:#fff;border:1px solid #EFE9DE;border-radius:16px;padding:14px 15px;opacity:0;animation:p2xIn .5s cubic-bezier(.2,.8,.2,1) forwards;animation-delay:var(--d,0ms);position:relative;overflow:hidden}",
    ".p2i-kpi small{display:block;font:700 10.5px 'Instrument Sans',sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#8a857d}",
    ".p2i-kpi b{display:block;font:800 30px/1.1 'Bricolage Grotesque',sans-serif;color:#14161A;margin-top:3px}",
    ".p2i-kpi i{display:block;font-style:normal;font-size:12px;color:#6b665e;margin-top:2px}",
    ".p2i-kpi:before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--c,#F69500)}",
    ".p2i-ring{position:absolute;right:10px;top:10px;width:46px;height:46px}.p2i-ring svg{width:100%;height:100%;transform:rotate(-90deg)}",
    ".p2i-ring .t{fill:none;stroke:#F3EEE6;stroke-width:6}.p2i-ring .p{fill:none;stroke:#7FA10A;stroke-width:6;stroke-linecap:round;stroke-dasharray:113;stroke-dashoffset:113;transition:stroke-dashoffset 1.3s cubic-bezier(.2,.8,.2,1)}",
    ".p2i-card{background:#fff;border:1px solid #EFE9DE;border-radius:18px;padding:16px 18px}",
    ".p2i-card h5{margin:0 0 12px;font:800 15px 'Bricolage Grotesque',sans-serif;color:#14161A;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}",
    ".p2i-card h5 span{font:500 12px 'Instrument Sans',sans-serif;color:#8a857d}",
    ".p2i-bar{display:flex;align-items:center;gap:10px;margin-top:9px;font-size:13px}",
    ".p2i-bar b{flex:0 0 130px;font-weight:600;color:#14161A;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    ".p2i-bar .tr{flex:1;height:12px;border-radius:7px;background:#F3EEE6;overflow:hidden;min-width:0}",
    ".p2i-bar .tr i{display:block;height:100%;width:0;border-radius:7px;background:linear-gradient(90deg,var(--c1,#F69500),var(--c2,#FFB438));transition:width 1.1s cubic-bezier(.2,.8,.2,1)}",
    ".p2i-bar em{flex:0 0 78px;font-style:normal;text-align:right;color:#5E5A54;font-variant-numeric:tabular-nums}",
    "@media(max-width:560px){.p2i-bar b{flex-basis:96px}.p2i-bar em{flex-basis:62px}}",
    ".p2i-chips{display:flex;gap:7px;flex-wrap:wrap;align-items:center}",
    ".p2i-chip{border:1.5px solid #E6DFD3;background:#fff;color:#5E5A54;border-radius:99px;padding:6px 13px;font:700 12.5px 'Instrument Sans',sans-serif;cursor:pointer;transition:all .15s}",
    ".p2i-chip.on{background:#14161A;border-color:#14161A;color:#FFB438}",
    ".p2i-ctl{display:flex;gap:10px;flex-wrap:wrap;align-items:center}",
    ".p2i-ctl select,.p2i-ctl input{padding:8px 11px;border:1.5px solid #E6DFD3;border-radius:10px;font:500 13px 'Instrument Sans',sans-serif;background:#fff;color:#14161A;min-width:0}",
    ".p2i-ctl input{flex:1 1 160px}",
    ".p2i-row{display:flex;gap:12px;align-items:center;padding:12px;border:1px solid #EFE9DE;border-radius:14px;background:#fff;margin-top:8px;opacity:0;animation:p2xIn .4s forwards;animation-delay:var(--d,0ms);flex-wrap:wrap}",
    ".p2i-row .av{flex:0 0 40px;height:40px;border-radius:12px;font:800 14px/40px 'Bricolage Grotesque',sans-serif;text-align:center;color:#14161A}",
    ".p2i-row .in{flex:1 1 220px;min-width:0;overflow-wrap:anywhere}",
    ".p2i-row .in b{font-size:14px;font-weight:600}.p2i-row .in small{display:block;color:#6b665e;font-size:12px;margin-top:2px}",
    ".p2i-row.gone{opacity:.55!important}.p2i-row.gone .in b{text-decoration:line-through}",
    ".p2i-st{display:flex;gap:6px;flex-wrap:wrap;flex:0 1 auto}",
    ".p2i-pill{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:99px;font:700 11.5px 'Instrument Sans',sans-serif;background:#F3EEE6;color:#5E5A54;white-space:nowrap}",
    ".p2i-pill.ok{background:#EEF5D6;color:#51680a}.p2i-pill.wait{background:#FDEBCF;color:#8a4c00}.p2i-pill.bad{background:#FBE0DA;color:#a2301c}.p2i-pill.blue{background:#E3F3F8;color:#00708f}",
    ".p2i-pill:before{content:'';width:7px;height:7px;border-radius:50%;background:currentColor;opacity:.8}",
    ".p2i-heat{position:relative;border-radius:14px;overflow:hidden;background:#14161A;margin:0 auto;max-width:100%}",
    ".p2i-heat canvas{display:block;width:100%;height:auto}",
    ".p2i-legend{display:flex;align-items:center;gap:8px;font-size:11.5px;color:#6b665e;margin-top:10px}",
    ".p2i-legend i{flex:1;height:8px;border-radius:5px;background:linear-gradient(90deg,#1b2a9b,#00a2d6,#7FA10A,#FFD35A,#F69500,#E0522D)}",
    ".p2i-grid2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px}@media(max-width:760px){.p2i-grid2{grid-template-columns:minmax(0,1fr)}}",
    ".p2i-empty{text-align:center;color:#6b665e;padding:28px 12px;font-size:14px}",
    ".p2i-note{font-size:12px;color:#8a857d;margin:0}",
    ".p2i-insight{background:linear-gradient(135deg,#FFF6E6,#FDEBCF);border-radius:14px;padding:12px 15px;font-size:13.5px;color:#14161A;border-left:4px solid #F69500}"
  ].join("");
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  function shell(title, sub, tabs, onTab) {
    dlg.textContent = "";
    var body = el("div", "p2x-body");
    var hero = el("div", "p2x-hero"); hero.appendChild(el("div", "p2x-hgrid")); hero.firstChild.style.cssText = "position:absolute;inset:0";
    var t = el("div"); t.appendChild(el("small", null, "STAFF INSIGHTS")); var h3 = el("h3"); h3.appendChild(document.createTextNode(title + " ")); h3.appendChild(el("span", null, sub)); t.appendChild(h3);
    var tabsRow = el("div", "p2i-tabs"); var btns = {};
    tabs.forEach(function (tb) { var b = el("button", "p2i-tab", tb[1]); b.type = "button"; b.addEventListener("click", function () { onTab(tb[0]); }); btns[tb[0]] = b; tabsRow.appendChild(b); });
    t.appendChild(tabsRow); hero.appendChild(t);
    var x = el("button", "p2x-x", "×"); x.type = "button"; x.addEventListener("click", function () { dlg.close(); }); hero.appendChild(x);
    body.appendChild(hero);
    var pad = el("div", "p2i-pad"); body.appendChild(pad); dlg.appendChild(body);
    return { pad: pad, btns: btns };
  }

  // ---------------------------------------------------------------- invitations tab
  function renderInvites(ui) {
    var pad = ui.pad; pad.textContent = ""; pad.appendChild(el("div", "p2i-empty", "Loading invitations…"));
    sb.rpc("invite_tracker").then(function (r) {
      pad.textContent = "";
      if (r.error) { pad.appendChild(el("div", "p2i-empty", errText(r))); return; }
      var data = r.data || {}, sm = data.summary || {}, rows = data.rows || [];
      var total = sm.total || 0, acc = sm.accepted || 0, pend = sm.pending || 0;
      var delivered = rows.filter(function (x) { return x.email_status === "sent"; }).length;
      var rate = total ? Math.round(acc / total * 100) : 0;
      var kp = el("div", "p2i-kpis");
      function kpi(label, val, sub, color, i, ring, noCount) {
        var k = el("div", "p2i-kpi"); k.style.setProperty("--c", color); k.style.setProperty("--d", i * 70 + "ms");
        k.appendChild(el("small", null, label)); var b = el("b", null, "0"); k.appendChild(b); k.appendChild(el("i", null, sub));
        if (ring) { var w = el("div", "p2i-ring"); w.innerHTML = '<svg viewBox="0 0 44 44"><circle class="t" cx="22" cy="22" r="18"/><circle class="p" cx="22" cy="22" r="18"/></svg>'; k.appendChild(w); setTimeout(function () { w.querySelector(".p").style.strokeDashoffset = 113 * (1 - ring / 100); }, 120); }
        kp.appendChild(k); if (!noCount) count(b, val); return k;
      }
      kpi("Invitations sent", total, role === "sales" ? "by you" : "all time", "#F69500", 0);
      kpi("Signed in", acc, rate + "% acceptance", "#7FA10A", 1, rate);
      kpi("Waiting", pend, "not signed in yet", "#008CBB", 2);
      var avg = kpi("Avg time to join", 0, "after the invite", "#E0522D", 3, 0, true);
      var ab = avg.querySelector("b"); ab.textContent = sm.avg_hours_to_join == null ? "—" : (sm.avg_hours_to_join < 48 ? sm.avg_hours_to_join + " h" : Math.round(sm.avg_hours_to_join / 24) + " d");
      pad.appendChild(kp);

      var fc = el("div", "p2i-card"); fc.appendChild(el("h5", null, "Invitation funnel"));
      [["Invitations sent", total, total, "#F69500", "#FFB438"], ["Emails delivered", delivered, total, "#008CBB", "#3CC0E8"], ["Signed in", acc, total, "#7FA10A", "#AAD816"]].forEach(function (f, i) {
        var b = el("div", "p2i-bar"); b.appendChild(el("b", null, f[0])); var tr = el("div", "tr"), bar = el("i"); bar.style.setProperty("--c1", f[3]); bar.style.setProperty("--c2", f[4]); tr.appendChild(bar); b.appendChild(tr);
        b.appendChild(el("em", null, f[1] + (f[2] ? " · " + Math.round(f[1] / f[2] * 100) + "%" : ""))); fc.appendChild(b); grow(bar, f[2] ? f[1] / f[2] * 100 : 0, i * 140);
      });
      pad.appendChild(fc);

      var ctl = el("div", "p2i-ctl"); var q = el("input"); q.type = "search"; q.placeholder = "Search email or inviter"; ctl.appendChild(q);
      var chips = el("div", "p2i-chips"), filter = "all", cs = {};
      [["all", "All"], ["in", "Signed in"], ["wait", "Waiting"], ["gone", "Removed"]].forEach(function (c) { var b = el("button", "p2i-chip" + (c[0] === "all" ? " on" : ""), c[1]); b.type = "button"; b.addEventListener("click", function () { filter = c[0]; Object.keys(cs).forEach(function (k) { cs[k].classList.toggle("on", k === filter); }); draw(); }); cs[c[0]] = b; chips.appendChild(b); });
      ctl.appendChild(chips);
      var ex = el("button", "p2x-btn ghost sm", "Export CSV"); ex.type = "button"; ctl.appendChild(ex);
      pad.appendChild(ctl);
      var list = el("div"); pad.appendChild(list);
      ex.addEventListener("click", function () {
        var lines = [["email", "role", "invited_by", "sent_at", "email_status", "signed_in", "login_count", "last_login", "removed_at"]].concat(rows.map(function (x) { return [x.email, x.role, x.invited_by, x.sent_at, x.email_status || "", x.login_count > 0 ? "yes" : "no", x.login_count, x.last_login || "", x.removed_at || ""]; }));
        var csv = lines.map(function (l) { return l.map(function (c) { c = String(c == null ? "" : c); return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(","); }).join("\n");
        var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "proof-to-profit-invitations.csv"; document.body.appendChild(a); a.click(); a.remove();
      });
      function draw() {
        list.textContent = ""; var term = q.value.trim().toLowerCase(), n = 0;
        rows.forEach(function (x) {
          var state = x.removed_at ? "gone" : (x.login_count > 0 ? "in" : "wait");
          if (filter !== "all" && filter !== state) return;
          if (term && (x.email + " " + (x.invited_by || "")).toLowerCase().indexOf(term) < 0) return;
          var row = el("div", "p2i-row" + (state === "gone" ? " gone" : "")); row.style.setProperty("--d", Math.min(n, 10) * 45 + "ms"); n++;
          var av = el("span", "av", initials(x.email)); av.style.background = "hsl(" + hue(x.email) + ",78%,80%)"; row.appendChild(av);
          var inf = el("div", "in"), b = el("b", null, x.email); inf.appendChild(b); inf.appendChild(el("small", null, (x.role || "") + " · invited by " + (x.invited_by || "—") + " · " + fmtDT(x.sent_at) + (x.note ? " · “" + x.note + "”" : "")));
          row.appendChild(inf);
          var s = el("div", "p2i-st");
          var es = x.email_status === "sent" ? ["ok", "Email delivered"] : x.email_status === "failed" ? ["bad", "Email failed"] : x.email_status ? ["wait", "Email queued"] : ["", "No email"];
          var p1 = el("span", "p2i-pill " + es[0], es[1]); if (x.email_sent_at) p1.title = "Sent " + fmtDT(x.email_sent_at); s.appendChild(p1);
          if (x.removed_at) s.appendChild(el("span", "p2i-pill bad", "Removed " + fmtDate(x.removed_at)));
          else if (x.login_count > 0) { var p2 = el("span", "p2i-pill ok", "Signed in · " + x.login_count + (x.login_count === 1 ? " login" : " logins")); if (x.last_login) p2.title = "Last login " + fmtDT(x.last_login); s.appendChild(p2); if (x.last_login) s.appendChild(el("span", "p2i-pill blue", "Last " + ago(x.last_login))); }
          else s.appendChild(el("span", "p2i-pill wait", "Waiting " + ago(x.sent_at).replace(" ago", "")));
          row.appendChild(s); list.appendChild(row);
        });
        if (!n) list.appendChild(el("div", "p2i-empty", total ? "Nothing matches that filter." : "No invitations yet. Send your first one from Invitations."));
      }
      q.addEventListener("input", draw); draw();
      pad.appendChild(el("p", "p2i-note", "Logins count each new visit after 30 minutes away. People who signed in before tracking started show at least 1."));
    });
  }

  // ---------------------------------------------------------------- behaviour tab
  var PALETTE = (function () {
    var c = document.createElement("canvas"); c.width = 256; c.height = 1; var g = c.getContext("2d"), gr = g.createLinearGradient(0, 0, 256, 0);
    [[0, "rgba(27,42,155,0)"], [.12, "rgba(27,42,155,.55)"], [.3, "#00a2d6"], [.5, "#7FA10A"], [.7, "#FFD35A"], [.86, "#F69500"], [1, "#E0522D"]].forEach(function (s) { gr.addColorStop(s[0], s[1]); });
    g.fillStyle = gr; g.fillRect(0, 0, 256, 1); return g.getImageData(0, 0, 256, 1).data;
  })();

  function wire(ctx, W, H, dev) {
    ctx.fillStyle = "#1c1f25"; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(255,255,255,.08)"; ctx.lineWidth = 1;
    for (var gx = 0; gx < W; gx += W / 10) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
    for (var gy = 0; gy < H; gy += H / 10) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }
    function box(x, y, w, h, r, fill, label) {
      ctx.fillStyle = fill; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x * W, y * H, w * W, h * H, r); else ctx.rect(x * W, y * H, w * W, h * H); ctx.fill();
      if (label) { ctx.fillStyle = "rgba(255,255,255,.5)"; ctx.font = "600 " + Math.round(W / 46) + "px Inter,sans-serif"; ctx.fillText(label, x * W + 10, y * H + Math.round(W / 36) + 6); }
    }
    var r = Math.round(W / 60);
    if (dev === "d") {
      box(0, 0, 1, .07, 0, "rgba(255,255,255,.06)", "");
      box(.03, .12, .27, .38, r, "rgba(255,255,255,.08)", "Search & tabs"); box(.33, .12, .64, .22, r, "rgba(246,149,0,.18)", "Report header / welcome");
      box(.33, .37, .31, .33, r, "rgba(255,255,255,.07)", "Radar & aspect bars"); box(.67, .37, .3, .33, r, "rgba(255,255,255,.07)", "Loves, slips, next steps"); box(.33, .73, .64, .2, r, "rgba(255,255,255,.06)", "Outlook & campaigns");
    } else {
      box(0, 0, 1, .06, 0, "rgba(255,255,255,.06)", ""); box(.05, .09, .9, .12, r, "rgba(255,255,255,.08)", "Search"); box(.05, .24, .9, .2, r, "rgba(246,149,0,.18)", "Report header");
      box(.05, .47, .9, .22, r, "rgba(255,255,255,.07)", "Radar & bars"); box(.05, .72, .9, .15, r, "rgba(255,255,255,.06)", "Details"); box(0, .93, 1, .07, 0, "rgba(255,255,255,.1)", "Tab bar");
    }
  }
  function drawHeat(canvas, cells, dev, f) {
    var W = canvas.width, H = canvas.height, ctx = canvas.getContext("2d");
    wire(ctx, W, H, dev);
    if (!cells.length) return;
    var max = 0; cells.forEach(function (c) { if (c.n > max) max = c.n; });
    var off = document.createElement("canvas"); off.width = W; off.height = H; var o = off.getContext("2d");
    var rad = W * (dev === "d" ? 0.055 : 0.1);
    cells.forEach(function (c) {
      var x = (c.cx * 2 + 1) / 100 * W, y = (c.cy * 2 + 1) / 100 * H, a = Math.min(1, Math.pow(c.n / max, 0.55)) * f;
      var g = o.createRadialGradient(x, y, 0, x, y, rad); g.addColorStop(0, "rgba(0,0,0," + a + ")"); g.addColorStop(1, "rgba(0,0,0,0)");
      o.fillStyle = g; o.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    });
    var img = o.getImageData(0, 0, W, H), d = img.data;
    for (var i = 0; i < d.length; i += 4) {
      var a2 = d[i + 3]; if (!a2) continue; var p = Math.min(255, a2) * 4;
      d[i] = PALETTE[p]; d[i + 1] = PALETTE[p + 1]; d[i + 2] = PALETTE[p + 2]; d[i + 3] = Math.min(255, a2 * 1.15 + 20);
    }
    o.putImageData(img, 0, 0); ctx.drawImage(off, 0, 0);
  }

  function renderBehavior(ui) {
    var pad = ui.pad; pad.textContent = "";
    var state = { days: 30, email: "", dev: window.innerWidth >= 1024 ? "d" : "m", sec: "all" };
    var ctl = el("div", "p2i-ctl");
    var sd = el("select"); [[7, "Last 7 days"], [30, "Last 30 days"], [90, "Last 90 days"]].forEach(function (o) { var op = el("option", null, o[1]); op.value = o[0]; if (o[0] === 30) op.selected = true; sd.appendChild(op); });
    var su = el("select"); var o0 = el("option", null, "Everyone"); o0.value = ""; su.appendChild(o0);
    ctl.appendChild(sd); ctl.appendChild(su); pad.appendChild(ctl);
    var body = el("div", "p2i-pad"); body.style.padding = "0"; pad.appendChild(body);
    var usersLoaded = false;
    function load() {
      body.textContent = ""; body.appendChild(el("div", "p2i-empty", "Loading activity…"));
      sb.rpc("analytics_summary", { p_days: state.days, p_email: state.email || null }).then(function (r) {
        body.textContent = "";
        if (r.error) { body.appendChild(el("div", "p2i-empty", errText(r))); return; }
        var d = r.data || {}, k = d.kpi || {};
        if (!usersLoaded) { usersLoaded = true; (d.users || []).forEach(function (u) { var op = el("option", null, u); op.value = u; su.appendChild(op); }); }
        var kp = el("div", "p2i-kpis");
        [["Sessions", k.sessions || 0, "#F69500"], ["People", k.users || 0, "#008CBB"], ["Clicks", k.clicks || 0, "#7FA10A"], ["Avg session", k.avg_session_sec || 0, "#E0522D", true]].forEach(function (c, i) {
          var t = el("div", "p2i-kpi"); t.style.setProperty("--c", c[2]); t.style.setProperty("--d", i * 70 + "ms"); t.appendChild(el("small", null, c[0])); var b = el("b", null, "0"); t.appendChild(b);
          if (c[3]) b.textContent = fmtSec(c[1]); else count(b, c[1]); kp.appendChild(t);
        });
        body.appendChild(kp);
        if (!(k.sessions > 0)) { body.appendChild(el("div", "p2i-empty", "No activity recorded yet. This fills in as people use the portal; give it a little time.")); return; }

        // heat map
        var hc = el("div", "p2i-card"); var h5 = el("h5", null, "Click heat map"); h5.appendChild(el("span", null, "Hotter colors = more clicks")); hc.appendChild(h5);
        var chips = el("div", "p2i-chips"); chips.style.marginBottom = "12px";
        var devs = el("div", "p2i-chips"), dbtn = {};
        Object.keys(DEVICES).forEach(function (dv) { var b = el("button", "p2i-chip" + (dv === state.dev ? " on" : ""), DEVICES[dv]); b.type = "button"; b.addEventListener("click", function () { state.dev = dv; Object.keys(dbtn).forEach(function (x) { dbtn[x].classList.toggle("on", x === dv); }); paint(); }); dbtn[dv] = b; devs.appendChild(b); });
        hc.appendChild(devs);
        var secs = {}; (d.cells || []).forEach(function (c) { secs[c.section] = 1; });
        var sbtn = {}; var sc = el("div", "p2i-chips"); sc.style.margin = "10px 0 12px";
        ["all"].concat(Object.keys(secs)).forEach(function (s) { var b = el("button", "p2i-chip" + (s === state.sec ? " on" : ""), s === "all" ? "All sections" : nm(s)); b.type = "button"; b.addEventListener("click", function () { state.sec = s; Object.keys(sbtn).forEach(function (x) { sbtn[x].classList.toggle("on", x === s); }); paint(); }); sbtn[s] = b; sc.appendChild(b); });
        hc.appendChild(sc);
        var wrap = el("div", "p2i-heat"), cv = document.createElement("canvas"); wrap.appendChild(cv); hc.appendChild(wrap);
        var lg = el("div", "p2i-legend"); lg.appendChild(document.createTextNode("Fewer")); lg.appendChild(el("i")); lg.appendChild(document.createTextNode("More")); hc.appendChild(lg);
        var cnt = el("p", "p2i-note"); cnt.style.marginTop = "8px"; hc.appendChild(cnt);
        body.appendChild(hc);
        var raf = 0;
        function paint() {
          var dev = state.dev, sz = dev === "d" ? [800, 500] : dev === "t" ? [600, 760] : [320, 640];
          cv.width = sz[0]; cv.height = sz[1]; wrap.style.maxWidth = dev === "d" ? "100%" : dev === "t" ? "420px" : "260px";
          var agg = {}; var total = 0;
          (d.cells || []).forEach(function (c) { if (c.device !== dev) return; if (state.sec !== "all" && c.section !== state.sec) return; var key = c.cx + "_" + c.cy; agg[key] = agg[key] || { cx: c.cx, cy: c.cy, n: 0 }; agg[key].n += c.n; total += c.n; });
          var cells = Object.keys(agg).map(function (x) { return agg[x]; });
          cnt.textContent = total ? total + " clicks on " + DEVICES[dev].toLowerCase() + (state.sec === "all" ? "" : " in " + nm(state.sec)) + "." : "No " + DEVICES[dev].toLowerCase() + " clicks here yet.";
          cancelAnimationFrame(raf); var t0 = null;
          if (RM) { drawHeat(cv, cells, dev, 1); return; }
          (function step(ts) { if (t0 == null) t0 = ts; var f = Math.min(1, (ts - t0) / 900); drawHeat(cv, cells, dev, 1 - Math.pow(1 - f, 3)); if (f < 1) raf = requestAnimationFrame(step); })(performance.now());
        }
        paint();

        // top clicks
        var g2 = el("div", "p2i-grid2");
        var tc = el("div", "p2i-card"); tc.appendChild(el("h5", null, "Most clicked"));
        var tt = d.top_targets || [], tmax = tt.length ? tt[0].clicks : 1;
        tt.slice(0, 8).forEach(function (t, i) { var b = el("div", "p2i-bar"); b.appendChild(el("b", null, t.target)); var tr = el("div", "tr"), bar = el("i"); tr.appendChild(bar); b.appendChild(tr); b.appendChild(el("em", null, t.clicks + " · " + nm(t.section).split(" ")[0])); tc.appendChild(b); grow(bar, t.clicks / tmax * 100, i * 70); });
        if (!tt.length) tc.appendChild(el("div", "p2i-empty", "No clicks yet."));
        g2.appendChild(tc);
        var tm = el("div", "p2i-card"); tm.appendChild(el("h5", null, "Time spent per section"));
        var bs = d.by_section || [], totalS = bs.reduce(function (a, b) { return a + b.seconds; }, 0), bmax = bs.length ? bs[0].seconds : 1;
        bs.forEach(function (s, i) { var b = el("div", "p2i-bar"); b.appendChild(el("b", null, nm(s.section))); var tr = el("div", "tr"), bar = el("i"); bar.style.setProperty("--c1", "#008CBB"); bar.style.setProperty("--c2", "#3CC0E8"); tr.appendChild(bar); b.appendChild(tr); b.appendChild(el("em", null, fmtSec(s.seconds) + " · " + Math.round(s.seconds / (totalS || 1) * 100) + "%")); tm.appendChild(b); grow(bar, s.seconds / bmax * 100, i * 70); });
        if (!bs.length) tm.appendChild(el("div", "p2i-empty", "No time recorded yet."));
        g2.appendChild(tm); body.appendChild(g2);

        var ex = el("div", "p2i-card"); var eh = el("h5", null, "Where people leave"); eh.appendChild(el("span", null, "Last section before closing the portal or signing out")); ex.appendChild(eh);
        var xs = d.exits || [], xt = xs.reduce(function (a, b) { return a + b.n; }, 0), xmax = xs.length ? xs[0].n : 1;
        if (xs.length) { var ins = el("div", "p2i-insight"); ins.textContent = Math.round(xs[0].n / xt * 100) + "% of visits end in “" + nm(xs[0].section) + "”. That is the best place to look for friction or a missing next step."; ex.appendChild(ins); }
        xs.forEach(function (s, i) { var b = el("div", "p2i-bar"); b.appendChild(el("b", null, nm(s.section))); var tr = el("div", "tr"), bar = el("i"); bar.style.setProperty("--c1", "#E0522D"); bar.style.setProperty("--c2", "#F69500"); tr.appendChild(bar); b.appendChild(tr); b.appendChild(el("em", null, s.n + " · " + Math.round(s.n / xt * 100) + "%")); ex.appendChild(b); grow(bar, s.n / xmax * 100, i * 70); });
        if (!xs.length) ex.appendChild(el("div", "p2i-empty", "No exits recorded yet."));
        body.appendChild(ex);
        body.appendChild(el("p", "p2i-note", "Tracking records clicks (position and which control), time per section and exits. It never records what people type or the business names they search."));
      });
    }
    sd.addEventListener("change", function () { state.days = +sd.value; load(); });
    su.addEventListener("change", function () { state.email = su.value; load(); });
    load();
  }

  // ---------------------------------------------------------------- open
  function open(tab) {
    sb = window.__p2p && window.__p2p.sb; if (!sb) return;
    if (!dlg) { dlg = el("dialog", "p2x-modal p2x-rich p2i"); document.body.appendChild(dlg); }
    sb.rpc("my_role").then(function (r) {
      role = r.data && r.data.role; if (["super", "admin", "agency_admin", "sales"].indexOf(role) < 0) return;
      var tabs = [["invites", "Invitation tracker"]]; if (role === "super" || role === "admin" || role === "agency_admin") tabs.push(["behavior", "Behavior & heat map"]);
      var cur = (tab === "behavior" && tabs.length > 1) ? "behavior" : "invites";
      var ui;
      function go(t) { cur = t; ui = shell("Know what's happening on", "Proof to Profit", tabs, go); Object.keys(ui.btns).forEach(function (k) { ui.btns[k].classList.toggle("on", k === cur); }); if (cur === "invites") renderInvites(ui); else renderBehavior(ui); }
      go(cur); if (!dlg.open && dlg.showModal) dlg.showModal();
    });
  }
  window.__p2pInsights = { open: open };
})();
