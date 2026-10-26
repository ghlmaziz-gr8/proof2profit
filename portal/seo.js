/* Website SEO check: the Worker fetches the homepage and reports facts; this file scores them and explains every check. */
(function () {
  var RM = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  function esc(t) { return String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function ex(t, h) { if (window.__p2pExplain) window.__p2pExplain(t, h); }
  function norm(s) { return String(s || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, ""); }
  function fmtD(ts) { return new Date(ts).toLocaleDateString("default", { month: "short", day: "numeric" }); }
  function colr(v) { return v >= 80 ? "#1D9E75" : v >= 55 ? "#F69500" : "#C24A34"; }
  function grade(v) { return v >= 85 ? "Excellent" : v >= 70 ? "Good" : v >= 50 ? "Needs work" : "Poor"; }
  function cityOf(addr) { var p = String(addr || "").split(",").map(function (x) { return x.trim(); }).filter(Boolean); if (p.length >= 3) return p[p.length - 2]; if (p.length === 2) return p[0]; return null; }
  var LOCAL_RE = /(LocalBusiness|Restaurant|Cafe|Bar|Bakery|Store|Salon|Spa|Dentist|Physician|Clinic|Lawyer|Attorney|AutoRepair|Gym|Hotel|Business|Establishment|Shop|Studio|Photograph|Contractor|Plumber|Electrician|RealEstate|Accountant)/i;
  var CATS = ["Content & metadata", "Local SEO", "Technical", "Speed (basic)", "Social sharing"];

  // Each check returns {s: pass|warn|fail|skip, found, ...}. Weights add up per category and are renormalized if checks are skipped.
  function checks(F, ctx) {
    var C = [], T = (F.title || "");
    function add(cat, id, label, w, what, why, fix, fn) { C.push({ cat: cat, id: id, label: label, w: w, what: what, why: why, fix: fix, fn: fn }); }
    add(0, "title", "Page title", 5, "The title shown in Google results and the browser tab.", "It is the single strongest on-page signal and the headline people click.", "Add a <title> with your business name, what you do and your town, e.g. \"Joe's Pizza | Pizza in Metuchen, NJ\".", function () { return F.title ? { s: "pass", found: "“" + F.title + "”" } : { s: "fail", found: "No title found" }; });
    add(0, "titlelen", "Title length", 4, "Whether the title fits the 30–60 character range.", "Longer titles get cut off in results; very short ones waste space.", "Rewrite the title to roughly 30–60 characters.", function () { var n = F.titleLen; if (!n) return { s: "fail", found: "No title" }; return { s: n >= 30 && n <= 60 ? "pass" : (n >= 20 && n <= 70 ? "warn" : "fail"), found: n + " characters" }; });
    add(0, "desc", "Meta description", 5, "The short summary shown under your title in Google.", "A clear description raises the number of people who click your result.", "Add a meta description (70–160 characters) that says what you offer, where, and how to contact you.", function () { return F.metaDescription ? { s: "pass", found: "“" + F.metaDescription.slice(0, 120) + (F.metaDescription.length > 120 ? "…" : "") + "”" } : { s: "fail", found: "Missing" }; });
    add(0, "desclen", "Description length", 3, "Whether the description is 70–160 characters.", "Too long gets cut off; too short does not sell the click.", "Edit the description to 70–160 characters.", function () { var n = F.metaDescLen; if (!n) return { s: "skip" }; return { s: n >= 70 && n <= 160 ? "pass" : (n >= 50 && n <= 200 ? "warn" : "fail"), found: n + " characters" }; });
    add(0, "h1", "One main heading (H1)", 5, "The page should have exactly one H1, its main headline.", "It tells search engines and visitors what the page is about.", "Use a single H1 that names your business and service, e.g. \"Wedding Photographer in Edison, NJ\".", function () { var n = F.h1.length; return { s: n === 1 ? "pass" : n > 1 ? "warn" : "fail", found: n === 0 ? "No H1" : n + " H1" + (n > 1 ? "s" : "") + ": “" + F.h1[0].slice(0, 80) + "”" }; });
    add(0, "h2", "Section headings", 3, "Subheadings (H2) that organise the page.", "They help both readers and search engines scan your topics.", "Break the page into sections with H2 headings such as Menu, Services, About, Contact.", function () { var n = F.h2Count; return { s: n >= 2 ? "pass" : n === 1 ? "warn" : "fail", found: n + " H2 heading" + (n === 1 ? "" : "s") }; });
    add(0, "words", "Enough text on the page", 5, "How many words of real text the homepage has.", "Pages with very little text give search engines little to rank you for.", "Aim for 300+ words: what you offer, who it is for, your area, and what makes you different.", function () { var n = F.words; return { s: n >= 300 ? "pass" : n >= 150 ? "warn" : "fail", found: n + " words" }; });
    add(0, "alt", "Image descriptions (alt text)", 3, "Whether images have alt text.", "Alt text helps image search and is needed for accessibility.", "Add short alt text to every meaningful image, e.g. alt=\"Chicken tikka pizza\".", function () { var t = F.images.total; if (!t) return { s: "skip" }; var miss = F.images.missingAlt / t; return { s: miss <= 0.1 ? "pass" : miss <= 0.3 ? "warn" : "fail", found: F.images.missingAlt + " of " + t + " images have no alt text" }; });
    add(0, "links", "Links to other pages", 2, "Links from the homepage to other pages on your site.", "Internal links help search engines find and understand your pages.", "Link to your menu, services, about and contact pages from the homepage.", function () { var n = F.links.internal; return { s: n >= 3 ? "pass" : n >= 1 ? "warn" : "fail", found: n + " internal link" + (n === 1 ? "" : "s") }; });

    add(1, "ltype", "Local business markup", 6, "Structured data (schema.org) that labels you as a local business.", "It lets Google show your hours, phone and reviews and understand that you serve a local area.", "Add LocalBusiness (or a type like Restaurant) JSON-LD with name, address, phone and hours. Many website builders have a plugin for this.", function () { var t = F.schema.types; if (t.some(function (x) { return LOCAL_RE.test(x); })) return { s: "pass", found: t.slice(0, 4).join(", ") }; return t.length ? { s: "warn", found: "Has " + t.slice(0, 3).join(", ") + " but no local business type" } : { s: "fail", found: "No structured data found" }; });
    add(1, "ldetail", "Hours, phone and address in the markup", 3, "Whether that markup includes address, phone and opening hours.", "Complete details are what Google uses for local results.", "Fill in address, telephone and openingHours in your LocalBusiness markup.", function () { var s = F.schema, n = (s.address ? 1 : 0) + (s.phone ? 1 : 0) + (s.hours ? 1 : 0); if (!s.blocks) return { s: "fail", found: "No markup" }; return { s: n === 3 ? "pass" : n > 0 ? "warn" : "fail", found: [s.address ? "address" : "no address", s.phone ? "phone" : "no phone", s.hours ? "hours" : "no hours"].join(", ") }; });
    add(1, "tel", "Tap-to-call phone number", 3, "A phone number that people on phones can tap.", "Most local searches happen on phones; a tap-to-call link turns visitors into calls.", "Make your phone number a link: <a href=\"tel:+1732...\">.", function () { if (F.links.tel > 0 || F.schema.phone) return { s: "pass", found: F.links.tel > 0 ? "Tap-to-call link found" : "Phone in markup" }; if (/\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/.test(F.text || "")) return { s: "warn", found: "Number shown but not tap-to-call" }; return { s: "fail", found: "No phone number found" }; });
    add(1, "name", "Business name in title", 3, "Whether your business name appears in the page title.", "People search for you by name; the title should match.", "Start the title with your business name.", function () { if (!ctx.name) return { s: "skip" }; var n = norm(ctx.name), t = norm(F.title); if (n && t.indexOf(n) >= 0) return { s: "pass", found: "Found" }; var toks = String(ctx.name).toLowerCase().split(/\s+/).filter(function (x) { return x.length > 2; }); var hit = toks.filter(function (x) { return t.indexOf(norm(x)) >= 0; }).length; return { s: toks.length && hit / toks.length >= 0.5 ? "warn" : "fail", found: "Title: “" + F.title.slice(0, 60) + "”" }; });
    add(1, "city", "Town or area mentioned", 3, "Whether your town appears in the title or main heading.", "\"Pizza in Metuchen\" searches need the town on the page.", "Mention your town (and nearby areas you serve) in the title and H1.", function () { if (!ctx.city) return { s: "skip" }; var c = ctx.city.toLowerCase(); if ((F.title + " " + F.h1.join(" ")).toLowerCase().indexOf(c) >= 0) return { s: "pass", found: ctx.city + " found in title/H1" }; if ((F.text || "").toLowerCase().indexOf(c) >= 0) return { s: "warn", found: ctx.city + " only appears in the body text" }; return { s: "fail", found: ctx.city + " not found" }; });
    add(1, "maps", "Map or directions link", 2, "An embedded Google Map or directions link.", "It reinforces your location and helps customers find you.", "Embed a Google Map on your contact section.", function () { return F.mapsEmbed || F.mapsLink ? { s: "pass", found: F.mapsEmbed ? "Embedded map" : "Maps link" } : { s: "fail", found: "None found" }; });

    add(2, "https", "Secure connection (HTTPS)", 6, "Whether the site loads over HTTPS.", "Google favours secure sites and browsers warn visitors about insecure ones.", "Turn on the free SSL certificate in your hosting and redirect http to https.", function () { return F.https ? { s: "pass", found: "HTTPS" } : { s: "fail", found: F.httpsAvailable ? "Loads on http; https is available but not enforced" : "No HTTPS" }; });
    add(2, "redir", "Redirects http to https", 2, "Whether the insecure address sends people to the secure one.", "Prevents duplicate versions of your site.", "Add a site-wide redirect from http to https.", function () { if (!F.inputWasHttp) return { s: "skip" }; return { s: F.https ? "pass" : "fail", found: F.https ? "Redirects to https" : "Stays on http" }; });
    add(2, "viewport", "Mobile friendly", 5, "Whether the page is set up for phone screens.", "Google ranks the mobile version of your site first.", "Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"> and use a responsive theme.", function () { if (!F.viewport) return { s: "fail", found: "No viewport tag" }; return { s: /width\s*=\s*device-width/i.test(F.viewport) ? "pass" : "warn", found: F.viewport }; });
    add(2, "index", "Allowed in Google (indexable)", 6, "Whether anything tells Google not to list the page.", "A stray noindex or a blocked robots.txt makes you invisible in search.", "Remove noindex tags and any \"Disallow: /\" rule for all crawlers.", function () { var bad = []; if (/noindex/i.test(F.robotsMeta || "")) bad.push("meta robots noindex"); if (/noindex/i.test(F.xRobots || "")) bad.push("X-Robots-Tag noindex"); if (F.robots && F.robots.disallowAll) bad.push("robots.txt blocks everything"); return bad.length ? { s: "fail", found: bad.join("; ") } : { s: "pass", found: "No blocks found" }; });
    add(2, "canon", "Canonical address", 3, "A tag saying which web address is the main one.", "Stops search engines splitting your ranking across duplicate addresses.", "Add <link rel=\"canonical\" href=\"https://yoursite.com/\"> to the page head.", function () { return F.canonical ? { s: "pass", found: F.canonical } : { s: "warn", found: "Not set" }; });
    add(2, "robots", "robots.txt file", 2, "The file that tells crawlers what they may visit.", "A sensible robots.txt (also pointing to your sitemap) is standard good practice.", "Add a robots.txt at yoursite.com/robots.txt that links to your sitemap.", function () { return F.robots && F.robots.exists ? { s: "pass", found: "Found" } : { s: "warn", found: "Not found" }; });
    add(2, "sitemap", "XML sitemap", 3, "A list of your pages for search engines.", "Helps Google find all your pages quickly.", "Generate a sitemap.xml (most website builders do this) and submit it in Google Search Console.", function () { return F.sitemap && F.sitemap.exists ? { s: "pass", found: F.sitemap.urls + " URL" + (F.sitemap.urls === 1 ? "" : "s") + " listed" } : { s: "fail", found: "Not found" }; });
    add(2, "lang", "Page language", 1, "The language declared on the page.", "Helps search engines serve you to the right audience.", "Add lang=\"en\" to the <html> tag.", function () { return F.lang ? { s: "pass", found: F.lang } : { s: "warn", found: "Not set" }; });
    add(2, "icon", "Site icon", 1, "A favicon shown in tabs and sometimes in results.", "Small trust and branding signal.", "Add a favicon to your site.", function () { return F.favicon ? { s: "pass", found: "Found" } : { s: "warn", found: "Not declared" }; });

    add(3, "ttfb", "Server response time", 4, "How quickly the server started answering.", "Slow servers hurt rankings and make visitors leave.", "Use better hosting or a CDN, enable caching, and trim heavy plugins.", function () { var n = F.ttfbMs; return { s: n < 600 ? "pass" : n < 1500 ? "warn" : "fail", found: n + " ms" }; });
    add(3, "size", "Page weight (HTML)", 3, "The size of the page's HTML.", "Very heavy pages load slowly on mobile data.", "Remove unneeded code and page-builder bloat.", function () { var n = Math.round(F.htmlBytes / 1024); return { s: n < 300 ? "pass" : n < 800 ? "warn" : "fail", found: n + " KB" }; });

    add(4, "og", "Social preview (Open Graph)", 3, "Title, description and image shown when your link is shared.", "A good preview gets more clicks on Facebook, WhatsApp and messages.", "Add og:title, og:description and og:image tags.", function () { var o = F.og, n = (o.title ? 1 : 0) + (o.description ? 1 : 0) + (o.image ? 1 : 0); return { s: n === 3 ? "pass" : n > 0 ? "warn" : "fail", found: [o.title ? "title" : "no title", o.description ? "description" : "no description", o.image ? "image" : "no image"].join(", ") }; });
    add(4, "tw", "Twitter/X card", 1, "How links look when shared on X.", "Minor, but easy to add.", "Add <meta name=\"twitter:card\" content=\"summary_large_image\">.", function () { return F.twitterCard ? { s: "pass", found: "Found" } : { s: "warn", found: "Not set" }; });
    return C;
  }

  function score(F, ctx) {
    var list = checks(F, ctx).map(function (c) { var r = c.fn(); c.s = r.s; c.found = r.found; return c; });
    var cats = CATS.map(function (name, i) {
      var cs = list.filter(function (c) { return c.cat === i && c.s !== "skip"; });
      var tw = cs.reduce(function (a, c) { return a + c.w; }, 0), got = cs.reduce(function (a, c) { return a + c.w * (c.s === "pass" ? 1 : c.s === "warn" ? 0.5 : 0); }, 0);
      return { name: name, score: tw ? Math.round(got / tw * 100) : null, w: tw, got: got };
    });
    var TW = cats.reduce(function (a, c) { return a + c.w; }, 0), TG = cats.reduce(function (a, c) { return a + c.got; }, 0);
    return { overall: TW ? Math.round(TG / TW * 100) : 0, cats: cats, list: list, TW: TW, TG: TG };
  }

  function errMsg(e) {
    var c = e && e.code, m = e && e.message || "";
    if (c === "bad_url") return "That does not look like a website address. Try something like yourbusiness.com.";
    if (c === "blocked_host") return "That address cannot be checked. Use the public address of the website.";
    if (c === "rate_limited") return "You have reached today's SEO check limit. It resets daily.";
    if (c === "unreachable") return "We could not reach that website (" + (m || "no response") + "). Check the address and try again.";
    if (c === "not_html") return "That address did not return a web page.";
    if (c === "http_530" || c === "http_1016" || c === "http_523") return "We could not find that website. Check the spelling of the address.";
    if (/^http_/.test(c || "")) return "The website answered with an error (" + c.replace("http_", "") + "). Some sites block automated checks; if the site works in your browser, this check cannot see it.";
    if (c === "not_found") return "The SEO checker is not switched on yet. Update the Worker with the latest code first.";
    return "The SEO check could not be completed just now. Please try again.";
  }

  function mount(el, opts) {
    if (!el) return;
    var kvKey = "reviewlens_seo_" + opts.slug, ctx = { name: opts.name, city: cityOf(opts.address) }, saved = null, last = null;
    el.innerHTML = '<section class="seo"><div class="seo-top"><div><p class="seo-eyebrow">Website SEO</p><h3>How findable is your website?</h3><p class="seo-meta">Checks the homepage for on-page and technical SEO. It does not measure rankings or backlinks.</p></div></div>' +
      '<form class="seo-form"><input type="text" class="seo-in" inputmode="url" autocapitalize="off" autocomplete="off" spellcheck="false" placeholder="yourbusiness.com" aria-label="Website address"><button type="submit" class="seo-go">Check SEO</button></form>' +
      '<p class="seo-last"></p><div class="seo-out" aria-live="polite"></div></section>';
    var root = el.querySelector(".seo"), inp = root.querySelector(".seo-in"), out = root.querySelector(".seo-out"), lastEl = root.querySelector(".seo-last"), go = root.querySelector(".seo-go");
    if (opts.website) inp.value = opts.website.replace(/^https?:\/\//i, "").replace(/\/$/, "");
    function showLast() { lastEl.innerHTML = saved && saved.ts ? "Last checked " + fmtD(saved.ts) + " · " + esc(saved.url.replace(/^https?:\/\//, "")) + " · score <b>" + saved.score + "</b>" + histLine() : ""; }
    function histLine() { var h = (saved && saved.hist) || []; if (h.length < 2) return ""; return '<br><span class="seo-hist">History: ' + h.slice(-8).reverse().map(function (x) { return new Date(x.ts).toLocaleDateString("default", { month: "short", year: "2-digit" }) + " <b>" + x.score + "</b>"; }).join(" · ") + "</span>"; }
    if (opts.load) Promise.resolve(opts.load(kvKey, null)).then(function (s) { if (s && s.url) {
      saved = s; if (!s.hist) s.hist = [{ ts: s.ts, score: s.score }];
      if (!inp.value || opts.website) inp.value = s.url.replace(/^https?:\/\//i, "").replace(/\/$/, ""); showLast();
      if (s.F && !last) { try { var S0 = score(s.F, ctx), h0 = s.hist; last = { F: s.F, S: S0 }; render(s.F, S0, h0.length > 1 ? h0[h0.length - 2] : null, s.ai); } catch (e) { } }
    } }).catch(function () { });

    function render(F, S, prevOv, storedAi) {
      var prev = prevOv !== undefined ? prevOv : (saved && saved.score != null && saved.url && opts.__prevOk !== false ? saved : null);
      var delta = prev ? S.overall - prev.score : null;
      var fixes = S.list.filter(function (c) { return c.s === "fail" || c.s === "warn"; }).sort(function (a, b) { return (b.w * (b.s === "fail" ? 1 : 0.5)) - (a.w * (a.s === "fail" ? 1 : 0.5)); }).slice(0, 5);
      var R = 52, circ = 2 * Math.PI * R, off = circ * (1 - S.overall / 100);
      var catHtml = S.cats.filter(function (c) { return c.score != null; }).map(function (c, i) { return '<button type="button" class="seo-cat" data-c="' + i + '"><span class="n">' + esc(c.name) + '</span><span class="t"><i style="width:' + c.score + "%;background:" + colr(c.score) + '"></i></span><b>' + c.score + "</b></button>"; }).join("");
      var icon = { pass: "✓", warn: "!", fail: "✕" };
      var listHtml = CATS.map(function (name, ci) {
        var rows = S.list.filter(function (c) { return c.cat === ci && c.s !== "skip"; }); if (!rows.length) return "";
        return '<div class="seo-grp"><p class="seo-gt">' + esc(name) + "</p>" + rows.map(function (c) { return '<button type="button" class="seo-row ' + c.s + '" data-id="' + c.id + '"><span class="ic">' + icon[c.s] + '</span><span class="lb">' + esc(c.label) + '</span><span class="fd">' + esc(c.found || "") + "</span></button>"; }).join("") + "</div>";
      }).join("");
      out.innerHTML = '<div class="seo-res"><div class="seo-hero"><button type="button" class="seo-ring" data-k="overall" aria-label="How the SEO score is calculated"><svg viewBox="0 0 120 120" width="132" height="132"><circle cx="60" cy="60" r="' + R + '" fill="none" stroke="currentColor" stroke-opacity=".14" stroke-width="10"/><circle class="arc" cx="60" cy="60" r="' + R + '" fill="none" stroke="' + colr(S.overall) + '" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + circ.toFixed(1) + '" stroke-dashoffset="' + circ.toFixed(1) + '" data-off="' + off.toFixed(1) + '" transform="rotate(-90 60 60)"/></svg><span class="num"><b data-count="' + S.overall + '">' + (RM ? S.overall : 0) + "</b><small>/100</small></span></button>" +
        '<div class="seo-hc"><p class="seo-grade" style="color:' + colr(S.overall) + '">' + grade(S.overall) + "</p><p class=\"seo-site\">" + esc(F.finalUrl.replace(/^https?:\/\//, "")) + "</p>" +
        (delta != null ? '<p class="seo-delta ' + (delta > 0 ? "up" : delta < 0 ? "dn" : "") + '">' + (delta > 0 ? "▲ +" + delta : delta < 0 ? "▼ " + delta : "● unchanged") + " since " + fmtD(prev.ts) + " (" + prev.score + ")</p>" : '<p class="seo-delta">First check saved. Re-check after you make fixes to track progress.</p>') +
        '<p class="seo-count"><span class="g">' + S.list.filter(function (c) { return c.s === "pass"; }).length + ' passed</span> · <span class="w">' + S.list.filter(function (c) { return c.s === "warn"; }).length + ' to improve</span> · <span class="r">' + S.list.filter(function (c) { return c.s === "fail"; }).length + " failing</span></p></div></div>" +
        '<div class="seo-cats">' + catHtml + "</div>" +
        (fixes.length ? '<div class="seo-fix"><p class="seo-gt">Fix these first</p><ol>' + fixes.map(function (c) { return '<li><button type="button" data-id="' + c.id + '"><b>' + esc(c.label) + "</b><span>" + esc(c.fix) + "</span></button></li>"; }).join("") + "</ol></div>" : '<p class="seo-great">Nothing urgent. This homepage covers the SEO basics well.</p>') +
        '<div class="seo-list">' + listHtml + '</div><div class="seo-ai" id="seoAi"></div><p class="seo-fine">Checked ' + new Date(F.fetchedAt).toLocaleString("default", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + ". Homepage only; speed here is server response and page weight, not full Core Web Vitals.</p></div>";
      requestAnimationFrame(function () { requestAnimationFrame(function () { var a = out.querySelector(".arc"); if (a) a.style.strokeDashoffset = a.getAttribute("data-off"); out.querySelector(".seo-res").classList.add("in"); }); });
      if (!RM) out.querySelectorAll("[data-count]").forEach(function (n) { var to = Number(n.getAttribute("data-count")), t0 = performance.now(); (function tick(t) { var p = Math.min(1, (t - t0) / 1100); n.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(tick); })(t0); });
      out.querySelectorAll("[data-id]").forEach(function (b) { b.addEventListener("click", function () {
        var c = S.list.filter(function (x) { return x.id === b.getAttribute("data-id"); })[0]; if (!c) return;
        var st = c.s === "pass" ? "Passed" : c.s === "warn" ? "Could be better" : "Failing";
        ex(c.label + ": " + st, "<p><b>What it checks:</b> " + esc(c.what) + "</p><p><b>What we found:</b> " + esc(c.found || "–") + "</p><p><b>Why it matters:</b> " + esc(c.why) + "</p>" + (c.s === "pass" ? "<p>Nothing to do here.</p>" : "<p class='ex-note'><b>How to fix:</b> " + esc(c.fix) + "</p>") + "<p><b>Weight:</b> counts for " + c.w + " of " + S.TW + " scoring points.</p>");
      }); });
      out.querySelectorAll("[data-c]").forEach(function (b) { b.addEventListener("click", function () {
        var cat = S.cats.filter(function (c) { return c.score != null; })[Number(b.getAttribute("data-c"))];
        var rows = S.list.filter(function (c) { return CATS[c.cat] === cat.name && c.s !== "skip"; });
        ex(cat.name + ": " + cat.score + " out of 100", "<p><b>How it is calculated:</b> each check earns full points if it passes, half if it could be better, none if it fails, weighted by importance. " + cat.name + " earned <b>" + (Math.round(cat.got * 10) / 10) + "</b> of <b>" + cat.w + "</b> points = <b>" + cat.score + "</b>.</p><p><b>Checks here:</b> " + rows.map(function (c) { return esc(c.label) + " (" + (c.s === "pass" ? "✓" : c.s === "warn" ? "!" : "✕") + ")"; }).join(", ") + ".</p><p>Tap any check below for the details.</p>");
      }); });
      out.querySelector("[data-k=overall]").addEventListener("click", function () {
        ex("SEO score: " + S.overall + " out of 100", "<p><b>What it means:</b> how well this homepage covers the on-page and technical basics search engines look for, with extra weight on local search for a business like yours.</p><p><b>How it is calculated:</b> " + S.list.filter(function (c) { return c.s !== "skip"; }).length + " checks across 5 areas. Pass = full points, could be better = half, fail = none, weighted by importance. Total <b>" + (Math.round(S.TG * 10) / 10) + "</b> of <b>" + S.TW + "</b> = <b>" + S.overall + "</b>.</p><p><b>Bands:</b> 85+ Excellent · 70–84 Good · 50–69 Needs work · under 50 Poor.</p><p class='ex-note'>This is a health check of the homepage. It does not measure Google rankings, backlinks, or reviews, which also affect how you rank.</p>");
      });
      aiBlock(F, S, fixes, storedAi);
    }

    function aiBlock(F, S, fixes, storedAi) {
      var box = out.querySelector("#seoAi"); if (!box) return;
      function list(a) { return (a || []).map(function (x) { return "<li>" + esc(x) + "</li>"; }).join(""); }
      function show(d) {
        box.innerHTML = '<p class="seo-gt">AI action plan</p><p class="seo-head">' + esc(d.headline || "") + '</p><div class="seo-cols"><div><b>Quick wins (this week)</b><ol>' + list(d.quick_wins) + "</ol></div><div><b>This month</b><ol>" + list(d.this_month) + "</ol></div></div>" + ((d.local_tips || []).length ? "<div class=\"seo-tips\"><b>Local search tips</b><ul>" + list(d.local_tips) + "</ul></div>" : "") + '<p class="seo-fine">AI-written from the check results above' + (d.__ts ? " · written " + fmtD(d.__ts) : "") + (d._engine ? " by " + esc(d._engine) : "") + '.</p>';
      }
      if (storedAi && storedAi.headline) { show(storedAi); return; }
      box.innerHTML = '<button type="button" class="seo-go ghost">✨ Create an AI action plan</button><p class="seo-fine">Turns the findings into a prioritised to-do list. Uses one AI request.</p>';
      box.querySelector("button").addEventListener("click", function () {
        box.innerHTML = '<div class="seo-load"><span></span><span></span><span></span> Writing your plan…</div>';
        var probs = S.list.filter(function (c) { return c.s === "fail" || c.s === "warn"; }).map(function (c) { return "- " + c.label + " [" + c.s + "]: found " + (c.found || "n/a") + "; fix: " + c.fix; }).join("\n");
        var prompt = "Respond with ONLY a single JSON object, no markdown fences, no preamble. Never place a literal double-quote character inside a string value.\n\nYou are an SEO advisor for a small local business: " + (opts.name || "the business") + (opts.address ? " (" + opts.address + ")" : "") + ", website " + F.finalUrl + ". Overall SEO health score is " + S.overall + "/100.\n\nHomepage facts: title=" + (F.title || "none") + "; meta description length=" + F.metaDescLen + "; H1=" + (F.h1[0] || "none") + "; words=" + F.words + "; schema types=" + (F.schema.types.join(", ") || "none") + "; sitemap=" + (F.sitemap && F.sitemap.exists ? "yes" : "no") + ".\n\nProblems found:\n" + (probs || "none") + "\n\nWrite a practical plan an owner with no technical background can follow. Use only the findings above; do not invent data. Keep each item to one short sentence.\n\n" + '{"headline":"one sentence summary","quick_wins":["3 items doable this week"],"this_month":["3 items"],"local_tips":["2 tips specific to local search for this kind of business, such as Google Business Profile and reviews"]}';
        Promise.resolve(opts.ai(prompt)).then(function (r) { var d = (r && typeof r === "object") ? r : (opts.parse ? opts.parse(String(r)) : null); if (!d || !d.headline) throw new Error("bad"); d.__ts = Date.now(); show(d); if (saved && opts.save) { saved.ai = d; opts.save(kvKey, saved); } })
          .catch(function (e) { box.innerHTML = '<p class="seo-err">' + (opts.isLimit && opts.isLimit(e) ? "You have reached today's AI limit. It resets daily." : "Could not write the plan just now.") + "</p>"; });
      });
    }

    root.querySelector(".seo-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var v = inp.value.trim(); if (!v) { out.innerHTML = '<p class="seo-err">Enter the business website address first.</p>'; return; }
      go.disabled = true; go.textContent = "Checking…";
      out.innerHTML = '<div class="seo-load"><span></span><span></span><span></span> Visiting the website and reading it like a search engine…</div>';
      var api = window.__p2p && window.__p2p.api; if (!api) { out.innerHTML = '<p class="seo-err">Not available right now.</p>'; go.disabled = false; go.textContent = "Check SEO"; return; }
      api("/seo", { url: v }).then(function (r) {
        var F = r.result; if (!F) throw { code: "audit_failed" };
        if (F.error) throw { code: F.error };
        var S = score(F, ctx); last = { F: F, S: S };
        render(F, S);
        var oldHist = (saved && saved.hist) || (saved && saved.ts ? [{ ts: saved.ts, score: saved.score }] : []), nowTs = Date.now(), slim = {}; Object.keys(F).forEach(function (k) { if (k !== "text") slim[k] = F[k]; });
        var rec = { url: F.finalUrl, ts: nowTs, score: S.overall, F: slim, hist: window.__p2pPruneMonthly ? window.__p2pPruneMonthly(oldHist.concat([{ ts: nowTs, score: S.overall }]), 24) : oldHist.concat([{ ts: nowTs, score: S.overall }]).slice(-24), cats: S.cats.reduce(function (o, c) { o[c.name] = c.score; return o; }, {}) };
        if (opts.save) opts.save(kvKey, rec);
        saved = rec; showLast();
      }).catch(function (e) { out.innerHTML = '<p class="seo-err">' + esc(errMsg(e)) + "</p>"; })
        .then(function () { go.disabled = false; go.textContent = "Check SEO"; });
    });
  }

  var css = ".seo{margin:18px 0;border:1px solid var(--line);border-radius:16px;padding:18px;background:var(--card)}.seo-eyebrow{margin:0;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--coral-dark);font-weight:700}.seo h3{margin:2px 0 4px;font:700 19px 'Space Grotesk',sans-serif}.seo-meta{margin:0;font-size:12.5px;color:var(--ink-soft)}" +
    ".seo-form{display:flex;gap:8px;margin-top:14px;flex-wrap:wrap}.seo-in{flex:1 1 220px;min-width:0;border:1px solid var(--line);border-radius:10px;padding:12px 14px;font:inherit;font-size:15px;background:#fff;color:var(--ink)}.seo-in:focus{outline:2px solid var(--coral);outline-offset:1px}" +
    ".seo-go{background:var(--coral);color:#fff;border:0;border-radius:10px;padding:12px 18px;font-weight:700;cursor:pointer;min-height:0;width:auto}.seo-go.ghost{background:#fff;color:var(--coral-dark);border:1px solid var(--coral)}.seo-go.ghost:hover{background:rgba(246,149,0,.1);color:var(--coral-dark)}.seo-go:disabled{opacity:.6;cursor:wait}" +
    ".seo-hist{color:var(--ink-soft)}.seo-last{margin:8px 0 0;font-size:12.5px;color:var(--ink-soft)}.seo-last:empty{display:none}.seo-out{margin-top:6px}.seo-err{color:var(--warn);font-size:13.5px;margin:12px 0 0}" +
    ".seo-res{opacity:0;transform:translateY(8px);transition:opacity .5s,transform .5s}.seo-res.in{opacity:1;transform:none}" +
    ".seo-hero{display:flex;gap:18px;align-items:center;margin:14px 0;flex-wrap:wrap;background:linear-gradient(135deg,#1b1d22,#2a2118);color:#fff;border-radius:16px;padding:16px}.seo-ring{position:relative;background:none;border:0;padding:0;min-height:0;width:132px;height:132px;color:#fff;cursor:pointer;flex:0 0 auto}.seo-ring:hover{background:none}.seo-ring .arc{transition:stroke-dashoffset 1.3s cubic-bezier(.2,.8,.2,1)}.seo-ring .num{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;line-height:1}.seo-ring b{font:700 38px 'Space Grotesk',sans-serif;font-variant-numeric:tabular-nums}.seo-ring small{font-size:12px;color:rgba(255,255,255,.65)}" +
    ".seo-hc{min-width:0;flex:1 1 200px}.seo-grade{margin:0;font:700 24px 'Space Grotesk',sans-serif}.seo-site{margin:2px 0 6px;font-size:13px;color:rgba(255,255,255,.75);overflow-wrap:anywhere}.seo-delta{margin:0 0 6px;font-size:13px;color:rgba(255,255,255,.8)}.seo-delta.up{color:#5fe0b0}.seo-delta.dn{color:#ff8f7a}.seo-count{margin:0;font-size:12.5px;color:rgba(255,255,255,.8)}.seo-count .g{color:#5fe0b0}.seo-count .w{color:#FFD35A}.seo-count .r{color:#ff8f7a}" +
    ".seo-cats{display:grid;gap:4px;margin-bottom:14px}.seo-cat{display:flex;align-items:center;gap:10px;width:100%;background:transparent;color:var(--ink);border:0;border-radius:8px;padding:7px 6px;min-height:0;font-size:13.5px;text-align:left}.seo-cat:hover{background:rgba(246,149,0,.07);color:var(--ink)}.seo-cat .n{flex:0 0 140px;font-weight:600}.seo-cat .t{flex:1 1 auto;height:8px;border-radius:99px;background:#f1eee9;overflow:hidden}.seo-cat .t i{display:block;height:100%;border-radius:99px}.seo-cat b{width:28px;text-align:right;font-variant-numeric:tabular-nums}" +
    ".seo-gt{margin:0 0 8px;font:700 12.5px 'Space Grotesk',sans-serif;text-transform:uppercase;letter-spacing:.08em;color:var(--ink-soft)}.seo-fix{background:#FEF3E2;border-radius:12px;padding:14px;margin-bottom:14px}.seo-fix ol{margin:0;padding-left:20px;min-width:0}.seo-fix b{white-space:normal;overflow-wrap:anywhere}.seo-fix li{margin:0 0 8px;min-width:0}.seo-fix button{display:block;text-align:left;background:none;color:var(--ink);border:0;padding:0;min-height:0;font:inherit;cursor:pointer;width:100%;max-width:100%;white-space:normal;overflow-wrap:anywhere;word-break:break-word;height:auto;line-height:1.4}.seo-fix button:hover{background:none;color:var(--ink)}.seo-fix b{display:block;font-size:14px}.seo-fix span{display:block;font-size:13px;color:#7a4a10;white-space:normal;overflow-wrap:anywhere}.seo-great{background:#E3F5EE;color:#137a59;border-radius:12px;padding:12px 14px;font-size:14px}" +
    ".seo-grp{margin-bottom:12px}.seo-row{display:flex;align-items:center;gap:10px;width:100%;background:transparent;color:var(--ink);border:0;border-bottom:1px solid var(--line);border-radius:0;padding:9px 4px;min-height:0;text-align:left;font-size:13.5px}.seo-row:hover{background:rgba(246,149,0,.07);color:var(--ink)}.seo-row .ic{flex:0 0 22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#fff}.seo-row.pass .ic{background:#1D9E75}.seo-row.warn .ic{background:#F69500}.seo-row.fail .ic{background:#C24A34}.seo-row .lb{flex:0 0 auto;font-weight:600;max-width:46%}.seo-row .fd{flex:1 1 auto;min-width:0;color:var(--ink-soft);text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
    ".seo-ai{margin-top:14px;border-top:1px dashed var(--line);padding-top:14px}.seo-head{margin:0 0 10px;font:600 15.5px/1.4 'Space Grotesk',sans-serif}.seo-cols{display:grid;grid-template-columns:1fr 1fr;gap:14px}.seo-cols b,.seo-tips b{font-size:12px;text-transform:uppercase;letter-spacing:.06em}.seo-cols ol,.seo-tips ul{margin:4px 0 0;padding-left:18px;font-size:13.5px;line-height:1.5}.seo-tips{margin-top:10px}.seo-fine{margin:8px 0 0;font-size:12px;color:var(--ink-soft)}" +
    ".seo-load{display:flex;align-items:center;gap:6px;color:var(--ink-soft);font-size:13.5px;margin-top:12px}.seo-load span{width:8px;height:8px;border-radius:50%;background:var(--coral);animation:seob 1s infinite}.seo-load span:nth-child(2){animation-delay:.15s}.seo-load span:nth-child(3){animation-delay:.3s}@keyframes seob{0%,100%{opacity:.25;transform:scale(.8)}50%{opacity:1;transform:scale(1.15)}}" +
    "@media(max-width:600px){.seo{padding:14px}.seo-cols{grid-template-columns:1fr}.seo-cat .n{flex-basis:104px}.seo-row{flex-wrap:wrap}.seo-row .lb{max-width:none;flex:1 1 60%}.seo-row .fd{flex:1 1 100%;text-align:left;white-space:normal;padding-left:32px}}" +
    "@media(prefers-reduced-motion:reduce){.seo-res{opacity:1;transform:none;transition:none}.seo-ring .arc{transition:none}.seo-load span{animation:none}}";
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
  window.__p2pSeo = { mount: mount, score: score, checks: checks };
})();
