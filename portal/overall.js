/* Overall business health: one score from reviews (50%), website SEO (25%) and social media (25%).
   Missing parts are left out and the weights re-balanced, and the card says so. */
(function () {
  "use strict";
  var RM = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var W = { reviews: 50, website: 25, social: 25 };
  function esc(t) { return String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function col(v) { return v >= 75 ? "#1D9E75" : v >= 55 ? "#F69500" : "#C24A34"; }
  function lab(v) { return v >= 85 ? "Strongest" : v >= 70 ? "Strong" : v >= 50 ? "Mixed" : "Needs attention"; }
  function num(v) { v = Number(v); return isFinite(v) ? v : null; }

  function compute(a, seo, soc) {
    var parts = [], asp = ((a && a.aspects) || []).map(function (x) { return num(x.score); }).filter(function (v) { return v != null; });
    var base = asp.length ? asp.reduce(function (s, v) { return s + v; }, 0) / asp.length : null, rt = a && a.rating != null && !isNaN(Number(a.rating)) ? Number(a.rating) * 20 : null;
    var rev = base == null ? rt : rt == null ? base : (base + rt) / 2;
    if (rev != null) parts.push({ key: "reviews", name: "Reviews", score: Math.round(rev), weight: W.reviews, note: rt != null && base != null ? "AI aspect scores blended with the star rating" : "Average of the AI aspect scores" });
    var ss = seo && num(seo.score); if (ss != null) parts.push({ key: "website", name: "Website SEO", score: Math.round(ss), weight: W.website, note: String(seo.url || "") });
    var ps = ((soc && soc.profiles) || []).filter(function (p) { return p && p.report && num(p.report.score) != null; });
    if (ps.length) parts.push({ key: "social", name: "Social media", score: Math.round(ps.reduce(function (s, p) { return s + p.report.score; }, 0) / ps.length), weight: W.social, note: ps.length + " profile" + (ps.length === 1 ? "" : "s") });
    if (!parts.length) return null;
    var tw = parts.reduce(function (s, p) { return s + p.weight; }, 0);
    var score = Math.round(parts.reduce(function (s, p) { return s + p.score * p.weight; }, 0) / tw);
    parts.forEach(function (p) { p.share = Math.round(p.weight / tw * 100); });
    var weak = parts.slice().sort(function (x, y) { return x.score - y.score; })[0];
    var gain = weak && weak.score < 80 ? Math.round((80 - weak.score) * weak.weight / tw) : 0;
    return { score: score, parts: parts, missing: ["reviews", "website", "social"].filter(function (k) { return !parts.some(function (p) { return p.key === k; }); }), weak: weak, gain: gain, complete: parts.length === 3 };
  }

  var css = [
    ".ov{border:1px solid var(--line,#e6dfd3);border-radius:18px;padding:18px;margin:14px 0;background:#fff;box-shadow:0 10px 30px -22px rgba(20,22,26,.5)}",
    ".ov-top{display:flex;gap:18px;align-items:center;flex-wrap:wrap}",
    ".ov-ring{position:relative;flex:0 0 auto;width:118px;height:118px;border:0;background:none;padding:0;min-height:0;cursor:pointer;color:var(--ink,#1f2430)}.ov-ring:hover{background:none;color:inherit}",
    ".ov-ring svg{display:block}.ov-ring .arc{transition:stroke-dashoffset 1.4s cubic-bezier(.2,.8,.2,1)}",
    ".ov-ring .n{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1}.ov-ring b{font:700 34px 'Space Grotesk',sans-serif;font-variant-numeric:tabular-nums}.ov-ring small{font-size:11px;color:#8a8f98;margin-top:3px}",
    ".ov-h{flex:1 1 220px;min-width:0}.ov-eye{margin:0;font:700 12px 'Space Grotesk',sans-serif;text-transform:uppercase;letter-spacing:.1em;color:#C97A00}.ov-h h3{margin:3px 0 4px;font:700 20px 'Space Grotesk',sans-serif}.ov-v{margin:0;font-size:13.5px;color:#5b5b5b;line-height:1.45}",
    ".ov-rows{display:grid;gap:10px;margin-top:16px}",
    ".ov-row{display:grid;grid-template-columns:minmax(96px,150px) 1fr 38px;gap:10px;align-items:center;font-size:13.5px}.ov-row .t{height:9px;border-radius:6px;background:#ece5d9;overflow:hidden}.ov-row .t i{display:block;height:100%;border-radius:6px;transform-origin:left;animation:ovbar 1.1s .2s cubic-bezier(.2,.8,.2,1) both}",
    ".ov-row b{font-variant-numeric:tabular-nums;text-align:right}.ov-row span em{display:block;font-style:normal;font-size:11px;color:#8a8f98}",
    ".ov-todo{grid-column:2/4;justify-self:start;background:#FEF3E2;color:#a8641a;border:0;border-radius:999px;padding:6px 14px;font:600 12.5px system-ui,sans-serif;min-height:0;width:auto;cursor:pointer}.ov-todo:hover{background:#fde2b8;color:#7a4a10}",
    ".ov-tip{margin:14px 0 0;background:#FEF3E2;color:#7a4a10;border-radius:10px;padding:10px 12px;font-size:13px;line-height:1.45}",
    "@keyframes ovbar{from{transform:scaleX(0)}to{transform:scaleX(1)}}",
    "@media(prefers-reduced-motion:reduce){.ov-row .t i{animation:none}.ov-ring .arc{transition:none}}"
  ].join("");
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  function html(c) {
    var R = 50, circ = 2 * Math.PI * R, off = circ * (1 - c.score / 100);
    var rows = c.parts.map(function (p) { return '<div class="ov-row"><span>' + esc(p.name) + '<em>' + p.weight + '% of the full score</em></span><div class="t"><i style="width:' + p.score + '%;background:' + col(p.score) + '"></i></div><b style="color:' + col(p.score) + '">' + p.score + "</b></div>"; }).join("");
    var todo = { reviews: ["Reviews", "Analyze this business"], website: ["Website SEO", "Run the SEO check"], social: ["Social media", "Assess a social profile"] };
    rows += c.missing.filter(function (k) { return k !== "reviews"; }).map(function (k) { return '<div class="ov-row"><span>' + todo[k][0] + '<em>' + W[k] + '% of the full score</em></span><div class="t"></div><b style="color:#b9b4aa">–</b><button type="button" class="ov-todo" data-go="' + k + '">' + todo[k][1] + " to complete this</button></div>"; }).join("");
    var tip = c.weak && c.gain > 0 ? '<p class="ov-tip">🎯 <b>Biggest opening: ' + esc(c.weak.name) + " (" + c.weak.score + ").</b> Getting it to 80 would lift the overall score by about " + c.gain + " point" + (c.gain === 1 ? "" : "s") + ".</p>" : "";
    return '<div class="ov-top"><button type="button" class="ov-ring" data-k="ov" aria-label="How the overall score is calculated"><svg viewBox="0 0 120 120" width="118" height="118"><circle cx="60" cy="60" r="' + R + '" fill="none" stroke="currentColor" stroke-opacity=".12" stroke-width="10"/><circle class="arc" cx="60" cy="60" r="' + R + '" fill="none" stroke="' + col(c.score) + '" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + circ.toFixed(1) + '" stroke-dashoffset="' + circ.toFixed(1) + '" data-off="' + off.toFixed(1) + '" transform="rotate(-90 60 60)"/></svg><span class="n"><b data-count="' + c.score + '">' + (RM ? c.score : 0) + "</b><small>/100</small></span></button>" +
      '<div class="ov-h"><p class="ov-eye">Overall business health</p><h3>' + lab(c.score) + '</h3><p class="ov-v">' + (c.complete ? "Reviews, website and social media combined." : "Provisional: based on " + c.parts.length + " of 3 areas. Complete the rest for the full picture.") + "</p></div></div>" +
      '<div class="ov-rows">' + rows + "</div>" + tip;
  }
  function explain(c) {
    var ex = window.__p2pExplain; if (!ex) return;
    ex("Overall business health: " + c.score + " out of 100",
      "<p><b>What it means:</b> one number for how strong this business looks to customers online, across what they say, how findable the website is and how the social accounts perform.</p>" +
      "<p><b>How it is built:</b> Reviews " + W.reviews + "%, Website SEO " + W.website + "%, Social media " + W.social + "%. " + (c.complete ? "" : "Areas not yet checked are left out and the weights re-balanced, so this is provisional. ") + "</p>" +
      "<ul>" + c.parts.map(function (p) { return "<li><b>" + esc(p.name) + ":</b> " + p.score + " (counts " + p.weight + "%)" + (p.note ? ", " + esc(p.note) : "") + "</li>"; }).join("") + "</ul>" +
      "<p class='ex-note'>An AI-assisted estimate to show where to focus, not an audit.</p>");
  }

  var last = "", busy = false, timer = 0;
  function kv(k) { var g = window.storageGetJSON; return typeof g === "function" ? g(k, null).catch(function () { return null; }) : Promise.resolve(null); }
  function refresh(force) {
    var rep = document.getElementById("report"), L = window.__p2pLast;
    if (!rep || !L || L.kind !== "single" || !L.a || typeof window.slugify !== "function") return;
    var hero = rep.querySelector(".enh-hero"); if (!hero) return;
    if (busy) return; busy = true;
    var sg = window.slugify(L.a.name);
    Promise.all([kv("reviewlens_seo_" + sg), kv("reviewlens_social_" + sg)]).then(function (r) {
      var c = compute(L.a, r[0], r[1]); busy = false; if (!c) return;
      var sig = sg + "|" + c.score + "|" + c.parts.map(function (p) { return p.key + p.score; }).join(",");
      var card = rep.querySelector(".ov");
      if (card && !force && sig === last) return;
      last = sig;
      if (!card) { card = document.createElement("section"); card.className = "ov pl-card"; hero.parentNode.insertBefore(card, hero.nextSibling); }
      card.innerHTML = html(c);
      window.__p2pOverallNow = c;
      var arc = card.querySelector(".arc"); requestAnimationFrame(function () { requestAnimationFrame(function () { if (arc) arc.style.strokeDashoffset = arc.getAttribute("data-off"); }); });
      var n = card.querySelector("[data-count]"); if (n && !RM) { var to = Number(n.getAttribute("data-count")), t0 = performance.now(); (function tick(t) { var p = Math.min(1, (t - t0) / 1100); n.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(tick); })(t0); }
      card.querySelector(".ov-ring").addEventListener("click", function () { explain(c); });
      card.querySelectorAll("[data-go]").forEach(function (b) { b.addEventListener("click", function () { var t = rep.querySelector(b.getAttribute("data-go") === "website" ? ".seo" : ".soc"); if (t) { t.scrollIntoView({ behavior: RM ? "auto" : "smooth", block: "start" }); var i = t.querySelector("input"); if (i) setTimeout(function () { try { i.focus({ preventScroll: true }); } catch (e) { } }, 500); } }); });
    }, function () { busy = false; });
  }
  function soon(f) { clearTimeout(timer); timer = setTimeout(function () { refresh(f); }, 200); }
  new MutationObserver(function () { soon(false); }).observe(document.body, { childList: true, subtree: true });
  window.addEventListener("p2p:signal", function () { soon(true); setTimeout(function () { refresh(true); }, 1500); });
  window.__p2pOverall = { compute: compute };
})();
