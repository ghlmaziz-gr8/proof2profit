// Export an analysis, a comparison or a business's full history as a standalone HTML file or a PDF.
// The document is built here from structured data with every value escaped; the PDF uses the browser's own "Save as PDF".
(function () {
  "use strict";
  var P = function () { return window.__p2pProgress; };
  function esc(t) { return String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function col(s) { return s >= 75 ? "#1F9D74" : s >= 50 ? "#E0A21B" : "#D9534F"; }
  function aiR(a) { var x = (a && a.aspects || []).map(function (q) { return Number(q.score); }).filter(function (v) { return !isNaN(v); }); return x.length ? Math.max(1, Math.min(5, Math.round(x.reduce(function (p, c) { return p + c; }, 0) / x.length / 20 * 10) / 10)) : null; }
  function themeN(a) { return ((a && a.likes || []).length + (a && a.dislikes || []).length) || null; }
  function na(v) { return v == null || v === "" || /^(unknown|—|n\/a)$/i.test(String(v)) ? null : v; }
  function lab(s) { return s >= 85 ? "Strongest" : s >= 70 ? "Strong" : s >= 50 ? "Mixed" : "Needs attention"; }
  function dstr(ts) { return new Date(ts).toLocaleDateString("default", { month: "long", day: "numeric", year: "numeric" }); }
  function slug(s) { return String(s || "report").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "report"; }
  function day() { return new Date().toISOString().slice(0, 10); }

  var CSS = "*{box-sizing:border-box}body{margin:0;background:#f3eee6;color:#1f2430;font:15px/1.55 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}" +
    ".pg{max-width:820px;margin:0 auto;padding:24px 16px 40px}.hd{background:#14161a;color:#fff;border-radius:18px;padding:24px 26px;margin-bottom:16px}" +
    ".br{font-size:12px;letter-spacing:.16em;font-weight:700;color:#f5b041}.hd h1{margin:8px 0 2px;font-size:28px;line-height:1.2}.hd p{margin:0;color:#b9b4aa;font-size:14px}" +
    ".card{background:#fff;border:1px solid #e6dfd3;border-radius:18px;padding:20px 22px;margin-bottom:14px;break-inside:avoid}" +
    "h2{margin:0 0 12px;font-size:12px;letter-spacing:.12em;text-transform:uppercase}.g{color:#0b6b54}.r{color:#b4442f}" +
    ".st{display:grid;grid-template-columns:1fr 1fr;gap:12px}.st div{border-radius:14px;padding:14px;background:#fff4e2;border:1px solid #f3d9ac}.st div:nth-child(2){background:#e8f4f4;border-color:#bfdddd}" +
    ".st small{display:block;font-size:11px;letter-spacing:.1em;font-weight:700;color:#7a756c}.st b{font-size:26px}" +
    ".as{margin:0 0 14px;break-inside:avoid}.as .t{display:flex;justify-content:space-between;gap:10px;font-weight:700;font-size:14px;margin-bottom:5px}.as .t span{font-size:12px}" +
    ".bar{height:10px;border-radius:6px;background:#ece5d9;overflow:hidden}.bar i{display:block;height:100%;border-radius:6px}" +
    ".ab{display:grid;grid-template-columns:22px 1fr 34px;gap:8px;align-items:center;margin-bottom:5px;font-size:13px;font-weight:700}" +
    "ul{margin:0;padding-left:20px}li{margin:3px 0}.two{display:grid;grid-template-columns:1fr 1fr;gap:16px}.two h3{margin:0 0 4px;font-size:14px}" +
    ".n{display:flex;gap:12px;margin-bottom:8px}.n b{flex:0 0 26px;height:26px;border-radius:13px;background:#e8943a;color:#fff;text-align:center;line-height:26px;font-size:13px}" +
    ".ch{display:inline-block;padding:3px 10px;border-radius:99px;font-size:13px;margin:0 6px 6px 0;background:#eee}.ch.u{background:#dff3ea;color:#0b6b54}.ch.d{background:#fbe6e3;color:#b4442f}" +
    ".vd{background:#14161a;color:#f3eee6;border-radius:16px;padding:16px 20px;margin-bottom:14px;break-inside:avoid}.vd b.k{display:block;font-size:11px;letter-spacing:.12em;color:#f5b041;margin-bottom:6px}" +
    ".pgc{border-radius:16px;padding:16px 18px;margin-bottom:14px;color:#fff;break-inside:avoid}.pgc b{font-size:18px}.pgc p{margin:6px 0 0;opacity:.95}" +
    "table{border-collapse:collapse;width:100%;font-size:14px}th,td{text-align:left;padding:8px 6px;border-bottom:1px solid #eee}th{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#7a756c}" +
    ".ft{font-size:12px;color:#7a756c;text-align:center;margin-top:18px}" +
    "@media(max-width:560px){.two{grid-template-columns:1fr}.hd h1{font-size:22px}}" +
    "@media print{body{background:#fff}.pg{padding:0}.card,.hd,.vd,.pgc{box-shadow:none}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{margin:14mm}}";

  function li(a) { return (a || []).slice(0, 8).map(function (x) { return "<li>" + esc(x) + "</li>"; }).join(""); }
  function aspects(asp) { return (asp || []).map(function (a) { return '<div class="as"><div class="t"><div>' + esc(a.name) + '</div><span style="color:' + col(a.score) + '">' + lab(a.score) + " · " + a.score + '</span></div><div class="bar"><i style="width:' + a.score + "%;background:" + col(a.score) + '"></i></div></div>'; }).join(""); }
  function wrap(title, sub, body) {
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(title) + " · Proof to Profit</title><style>" + CSS + '</style></head><body><div class="pg"><div class="hd"><div class="br">PROOF TO PROFIT</div><h1>' + esc(title) + "</h1><p>" + esc(sub) + "</p></div>" + body +
      '<p class="ft">Generated by Proof to Profit on ' + esc(dstr(Date.now())) + ". Scores and themes are AI estimates based on review patterns: a starting point, not an audit.</p></div></body></html>";
  }

  function progressBlock(c, subtitle) {
    var colr = { up: "#1F9D74", down: "#D9534F", mixed: "#C97A00", flat: "#2F8FB5" }[c.verdict];
    var rows = c.rows.map(function (r) {
      var d = r.dir === "new" ? "new" : r.dir === "gone" ? "dropped" : r.delta > 0 ? "+" + r.delta : r.delta < 0 ? String(r.delta).replace("-", "−") : "0";
      return "<tr><td>" + esc(r.name) + "</td><td>" + (r.prev == null ? "—" : r.prev) + "</td><td>" + (r.cur == null ? "—" : r.cur) + '</td><td style="font-weight:700;color:' + ({ up: "#1F9D74", down: "#D9534F" }[r.dir] || "#7a756c") + '">' + d + "</td></tr>";
    }).join("");
    function l(t, k, a) { return a && a.length ? '<h2 class="' + k + '" style="margin-top:12px">' + t + "</h2><ul>" + li(a) + "</ul>" : ""; }
    return '<div class="pgc" style="background:' + colr + '"><b>' + esc(c.head) + "</b><p>" + esc(subtitle) + " " + esc(c.summary) + '</p></div><div class="card"><h2>What changed, topic by topic</h2><table><tr><th>Topic</th><th>Before</th><th>Now</th><th>Change</th></tr>' + rows + "</table>" +
      l("New concerns showing up", "r", c.newConcerns) + l("No longer coming up", "g", c.goneConcerns) + l("New strengths", "g", c.newStrengths) + l("Strengths that faded", "r", c.lostStrengths) + "</div>";
  }


  var PLAT = { instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok", youtube: "YouTube", x: "X", twitter: "X", linkedin: "LinkedIn" };
  function engLine(e) { return e ? '<p style="margin:0;font-size:13px;color:#7a756c">Assessed by ' + esc(e) + "</p>" : ""; }
  function olist(a) { return (a || []).length ? "<ol>" + a.slice(0, 8).map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ol>" : ""; }
  function get(key) { var g = window.storageGetJSON; return typeof g === "function" ? g(key, null).catch(function () { return null; }) : Promise.resolve(null); }
  function forecastCard(rec) {
    var d = rec && rec.d; if (!d) return "";
    function hz(t, o) { o = o || {}; return o.outlook ? "<h3>" + t + "</h3><p>" + esc(o.outlook) + "</p>" + ((o.drivers || []).length ? '<p class="g"><b>Likely drivers</b></p><ul>' + li(o.drivers) + "</ul>" : "") + ((o.risks || o.watch || []).length ? '<p class="r"><b>Watch out for</b></p><ul>' + li(o.risks || o.watch) + "</ul>" : "") : ""; }
    return '<div class="card"><h2>Forecast · AI outlook</h2>' + (d.headline ? "<p><b>" + esc(d.headline) + "</b></p>" : "") + hz("Next month", d.next_month) + hz("Next 6 months", d.next_6_months) +
      ((d.actions || []).length ? "<h3>Do this now</h3>" + olist(d.actions) : "") + (d.seasonal_note ? "<p><i>" + esc(d.seasonal_note) + "</i></p>" : "") +
      '<p style="font-size:12px;color:#7a756c">Written ' + esc(dstr(rec.ts || Date.now())) + (d._engine ? " by " + esc(d._engine) : "") + ". A forecast, not a guarantee.</p></div>";
  }
  function seoCard(rec) {
    if (!rec || rec.score == null) return "";
    var cats = Object.keys(rec.cats || {}).filter(function (k) { return rec.cats[k] != null; }).map(function (k) { var v = rec.cats[k]; return '<div class="as"><div class="t"><div>' + esc(k) + '</div><span style="color:' + col(v) + '">' + v + '</span></div><div class="bar"><i style="width:' + v + "%;background:" + col(v) + '"></i></div></div>'; }).join("");
    var d = rec.ai, ai = d ? "<h3>" + esc(d.headline || "AI action plan") + "</h3>" + ((d.quick_wins || []).length ? "<p><b>Quick wins (this week)</b></p>" + olist(d.quick_wins) : "") + ((d.this_month || []).length ? "<p><b>This month</b></p>" + olist(d.this_month) : "") + ((d.local_tips || []).length ? "<p><b>Local search tips</b></p><ul>" + li(d.local_tips) + "</ul>" : "") + (d._engine ? '<p style="font-size:12px;color:#7a756c">Written by ' + esc(d._engine) + ".</p>" : "") : "";
    return '<div class="card"><h2>Website SEO check</h2><p><b style="font-size:24px;color:' + col(rec.score) + '">' + rec.score + '</b> <span style="color:#7a756c">/ 100 · ' + esc(rec.url || "") + " · checked " + esc(dstr(rec.ts || Date.now())) + "</span></p>" + cats + ai + "</div>";
  }
  function socialCard(rec) {
    var ps = rec && rec.profiles || []; ps = ps.filter(function (p) { return p && p.report; }); if (!ps.length) return "";
    return '<div class="card"><h2>Social media</h2>' + ps.map(function (p) {
      var R = p.report, nm = PLAT[p.platform] || p.platform || "Profile";
      return '<div style="margin-bottom:14px"><p><b>' + esc(nm) + "</b> @" + esc(p.handle || "") + ' · <b style="color:' + col(R.score) + '">' + esc(R.score) + "/100</b>" + (R.followers != null ? " · " + esc(R.followers) + " followers" : "") + (R.confidence ? " · confidence " + esc(R.confidence) : "") + "</p>" +
        (R.headline ? "<p>" + esc(R.headline) + "</p>" : "") + (R.engagement ? "<p>" + esc(R.engagement) + "</p>" : "") + (R.posting ? "<p>" + esc(R.posting) + "</p>" : "") +
        '<div class="two"><div><h3 class="g">What is working</h3><ul>' + li(R.strengths) + '</ul></div><div><h3 class="r">Gaps to close</h3><ul>' + li(R.gaps) + "</ul></div></div>" +
        ((R.content_ideas || []).length ? "<h3>Post ideas</h3>" + olist(R.content_ideas) : "") + (p.engine ? '<p style="font-size:12px;color:#7a756c">Assessed by ' + esc(p.engine) + "</p>" : "") + "</div>";
    }).join("") + "</div>";
  }
  function extras(slugStr) {
    return Promise.all([get("reviewlens_fc_" + slugStr), get("reviewlens_seo_" + slugStr), get("reviewlens_social_" + slugStr)]).then(function (r) { return forecastCard(r[0]) + seoCard(r[1]) + socialCard(r[2]); });
  }
  function assessCards(a) {
    var body = '<div class="card"><h2>Aspect breakdown</h2>' + aspects(a.aspects) + "</div>";
    body += '<div class="card"><h2 class="g">What guests love</h2><ul>' + li(a.likes) + '</ul><h2 class="r" style="margin-top:16px">Where it slips</h2><ul>' + li(a.dislikes) + "</ul></div>";
    if ((a.suggestions || []).length) body += '<div class="card"><h2>Suggested next steps</h2>' + a.suggestions.map(function (s, i) { return '<div class="n"><b>' + (i + 1) + "</b><div>" + esc(s) + "</div></div>"; }).join("") + "</div>";
    var o = a.seasonal_outlook || {};
    if (o.guidance || (o.rising || []).length || (o.watch || []).length) body += '<div class="card"><h2>Trend outlook</h2>' + (o.rising || []).map(function (x) { return '<span class="ch u">↑ ' + esc(x) + "</span>"; }).join("") + (o.watch || []).map(function (x) { return '<span class="ch d">↓ ' + esc(x) + "</span>"; }).join("") + (o.guidance ? "<p>" + esc(o.guidance) + "</p>" : "") + "</div>";
    var ideas = (a.campaign_ideas && a.campaign_ideas.ideas) || [];
    if (ideas.length) body += '<div class="card"><h2>Campaign ideas</h2>' + ideas.slice(0, 6).map(function (i) { return "<p><b>" + esc(i.title) + "</b>" + (i.format ? " <span class='ch'>" + esc(i.format) + "</span>" : "") + "<br>" + esc(i.angle) + (i.reasoning ? "<br><i>Why this: " + esc(i.reasoning) + "</i>" : "") + "</p>"; }).join("") + "</div>";
    return body;
  }

  function singleDoc(a, history, ex) {
    var ai = aiR(a), tn = themeN(a), hasR = na(a.rating) != null, hasC = na(a.review_count) != null;
    var body = '<div class="card"><div class="st"><div><small>' + (hasR ? "RATING" : "AI RATING") + '</small><b>' + (hasR ? esc(a.rating) : esc(ai == null ? "–" : ai)) + ' <span style="font-size:13px;color:#7a756c">/ 5</span></b></div><div><small>' + (hasC ? "REVIEW VOLUME" : "THEMES FOUND") + '</small><b>' + (hasC ? esc(a.review_count) : esc(tn == null ? "–" : tn)) + "</b></div></div>" + ((!hasR || !hasC) ? '<p style="margin:12px 0 0;font-size:13px;color:#7a756c">AI rating is the average of the aspect scores out of 5, calculated by our AI from what guests say. It is an assessment, not Google\'s star rating.</p>' : "") + "</div>";
    if (history && history.length && P()) {
      var last = history[history.length - 1];
      body += progressBlock(P().compare(last, { ts: Date.now(), rating: a.rating, avgScore: P().avgOf(a.aspects), aspects: a.aspects || [], likes: a.likes || [], dislikes: a.dislikes || [] }), "Compared with the assessment from " + dstr(last.ts) + ".");
    }
    body += assessCards(a);
    body += (ex || "");
    var bits = [a.address || "Review analysis"]; if (a.website) bits.push(a.website); if (a.phone) bits.push(a.phone); if (a.last_review) bits.push("Last review: " + a.last_review);
    if (a._engine) bits.push("Assessed by " + a._engine);
    return { html: wrap(a.name || "Business analysis", bits.join(" · "), body), name: slug(a.name) };
  }

  function compareDoc(a, b) {
    var names = [], seen = {};
    (a.aspects || []).concat(b.aspects || []).forEach(function (x) { if (!seen[x.name]) { seen[x.name] = 1; names.push(x.name); } });
    var aw = 0, bw = 0, learn = [];
    var rows = names.map(function (n) {
      var sa = (a.aspects || []).filter(function (x) { return x.name === n; })[0], sb = (b.aspects || []).filter(function (x) { return x.name === n; })[0];
      sa = sa ? sa.score : null; sb = sb ? sb.score : null;
      if (sa != null && sb != null) {
        if (sa - sb >= 12) { aw++; learn.push(b.name + " could take cues from " + a.name + " on " + n.toLowerCase()); } else if (sb - sa >= 12) { bw++; learn.push(a.name + " could take cues from " + b.name + " on " + n.toLowerCase()); }
      }
      function bar(l, s, c) { return s == null ? "" : '<div class="ab"><span style="color:' + c + '">' + l + '</span><div class="bar"><i style="width:' + s + "%;background:" + c + '"></i></div><span>' + s + "</span></div>"; }
      return '<div class="as"><div class="t"><div>' + esc(n) + "</div></div>" + bar("A", sa, "#E8943A") + bar("B", sb, "#2E8F8F") + "</div>";
    }).join("");
    var v = aw > bw ? "<b>" + esc(a.name) + "</b> comes out ahead, leading on " + aw + " aspect" + (aw === 1 ? "" : "s") + " vs " + bw + " for " + esc(b.name) + "." : bw > aw ? "<b>" + esc(b.name) + "</b> comes out ahead, leading on " + bw + " aspect" + (bw === 1 ? "" : "s") + " vs " + aw + " for " + esc(a.name) + "." : esc(a.name) + " and " + esc(b.name) + " are closely matched overall, each leading in different areas.";
    var body = '<div class="card st" style="padding:14px"><div><small>A</small><b style="font-size:18px">' + esc(a.name) + '</b><br><span style="font-size:13px">' + (na(a.rating) == null ? "AI rating " + esc(aiR(a) == null ? "–" : aiR(a)) + " / 5" : esc(a.rating) + " / 5") + " · " + (na(a.review_count) == null ? esc(themeN(a) == null ? "–" : themeN(a)) + " themes found" : esc(a.review_count) + " reviews") + '</span></div><div><small>B</small><b style="font-size:18px">' + esc(b.name) + '</b><br><span style="font-size:13px">' + (na(b.rating) == null ? "AI rating " + esc(aiR(b) == null ? "–" : aiR(b)) + " / 5" : esc(b.rating) + " / 5") + " · " + (na(b.review_count) == null ? esc(themeN(b) == null ? "–" : themeN(b)) + " themes found" : esc(b.review_count) + " reviews") + "</span></div></div>" +
      '<div class="card"><h2>Aspect comparison</h2>' + rows + "</div>" +
      '<div class="card"><h2 class="g">What guests love</h2><div class="two"><div><h3>' + esc(a.name) + "</h3><ul>" + li(a.likes) + "</ul></div><div><h3>" + esc(b.name) + "</h3><ul>" + li(b.likes) + '</ul></div></div><h2 class="r" style="margin-top:18px">Where each slips</h2><div class="two"><div><h3>' + esc(a.name) + "</h3><ul>" + li(a.dislikes) + "</ul></div><div><h3>" + esc(b.name) + "</h3><ul>" + li(b.dislikes) + "</ul></div></div></div>" +
      '<div class="vd"><b class="k">VERDICT</b>' + v + (learn.length ? "<br><br>" + esc(learn.slice(0, 3).join(". ")) + "." : "") + "</div>";
    return { html: wrap((a.name || "A") + " vs " + (b.name || "B"), "Side-by-side review comparison", body), name: slug(a.name + "-vs-" + b.name) };
  }

  function savedDoc(biz, hist, ex) {
    var n = hist.length, latest = hist[n - 1], body = "";
    var rows = hist.slice().reverse().map(function (h, k) {
      var i = n - 1 - k, d = i > 0 && h.avgScore != null && hist[i - 1].avgScore != null ? h.avgScore - hist[i - 1].avgScore : null;
      return "<tr><td>" + esc(dstr(h.ts)) + "</td><td>" + (h.avgScore == null ? "—" : h.avgScore) + "</td><td>" + (h.rating == null ? "—" : h.rating) + '</td><td style="font-weight:700;color:' + (d > 0 ? "#1F9D74" : d < 0 ? "#D9534F" : "#7a756c") + '">' + (d == null ? "—" : d > 0 ? "+" + d : d < 0 ? String(d).replace("-", "−") : "0") + "</td></tr>";
    }).join("");
    if (n > 1 && P()) {
      var bi = (window.__p2pSavedView && window.__p2pSavedView.baseIdx != null && window.__p2pSavedView.baseIdx < n - 1) ? window.__p2pSavedView.baseIdx : n - 2;
      body += progressBlock(P().compare(hist[bi], latest), "Latest assessment (" + dstr(latest.ts) + ") compared with " + dstr(hist[bi].ts) + ".");
    }
    var pts = hist.map(function (h) { return h.avgScore == null ? null : h.avgScore; });
    body += '<div class="card"><h2>Assessment history</h2><table><tr><th>Date</th><th>Avg score</th><th>Rating</th><th>Change</th></tr>' + rows + "</table></div>";
    body += latest.full ? '<div class="card"><h2>Latest assessment · ' + esc(dstr(latest.ts)) + "</h2>" + (latest.engine ? engLine(latest.engine) : "<p style='margin:0;font-size:13px;color:#7a756c'>Full detail follows.</p>") + "</div>" + assessCards(latest.full) : '<div class="card"><h2>Latest assessment · ' + esc(dstr(latest.ts)) + "</h2>" + aspects(latest.aspects) + '<h2 class="g" style="margin-top:14px">What guests love</h2><ul>' + li(latest.likes) + '</ul><h2 class="r" style="margin-top:14px">Where it slips</h2><ul>' + li(latest.dislikes) + "</ul></div>";
    body += (ex || "");
    return { html: wrap(biz.name, (biz.address ? biz.address + " · " : "") + n + " assessment" + (n === 1 ? "" : "s") + " on record", body), name: slug(biz.name) + "-history" };
  }

  function current(kind) {
    var L = window.__p2pLast, S = window.__p2pSaved;
    if (kind === "compare" && L && L.kind === "compare") return Promise.resolve(compareDoc(L.a, L.b));
    if (kind === "saved" && S) return extras(S.biz.slug || (window.slugify ? window.slugify(S.biz.name) : slug(S.biz.name))).then(function (ex) { return savedDoc(S.biz, S.history, ex); });
    if (kind === "single" && L && L.kind === "single") {
      var g = window.storageGetJSON, sl = window.slugify;
      if (typeof g === "function" && typeof sl === "function") {
        var sg = sl(L.a.name);
        return Promise.all([g("reviewlens_hist_" + sg, []).catch(function () { return []; }), extras(sg)]).then(function (r) {
          var h = r[0] || []; if (L.a._viewing && L.a._ts) h = h.filter(function (x) { return x.ts < L.a._ts; });
          return singleDoc(L.a, h, r[1]);
        });
      }
      return Promise.resolve(singleDoc(L.a, []));
    }
    return Promise.resolve(null);
  }

  function download(doc) {
    var blob = new Blob([doc.html], { type: "text/html;charset=utf-8" }), url = URL.createObjectURL(blob);
    var a = document.createElement("a"); a.href = url; a.download = "proof-to-profit-" + doc.name + "-" + day() + ".html"; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  function printPdf(doc) {
    var f = document.createElement("iframe");
    f.setAttribute("aria-hidden", "true"); f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    f.onload = function () {
      setTimeout(function () {
        try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { download(doc); }
        setTimeout(function () { f.remove(); }, 60000);
      }, 250);
    };
    document.body.appendChild(f);
    f.srcdoc = doc.html.replace(/<title>[^<]*<\/title>/, "<title>proof-to-profit-" + doc.name + "-" + day() + "</title>");
  }

  // ---- tiny menu ----
  var css = ".p2e-menu{position:fixed;z-index:9999;background:#fff;border:1px solid #e6dfd3;border-radius:14px;box-shadow:0 14px 40px rgba(0,0,0,.25);padding:6px;min-width:230px;max-width:calc(100vw - 24px);font:14px system-ui,sans-serif;color:#1f2430}" +
    ".p2e-menu button{all:unset;box-sizing:border-box;display:flex;gap:10px;align-items:center;width:100%;min-height:48px;padding:8px 12px;border-radius:10px;cursor:pointer}.p2e-menu button:hover,.p2e-menu button:focus-visible{background:#fff4e2}" +
    ".p2e-menu small{display:block;color:#7a756c;font-size:12px}.p2e-menu b{display:block}.p2e-menu i{font-style:normal;font-size:20px}";
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
  var menu = null;
  function closeMenu() { if (menu) { menu.remove(); menu = null; } }
  function openMenu(btn, kind) {
    closeMenu();
    menu = document.createElement("div"); menu.className = "p2e-menu"; menu.setAttribute("role", "menu");
    function item(icon, t, s, fn) { var b = document.createElement("button"); b.type = "button"; b.setAttribute("role", "menuitem"); b.innerHTML = "<i>" + icon + "</i><span><b>" + t + "</b><small>" + s + "</small></span>"; b.addEventListener("click", function () { closeMenu(); current(kind).then(function (d) { if (d) fn(d); }); }); menu.appendChild(b); }
    item("📄", "Save as PDF", "Opens print: choose “Save as PDF”", printPdf);
    item("🌐", "Download as HTML", "One file, opens in any browser", download);
    document.body.appendChild(menu);
    var r = btn.getBoundingClientRect(), mw = menu.offsetWidth, mh = menu.offsetHeight;
    var left = Math.max(12, Math.min(r.left, window.innerWidth - mw - 12));
    var top = r.bottom + 6; if (top + mh > window.innerHeight - 12) top = Math.max(12, r.top - mh - 6);
    menu.style.left = left + "px"; menu.style.top = top + "px";
    var f = menu.querySelector("button"); if (f) f.focus();
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-export]");
    if (b) { if (menu && menu._for === b) { closeMenu(); return; } openMenu(b, b.getAttribute("data-export")); if (menu) menu._for = b; return; }
    if (menu && !e.target.closest(".p2e-menu")) closeMenu();
  }, true);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeMenu(); });
  window.addEventListener("resize", closeMenu);
  window.__p2pExport = { current: current };
})();
