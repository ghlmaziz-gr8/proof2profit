/* Polish layer: scroll reveals, bar/number animation, hover and press feedback, a sticky section bar, a celebration when scores rise.
   Purely presentational: it never changes data, and everything is off for visitors who ask for reduced motion. */
(function () {
  "use strict";
  var RM = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (s, r) { return (r || document).querySelector(s); }, $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var css = [
    "html{scroll-behavior:smooth}",
    "@keyframes plup{from{opacity:0;transform:translateY(18px) scale(.985)}to{opacity:1;transform:none}}",
    "@keyframes plbar{from{transform:scaleX(0)}to{transform:scaleX(1)}}",
    "@keyframes plfade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}",
    "@keyframes plshim{0%{background-position:-240px 0}100%{background-position:240px 0}}",
    "@keyframes plrip{to{transform:scale(2.6);opacity:0}}",
    "@keyframes plconf{0%{opacity:1;transform:translate(0,0) rotate(0)}100%{opacity:0;transform:translate(var(--x),var(--y)) rotate(var(--r))}}",
    "@keyframes plpulse{0%,100%{box-shadow:0 0 0 0 rgba(246,149,0,.35)}50%{box-shadow:0 0 0 8px rgba(246,149,0,0)}}",
    ".pl-pre{opacity:0;transform:translateY(18px)}",
    ".pl-in{animation:plup .65s var(--pld,0ms) cubic-bezier(.2,.8,.2,1) both}",
    ".pl-pre .seo-cat .t i,.pl-pre .an-bar i,.pl-pre .p2p-bar .t i,.pl-pre .month-bar-fill,.pl-pre .p2p-trk i{transform:scaleX(0)}",
    ".pl-in .seo-cat .t i,.pl-in .an-bar i,.pl-in .p2p-bar .t i,.pl-in .month-bar-fill{transform-origin:left;animation:plbar 1s .25s cubic-bezier(.2,.8,.2,1) both}",
    ".mode-section.active,#report{animation:plfade .45s both}",
    /* hover / press feedback */
    ".fc-scen,.seo-cat,.soc-card,.soc-t,.saved-row,.an-row,.p2p-ck,.campaign-card,.stat-highlight{transition:transform .25s cubic-bezier(.2,.8,.2,1),box-shadow .25s,background-color .2s}",
    ".fc-scen:hover,.campaign-card:hover,.saved-row:hover,.p2p-ck:hover{transform:translateY(-3px);box-shadow:0 10px 24px -10px rgba(20,22,26,.35)}",
    ".soc-card:hover{box-shadow:0 12px 28px -14px rgba(20,22,26,.3)}",
    ".seo-go,.soc-go,.fc-go,.p2x-share-btn,#competitorBtn,#analyticsBtn,#analyzeBtn,.fc-refresh,.p2p-open,.seo-fix button{position:relative;overflow:hidden;transition:transform .15s,box-shadow .25s,filter .2s}",
    ".seo-go:hover,.soc-go:hover,.fc-go:hover,#competitorBtn:hover,#analyzeBtn:hover{box-shadow:0 8px 20px -8px rgba(246,149,0,.65);filter:brightness(1.04)}",
    ".seo-go:active,.soc-go:active,.fc-go:active,.p2x-share-btn:active,#competitorBtn:active,#analyticsBtn:active,#analyzeBtn:active,.p2p-open:active{transform:scale(.96)}",
    ".pl-rip{position:absolute;border-radius:50%;background:rgba(255,255,255,.55);width:60px;height:60px;margin:-30px 0 0 -30px;pointer-events:none;animation:plrip .6s ease-out forwards}",
    "button:focus-visible,a:focus-visible,[role=button]:focus-visible{outline:3px solid rgba(246,149,0,.55);outline-offset:2px}",
    /* sticky section bar */
    ".pl-jump{position:sticky;top:58px;z-index:30;display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding:8px 6px;margin:12px 0 4px;background:rgba(255,255,255,.82);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border:1px solid rgba(230,223,211,.9);border-radius:999px;box-shadow:0 6px 18px -10px rgba(20,22,26,.35);animation:plfade .5s both}",
    ".pl-jump::-webkit-scrollbar{display:none}",
    ".pl-jump button{flex:0 0 auto;min-height:0;width:auto;border:0;background:transparent;color:#5b5b5b;font:600 13px 'Space Grotesk',system-ui,sans-serif;padding:7px 14px;border-radius:999px;cursor:pointer;transition:background .2s,color .2s,transform .15s}",
    ".pl-jump button:hover{background:rgba(246,149,0,.12);color:#14161a}",
    ".pl-jump button.on{background:#14161a;color:#fff}",
    ".pl-sm{scroll-margin-top:118px}",
    /* celebration */
    ".pl-conf{position:absolute;left:50%;top:50%;width:9px;height:14px;border-radius:2px;pointer-events:none;animation:plconf 1.5s var(--dl,0s) cubic-bezier(.2,.7,.3,1) forwards;z-index:5}",
    ".p2p-banner{position:relative}",
    /* skeleton while the AI works */
    ".pl-skel{display:grid;gap:12px;margin:18px 0 0;width:100%;max-width:560px}.pl-skel i{display:block;height:74px;border-radius:14px;background:linear-gradient(90deg,#efe9df 0,#f8f4ec 120px,#efe9df 240px);background-size:480px 100%;animation:plshim 1.3s infinite linear}.pl-skel i:nth-child(1){height:120px}.pl-skel i:nth-child(3){width:70%}",
    "@media(max-width:700px){.pl-jump{top:74px;margin-left:-4px;margin-right:-4px}}",
    "@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.pl-pre{opacity:1;transform:none}.pl-in,.mode-section.active,#report,.pl-jump{animation:none!important}.pl-conf{display:none}}"
  ].join("\n");
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  // ---------- scroll reveal ----------
  var SEL = ".fc,.seo-res,.soc-sumg,.p2p-banner,.an-tiles>div,.an-row,.an-watch,.stat-highlight,#analyticsContent .list-block,.saved-row,.p2p-ck,.pl-card";
  var seq = 0, seqT = 0;
  var io = ("IntersectionObserver" in window) ? new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      var el = e.target; io.unobserve(el);
      el.style.setProperty("--pld", Math.min(seq++, 6) * 70 + "ms"); clearTimeout(seqT); seqT = setTimeout(function () { seq = 0; }, 250);
      el.classList.remove("pl-pre"); el.classList.add("pl-in");
      if (el.matches && el.matches(".an-tiles>div")) { var b = $("b", el); if (b) countUp(b); }
      if (el.matches && el.matches(".p2p-banner")) celebrate(el);
    });
  }, { threshold: 0.08, rootMargin: "0px 0px -6% 0px" }) : null;
  function prep(el) { if (!io || RM || el.__pl) return; el.__pl = 1; el.classList.add("pl-pre"); io.observe(el); }
  function countUp(b) {
    if (RM || b.__cu) return; var t = (b.textContent || "").trim(); if (!/^\d{1,6}$/.test(t)) return; b.__cu = 1;
    var to = Number(t), t0 = performance.now();
    (function tick(n) { var p = Math.min(1, (n - t0) / 900); b.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(tick); })(t0);
  }
  function celebrate(banner) {
    if (RM || banner.__cf) return; banner.__cf = 1;
    var h = $(".p2p-pg-h", banner); if (!h) return;
    var bg = getComputedStyle(h).backgroundColor; if (!/rgb\(31,\s*157,\s*116\)/.test(bg)) return;   // only when the score improved
    var cols = ["#F69500", "#1D9E75", "#FFD35A", "#2F8FB5", "#E8943A"];
    for (var i = 0; i < 34; i++) {
      var s = document.createElement("span"); s.className = "pl-conf";
      s.style.background = cols[i % cols.length];
      s.style.setProperty("--x", ((Math.random() - 0.5) * 520).toFixed(0) + "px"); s.style.setProperty("--y", (-60 + Math.random() * 220).toFixed(0) + "px");
      s.style.setProperty("--r", ((Math.random() - 0.5) * 720).toFixed(0) + "deg"); s.style.setProperty("--dl", (Math.random() * 0.25).toFixed(2) + "s");
      banner.appendChild(s); (function (n) { setTimeout(function () { n.remove(); }, 1900); })(s);
    }
  }

  // ---------- ripple on primary buttons ----------
  document.addEventListener("pointerdown", function (e) {
    if (RM) return; var b = e.target.closest && e.target.closest(".seo-go,.soc-go,.fc-go,#competitorBtn,#analyzeBtn,.p2x-share-btn,.p2p-open"); if (!b || b.disabled) return;
    var r = b.getBoundingClientRect(), d = document.createElement("span"); d.className = "pl-rip"; d.style.left = (e.clientX - r.left) + "px"; d.style.top = (e.clientY - r.top) + "px";
    b.appendChild(d); setTimeout(function () { d.remove(); }, 650);
  }, { passive: true });

  // ---------- sticky section bar for the single-business report ----------
  var SECTIONS = [["Overview", ".enh-hero"], ["Progress", ".p2p-banner"], ["Breakdown", ".enh-grid"], ["Forecast", ".fc"], ["Website SEO", ".seo"], ["Social", ".soc"], ["Competitors", "#competitorCard"]];
  var spy = null, barSig = "";
  function buildBar() {
    var rep = $("#report"); if (!rep || getComputedStyle(rep).display === "none") return;
    var hero = $(".enh-hero", rep); if (!hero) { var old = $(".pl-jump", rep); if (old) old.remove(); barSig = ""; return; }
    var items = SECTIONS.map(function (s) { var el = $(s[1], rep); return el ? { n: s[0], el: el } : null; }).filter(Boolean);
    var sig = items.map(function (i) { return i.n; }).join("|");
    var bar = $(".pl-jump", rep);
    if (items.length < 3) { if (bar) bar.remove(); barSig = ""; return; }
    if (bar && sig === barSig) return;
    if (bar) bar.remove();
    bar = document.createElement("div"); bar.className = "pl-jump"; bar.setAttribute("role", "navigation"); bar.setAttribute("aria-label", "Jump to a section");
    items.forEach(function (it) {
      it.el.classList.add("pl-sm");
      var b = document.createElement("button"); b.type = "button"; b.textContent = it.n; b._el = it.el;
      b.addEventListener("click", function () { it.el.scrollIntoView({ behavior: RM ? "auto" : "smooth", block: "start" }); });
      bar.appendChild(b);
    });
    hero.parentNode.insertBefore(bar, hero.nextSibling); barSig = sig;
    if (spy) spy.disconnect();
    if ("IntersectionObserver" in window) {
      spy = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (!e.isIntersecting) return; $$("button", bar).forEach(function (b) { var on = b._el === e.target; b.classList.toggle("on", on); if (on && b.scrollIntoView && bar.scrollWidth > bar.clientWidth) { var l = b.offsetLeft - bar.clientWidth / 2 + b.clientWidth / 2; bar.scrollTo({ left: l, behavior: "smooth" }); } }); });
      }, { rootMargin: "-30% 0px -60% 0px" });
      items.forEach(function (it) { spy.observe(it.el); });
    }
  }

  // ---------- loading skeleton ----------
  function skeleton() {
    var l = $("#loadingState"); if (l && !$(".pl-skel", l)) { var s = document.createElement("div"); s.className = "pl-skel"; s.innerHTML = "<i></i><i></i><i></i>"; l.appendChild(s); }
  }

  // ---------- watch the DOM ----------
  var q = 0;
  function sweep() {
    q = 0; $$(SEL).forEach(prep); buildBar(); skeleton();
  }
  new MutationObserver(function () { if (!q) q = setTimeout(sweep, 120); }).observe(document.body, { childList: true, subtree: true });
  if (document.readyState !== "loading") sweep(); else document.addEventListener("DOMContentLoaded", sweep);
})();
