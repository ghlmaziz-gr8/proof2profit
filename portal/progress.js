// Progress vs. degradation between assessments, and the past-assessments list for My Businesses.
(function () {
  "use strict";
  var TH = 5;               // aspect change (points) that counts as real movement
  var COL = { up: "#1F9D74", down: "#D9534F", flat: "#2F8FB5", mixed: "#C97A00" };

  function esc(t) { return String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function avgOf(asp) { asp = asp || []; return asp.length ? Math.round(asp.reduce(function (s, a) { return s + (Number(a.score) || 0); }, 0) / asp.length) : null; }
  function dstr(ts, long) { return new Date(ts).toLocaleDateString("default", long ? { month: "long", day: "numeric", year: "numeric" } : { month: "short", day: "numeric", year: "numeric" }); }
  function sc(s) { return s >= 75 ? "var(--good,#1F9D74)" : s >= 50 ? "var(--gold,#E0A21B)" : "var(--warn,#D9534F)"; }

  // Same theme worded differently by the AI: compare by shared meaningful words.
  function words(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(function (w) { return w.length > 3; }); }
  function same(a, b) {
    var A = words(a), B = words(b); if (!A.length || !B.length) return a === b;
    var set = {}; A.forEach(function (w) { set[w] = 1; });
    var n = 0; B.forEach(function (w) { if (set[w]) n++; });
    return n / Math.min(A.length, B.length) >= 0.5;
  }
  function onlyIn(x, y) { return (x || []).filter(function (i) { return !(y || []).some(function (j) { return same(i, j); }); }); }

  function compare(prev, cur) {
    var pm = {}, cm = {}, names = [];
    (cur.aspects || []).forEach(function (a) { cm[a.name] = Number(a.score); names.push(a.name); });
    (prev.aspects || []).forEach(function (a) { pm[a.name] = Number(a.score); if (names.indexOf(a.name) < 0) names.push(a.name); });
    var rows = names.map(function (n) {
      var p = pm[n], c = cm[n], d = (p != null && c != null) ? c - p : null;
      return { name: n, prev: p == null ? null : p, cur: c == null ? null : c, delta: d, dir: d == null ? (c == null ? "gone" : "new") : d >= TH ? "up" : d <= -TH ? "down" : "flat" };
    });
    var ap = prev.avgScore != null ? prev.avgScore : avgOf(prev.aspects), ac = cur.avgScore != null ? cur.avgScore : avgOf(cur.aspects);
    var avgD = (ap != null && ac != null) ? ac - ap : null;
    var rD = (typeof prev.rating === "number" && typeof cur.rating === "number") ? Math.round((cur.rating - prev.rating) * 10) / 10 : null;
    var ups = rows.filter(function (r) { return r.dir === "up"; }).sort(function (a, b) { return b.delta - a.delta; });
    var downs = rows.filter(function (r) { return r.dir === "down"; }).sort(function (a, b) { return a.delta - b.delta; });
    var verdict = avgD == null ? "flat" : avgD >= 3 ? "up" : avgD <= -3 ? "down" : (ups.length && downs.length) ? "mixed" : "flat";
    var head = { up: "Progress", down: "Degradation", mixed: "Mixed results", flat: "Holding steady" }[verdict];
    var s = [];
    if (avgD != null) s.push(avgD === 0 ? "The average score is unchanged at " + ac + "." : "The average score moved " + (avgD > 0 ? "up " : "down ") + Math.abs(avgD) + " points (" + ap + " to " + ac + ").");
    if (rD) s.push("The star rating is " + (rD > 0 ? "up " : "down ") + Math.abs(rD) + " (" + prev.rating + " to " + cur.rating + ").");
    if (ups.length) s.push("Biggest gain: " + ups[0].name + " (+" + ups[0].delta + ").");
    if (downs.length) s.push((verdict === "down" ? "Biggest drop: " : "Watch: ") + downs[0].name + " (" + downs[0].delta + ").");
    if (!ups.length && !downs.length && avgD != null) s.push("No topic moved by " + TH + " points or more.");
    return {
      verdict: verdict, head: head, avgPrev: ap, avgCur: ac, avgDelta: avgD, ratingDelta: rD, rows: rows, ups: ups, downs: downs, summary: s.join(" "),
      newConcerns: onlyIn(cur.dislikes, prev.dislikes), goneConcerns: onlyIn(prev.dislikes, cur.dislikes),
      newStrengths: onlyIn(cur.likes, prev.likes), lostStrengths: onlyIn(prev.likes, cur.likes),
      fromTs: prev.ts, toTs: cur.ts
    };
  }

  var css = [
    ".p2p-pg{border-radius:16px;border:1px solid var(--line,#e6dfd3);background:#fff;overflow:hidden;margin:14px 0}",
    ".p2p-pg-h{display:flex;flex-wrap:wrap;gap:12px 14px;align-items:center;padding:16px 18px;color:#fff}.p2p-pg-h>div:not(.p2p-pg-arrow):not(.p2p-pg-big){flex:1 1 180px;min-width:0}.p2p-banner{margin:6px 0 22px}.p2p-banner .p2p-pg{margin:0}",
    ".p2p-pg-arrow{width:46px;height:46px;border-radius:14px;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;flex:0 0 auto}",
    ".p2p-pg-h b{display:block;font:700 18px 'Space Grotesk',system-ui,sans-serif}.p2p-pg-h small{opacity:.9;display:block}",
    ".p2p-pg-big{margin-left:auto;font:700 26px 'Space Grotesk',system-ui,sans-serif;white-space:nowrap}",
    ".p2p-pg-b{padding:16px 18px;display:flex;flex-direction:column;gap:12px;color:#1f2430}",
    ".p2p-pg-sum{margin:0;font-size:14px;line-height:1.5}",
    ".p2p-ar{display:grid;grid-template-columns:minmax(80px,28%) 1fr auto;gap:10px;align-items:center;font-size:13px}",
    ".p2p-ar span.n{overflow-wrap:anywhere}",
    ".p2p-trk{position:relative;height:10px;border-radius:6px;background:#ece5d9}",
    ".p2p-trk i{position:absolute;left:0;top:0;bottom:0;border-radius:6px;width:0;transition:width .9s cubic-bezier(.2,.8,.2,1)}",
    ".p2p-trk u{position:absolute;top:-3px;bottom:-3px;width:2px;background:#14161A;opacity:.55;border-radius:2px}",
    ".p2p-chip{display:inline-block;min-width:54px;text-align:center;padding:2px 8px;border-radius:99px;font:700 12px system-ui,sans-serif;color:#fff}",
    ".p2p-lg{font-size:11.5px;color:#7a756c;margin:0}",
    ".p2p-tl{font-size:12px;letter-spacing:.08em;text-transform:uppercase;font-weight:700;margin:2px 0 4px}",
    ".p2p-tl.g{color:#0b6b54}.p2p-tl.r{color:#b4442f}",
    ".p2p-ul{margin:0;padding-left:18px;font-size:13.5px;line-height:1.5}",
    ".p2p-sel{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:13px;margin-top:12px}",
    ".p2p-sel select{padding:9px 10px;border:1px solid #d1d5db;border-radius:10px;font:15px system-ui,sans-serif;background:#fff;color:#1f2430;max-width:100%;min-height:40px}",
    ".p2p-ck{border:1px solid var(--line,#e6dfd3);border-radius:14px;margin-bottom:8px;background:#fff;overflow:hidden}",
    ".p2p-ck>button{all:unset;box-sizing:border-box;width:100%;display:flex;gap:10px;align-items:center;padding:12px 14px;cursor:pointer;min-height:48px}",
    ".p2p-ck>button:focus-visible{outline:2px solid #f59e0b;outline-offset:-2px}",
    ".p2p-ck .d{font-weight:700;font-size:14px;flex:1 1 auto;min-width:0}.p2p-ck .d small{display:block;font-weight:500;color:#7a756c}",
    ".p2p-ck .av{font-weight:700;font-size:15px;white-space:nowrap}.p2p-ck .car{color:#7a756c;transition:transform .2s}",
    ".p2p-ck.open .car{transform:rotate(90deg)}",
    ".p2p-ck .bd{display:none;padding:0 14px 14px;flex-direction:column;gap:10px}.p2p-ck.open .bd{display:flex}",
    ".p2p-bar{display:grid;grid-template-columns:minmax(80px,30%) 1fr 34px;gap:10px;align-items:center;font-size:13px}",
    ".p2p-bar .t{height:8px;border-radius:5px;background:#ece5d9;overflow:hidden}.p2p-bar .t i{display:block;height:100%;border-radius:5px}",
    ".p2p-pb{display:flex;gap:10px;align-items:flex-start;border-radius:14px;padding:12px 14px;margin-bottom:12px;color:#1f2430;border:1px solid}",
    ".p2p-pb .ar{font-size:22px;font-weight:700;line-height:1}",
    "@media(prefers-reduced-motion:reduce){.p2p-trk i{transition:none}}"
  ].join("");
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  function chip(r) {
    if (r.dir === "new") return '<span class="p2p-chip" style="background:#7a756c">NEW</span>';
    if (r.dir === "gone") return '<span class="p2p-chip" style="background:#7a756c">DROPPED</span>';
    var c = COL[r.dir], t = r.delta > 0 ? "▲ +" + r.delta : r.delta < 0 ? "▼ " + String(r.delta).replace("-", "−") : "● 0";
    return '<span class="p2p-chip" style="background:' + c + '">' + t + "</span>";
  }
  function list(title, cls, arr) {
    if (!arr || !arr.length) return "";
    return '<div><p class="p2p-tl ' + cls + '">' + esc(title) + '</p><ul class="p2p-ul">' + arr.slice(0, 4).map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></div>";
  }

  // The progress card.
  function card(c, o) {
    o = o || {};
    var col = COL[c.verdict], arrow = c.verdict === "up" ? "▲" : c.verdict === "down" ? "▼" : c.verdict === "mixed" ? "⇅" : "●";
    var big = c.avgDelta == null ? "" : (c.avgDelta > 0 ? "+" : c.avgDelta < 0 ? "−" : "") + Math.abs(c.avgDelta);
    var rows = c.rows.map(function (r) {
      var cur = r.cur == null ? 0 : r.cur;
      return '<div class="p2p-ar"><span class="n">' + esc(r.name) + '</span><div class="p2p-trk"><i data-w="' + cur + '" style="background:' + (r.cur == null ? "#bbb" : sc(r.cur)) + '"></i>' + (r.prev != null ? '<u style="left:calc(' + Math.min(99, r.prev) + '% - 1px)" title="Before: ' + r.prev + '"></u>' : "") + "</div>" + chip(r) + "</div>";
    }).join("");
    return '<div class="p2p-pg"><div class="p2p-pg-h" style="background:' + col + '"><div class="p2p-pg-arrow">' + arrow + "</div><div><b>" + esc(o.title || c.head) + "</b><small>" + esc(o.sub || ("Compared with " + dstr(c.fromTs))) + "</small></div>" + (big ? '<div class="p2p-pg-big">' + big + "<small style=\"font-size:12px;display:block;text-align:right;font-weight:600\">avg points</small></div>" : "") + "</div>" +
      '<div class="p2p-pg-b"><p class="p2p-pg-sum"><b style="color:' + col + '">' + esc(c.head) + ".</b> " + esc(c.summary) + "</p>" + rows +
      '<p class="p2p-lg">Bar = now · dark tick = before · a topic counts as moved at ' + TH + "+ points.</p>" +
      list("New concerns showing up", "r", c.newConcerns) + list("No longer coming up", "g", c.goneConcerns) + list("New strengths", "g", c.newStrengths) + list("Strengths that faded", "r", c.lostStrengths) + "</div></div>";
  }
  function animate(root) {
    requestAnimationFrame(function () { requestAnimationFrame(function () { Array.prototype.forEach.call(root.querySelectorAll(".p2p-trk i[data-w]"), function (i) { i.style.width = i.getAttribute("data-w") + "%"; }); }); });
  }

  function checkinBody(h) {
    var b = (h.aspects || []).map(function (a) { return '<div class="p2p-bar"><span>' + esc(a.name) + '</span><div class="t"><i style="width:' + a.score + "%;background:" + sc(a.score) + '"></i></div><b>' + a.score + "</b></div>"; }).join("");
    return b + list("What guests loved", "g", h.likes) + list("Where it slipped", "r", h.dislikes) + ((h.suggestions && h.suggestions.length) ? list("Suggested next steps", "", h.suggestions) : "");
  }

  // My Businesses detail: baseline selector + progress card + expandable past assessments.
  function mountSaved(history, progMount, histMount) {
    var n = history.length;
    function draw(baseIdx) {
      progMount.innerHTML = "";
      if (n < 2) { progMount.innerHTML = '<div class="p2p-pb" style="background:#fff7e6;border-color:#f3d9ac"><span class="ar">ℹ</span><div>This is your first assessment. Re-check later and this section will show whether things are improving or slipping.</div></div>'; return; }
      var wrap = document.createElement("div");
      var sel = document.createElement("div"); sel.className = "p2p-sel";
      sel.innerHTML = '<label for="p2pBase" style="font-weight:600">Compare latest with</label>';
      var s = document.createElement("select"); s.id = "p2pBase";
      for (var i = n - 2; i >= 0; i--) { var op = document.createElement("option"); op.value = i; op.textContent = (i === n - 2 ? "Previous assessment · " : i === 0 ? "First assessment · " : "") + dstr(history[i].ts); s.appendChild(op); }
      s.value = baseIdx; sel.appendChild(s); wrap.appendChild(sel);
      var holder = document.createElement("div"); holder.innerHTML = card(compare(history[baseIdx], history[n - 1]), { sub: "Latest " + dstr(history[n - 1].ts) + " vs " + dstr(history[baseIdx].ts) });
      wrap.appendChild(holder); progMount.appendChild(wrap); animate(holder);
      s.addEventListener("change", function () { draw(Number(s.value)); });
      window.__p2pSavedView = { baseIdx: baseIdx };
    }
    draw(n - 2 >= 0 ? n - 2 : 0);

    histMount.innerHTML = "";
    history.slice().reverse().forEach(function (h, k) {
      var idx = n - 1 - k, prev = idx > 0 ? history[idx - 1] : null, d = null;
      if (prev && h.avgScore != null && prev.avgScore != null) d = h.avgScore - prev.avgScore;
      var el = document.createElement("div"); el.className = "p2p-ck";
      var tag = d == null ? "" : '<span class="p2p-chip" style="background:' + (d >= 3 ? COL.up : d <= -3 ? COL.down : COL.flat) + '">' + (d > 0 ? "▲ +" + d : d < 0 ? "▼ " + String(d).replace("-", "−") : "● 0") + "</span>";
      el.innerHTML = '<button type="button" aria-expanded="false"><span class="d">' + dstr(h.ts) + "<small>" + (idx === n - 1 ? "Latest" : idx === 0 ? "First assessment" : "Assessment " + (idx + 1)) + '</small></span><span class="av">avg ' + (h.avgScore == null ? "—" : h.avgScore) + " · " + (h.rating == null ? "—" : h.rating) + "/5</span>" + tag + '<span class="car">›</span></button><div class="bd">' + checkinBody(h) + '<button type="button" class="p2p-open" data-idx="' + idx + '" style="margin-top:10px;width:100%">View this full assessment</button></div>';
      var btn = el.querySelector("button");
      var ob = el.querySelector(".p2p-open"); if (ob) ob.addEventListener("click", function () { if (window.__p2pOpenSaved) window.__p2pOpenSaved(idx); });
      btn.addEventListener("click", function () { var o = el.classList.toggle("open"); btn.setAttribute("aria-expanded", o ? "true" : "false"); });
      histMount.appendChild(el);
    });
  }

  // Banner shown above a fresh analysis of a business you already track.
  function reportBanner(data, slugify, getJSON) {
    try {
      return getJSON("reviewlens_hist_" + slugify(data.name), []).then(function (hist) {
        if (!hist || !hist.length) return "";
        var last = hist[hist.length - 1];
        var cur = { ts: Date.now(), rating: data.rating == null ? null : data.rating, avgScore: avgOf(data.aspects), aspects: data.aspects || [], likes: data.likes || [], dislikes: data.dislikes || [] };
        var c = compare(last, cur);
        return '<div class="p2p-banner">' + card(c, { title: c.head + " since your last assessment", sub: (new Date(last.ts).toDateString() === new Date().toDateString() ? "Compared with your assessment from earlier today, so little change is expected. " : "Compared with " + dstr(last.ts) + ". ") + "This one is saved automatically." }) + "</div>";
      });
    } catch (e) { return Promise.resolve(""); }
  }

  window.__p2pProgress = { compare: compare, card: card, animate: animate, mountSaved: mountSaved, reportBanner: reportBanner, avgOf: avgOf, esc: esc, same: same };
})();
