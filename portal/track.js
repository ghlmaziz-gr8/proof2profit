// Usage tracking for the portal: sign-ins, where people click, time spent per section and where they leave.
// Privacy by design: it never reads typed text or field values and never records business names. See the privacy notice.
(function () {
  "use strict";
  var sb = null, cfg = window.P2P_CONFIG || {}, sid = "";
  try { sid = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)).slice(0, 36); } catch (e) { sid = String(Date.now()); }
  var queue = [], cur = null, curStart = 0, lastActive = Date.now(), lastSection = "home", started = false;

  function device() { var w = window.innerWidth; return w >= 1024 ? "d" : w >= 768 ? "t" : "m"; }
  function shown(id) { var e = document.getElementById(id); return !!e && e.style.display !== "none" && getComputedStyle(e).display !== "none"; }
  function section() {
    var d = document.querySelector("dialog[open]");
    if (d) { if (d.id === "privacyDlg") return "privacy"; if (d.className.indexOf("p2i") > -1) return "insights"; if (d.className.indexOf("p2x-rich") > -1) return "invitations"; return "profile"; }
    if (shown("analyticsSection") && document.getElementById("analyticsSection").classList.contains("active")) return "analytics";
    var saved = document.getElementById("savedSection");
    if (saved && saved.classList.contains("active")) return shown("savedDetailWrap") && document.getElementById("savedDetailWrap").innerHTML ? "saved-detail" : "saved";
    var cmp = document.getElementById("compareSection");
    var reportOn = shown("report");
    if (cmp && cmp.classList.contains("active")) return reportOn ? "compare-report" : "compare";
    if (shown("loadingState")) return "loading";
    return reportOn ? "report" : "home";
  }

  // short, anonymous label for what was clicked (no typed text, no business names)
  function label(el) {
    if (!el || !el.closest) return "page";
    var rules = [
      [".tab", function (n) { return "Tab: " + n.textContent.trim().slice(0, 24); }],
      ["#analyzeBtn", "Analyze button"], ["#compareBtn", "Compare button"], ["#urlInput,#urlInputA,#urlInputB", "Search box"],
      [".recent-item", "Recent search"], ["#saveBizBtn,.save-biz-btn", "Save business"], ["#recheckBtn", "Re-check button"],
      [".saved-row", "Saved business row"], [".back-link", "Back link"], [".aspect", "Aspect bar"], [".radar-wrap", "Radar chart"],
      [".trend-line-wrap", "Trend chart"], [".campaign-card", "Campaign idea"], [".enh-hero", "Report header"], [".step", "Next step"],
      [".chip", "Trend chip"], [".p2x-bell,.p2x-panel", "Notification bell"], ["#userChip", "Profile chip"], ["#signOutBtn", "Sign out"],
      ["#helpBtn", "Help"], [".privacy-foot,.open-privacy", "Privacy link"], [".p2x-rc", "Role card"], [".p2x-send", "Send invitation"],
      [".p2x-modal", "Dialog"], [".powered-by", "Powered by link"], [".enh-welcome", "Welcome panel"]
    ];
    for (var i = 0; i < rules.length; i++) {
      var n = el.closest(rules[i][0]);
      if (n) return typeof rules[i][1] === "function" ? rules[i][1](n) : rules[i][1];
    }
    var b = el.closest("button,a");
    if (b && !b.closest(".saved-row")) return ("Button: " + (b.textContent || "").trim().replace(/\s+/g, " ")).slice(0, 40);
    return "Background";
  }

  function push(ev) { ev.sid = sid; queue.push(ev); if (queue.length >= 20) flush(); }

  function closeView() {
    if (cur == null) return;
    var dur = Date.now() - curStart;
    if (dur > 400 && document.visibilityState === "visible") push({ kind: "view", section: cur, dur_ms: Math.min(dur, 600000) });
    curStart = Date.now();
  }
  function tick() {
    var s = section();
    if (cur == null) { cur = s; curStart = Date.now(); lastSection = s; return; }
    var idle = Date.now() - lastActive > 90000;
    if (s !== cur) { closeView(); cur = s; curStart = Date.now(); }
    else if (idle) { curStart = Date.now(); }
    else if (Date.now() - curStart > 15000) { closeView(); }
    lastSection = cur;
  }

  function flush(useBeacon) {
    if (!queue.length || !sb) return;
    var batch = queue.splice(0, 40);
    var sess = window.__p2p && window.__p2p.session && window.__p2p.session();
    if (useBeacon && sess && cfg.SUPABASE_URL) {
      try {
        fetch(cfg.SUPABASE_URL + "/rest/v1/rpc/track_events", {
          method: "POST", keepalive: true,
          headers: { "Content-Type": "application/json", apikey: cfg.SUPABASE_ANON_KEY, Authorization: "Bearer " + sess.access_token },
          body: JSON.stringify({ p_events: batch })
        });
      } catch (e) { }
      return;
    }
    sb.rpc("track_events", { p_events: batch }).then(function (r) { if (r && r.error) queue = queue.concat(batch).slice(-120); });
  }

  function onClick(e) {
    lastActive = Date.now();
    var doc = document.documentElement;
    var dh = Math.max(doc.scrollHeight, window.innerHeight);
    push({
      kind: "click", section: section(), target: label(e.target), device: device(),
      x: Math.round(e.clientX / window.innerWidth * 1000) / 10,
      y: Math.round((e.pageY || (e.clientY + window.scrollY)) / dh * 1000) / 10
    });
    if (e.target.closest && e.target.closest("#signOutBtn")) { closeView(); push({ kind: "exit", section: lastSection }); flush(true); exited = true; }
  }
  var exited = false;
  function onLeave() {
    if (exited) return; exited = true;
    closeView(); push({ kind: "exit", section: lastSection }); flush(true);
  }

  function start() {
    if (started) return; started = true;
    sb = window.__p2p.sb;
    sb.rpc("record_login").then(function () { });
    document.addEventListener("click", onClick, true);
    ["mousemove", "keydown", "scroll", "touchstart"].forEach(function (t) { document.addEventListener(t, function () { lastActive = Date.now(); }, { passive: true, capture: true }); });
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") { closeView(); flush(true); } else { curStart = Date.now(); exited = false; } });
    window.addEventListener("pagehide", onLeave);
    setInterval(tick, 1000); setInterval(function () { flush(); }, 12000);
    tick();
  }
  window.addEventListener("p2p:ready", start);
  if (window.__p2p && window.__p2p.ready) start();
})();
