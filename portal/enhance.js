// Proof to Profit portal: animated charts + responsive layout (desktop dashboard / mobile app).
// Pure enhancement layer: it restyles and animates what the main script renders and never changes its logic.
(function () {
  "use strict";
  var RM = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var SVGNS = "http://www.w3.org/2000/svg";
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function explain(title, bodyHtml) {
    var old = document.getElementById("enhEx"); if (old) old.remove();
    var ov = h("div", "enh-ex"); ov.id = "enhEx";
    var box = h("div", "enh-ex-box"); box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true");
    var t = h("h3", "", ""); t.textContent = title;
    var x = h("button", "enh-ex-x", "Got it"); x.type = "button";
    box.appendChild(t); box.appendChild(h("div", "enh-ex-body", bodyHtml)); box.appendChild(x); ov.appendChild(box);
    var prev = document.activeElement;
    function close() { ov.remove(); document.removeEventListener("keydown", key); if (prev && prev.focus) try { prev.focus(); } catch (e) { } }
    function key(e) { if (e.key === "Escape") close(); }
    x.addEventListener("click", close); ov.addEventListener("click", function (e) { if (e.target === ov) close(); }); document.addEventListener("keydown", key);
    document.body.appendChild(ov); x.focus();
  }
  window.__p2pExplain = explain;
  function h(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function sv(tag, attrs) { var e = document.createElementNS(SVGNS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); return e; }
  function scoreColor(s) { return s >= 75 ? "#1D9E75" : s >= 55 ? "#F69500" : "#C24A34"; }

  // ---------------------------------------------------------------- styles
  var css = [
    /* tabs with sliding indicator */
    ".tabs{position:relative}",
    ".tab{position:relative;z-index:1;display:flex;align-items:center;justify-content:center;gap:7px;transition:color .25s}",
    ".tab svg{width:17px;height:17px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex:0 0 auto;transition:transform .3s cubic-bezier(.3,1.6,.5,1)}",
    ".tab.active{background:transparent!important;color:#fff}",
    ".tab.active svg{transform:scale(1.15)}",
    ".tab-ind{position:absolute;top:4px;bottom:4px;left:0;width:0;border-radius:8px;background:linear-gradient(135deg,#F69500,#FFB438);box-shadow:0 6px 16px -6px rgba(246,149,0,.7);transition:transform .35s cubic-bezier(.3,1.2,.4,1),width .35s cubic-bezier(.3,1.2,.4,1);z-index:0}",
    ".mode-section.active,.report,.empty{animation:enhFade .45s cubic-bezier(.2,.8,.2,1)}",
    "@keyframes enhFade{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}",
    /* rise-in on scroll */
    ".enh-rise{opacity:0;transform:translateY(16px);transition:opacity .6s cubic-bezier(.2,.8,.2,1),transform .6s cubic-bezier(.2,.8,.2,1);transition-delay:var(--rd,0ms)}",
    ".enh-rise.in{opacity:1;transform:none}",
    ".saved-row,.campaign-card,.stat-highlight,.card{transition:transform .2s,box-shadow .2s,border-color .2s}",
    ".saved-row:hover,.campaign-card:hover,.stat-highlight:hover{transform:translateY(-2px);box-shadow:0 14px 28px -16px rgba(20,22,26,.35)}",
    "button:active{transform:scale(.97)}",
    /* bars */
    ".bar-track{height:8px;position:relative}",
    ".bar-fill{position:relative;overflow:hidden}",
    ".bar-fill:after,.month-bar-fill:after{content:'';position:absolute;inset:0;background:linear-gradient(100deg,transparent 30%,rgba(255,255,255,.55) 50%,transparent 70%);transform:translateX(-120%);animation:enhShine 3.2s ease-in-out 1.4s infinite}",
    "@keyframes enhShine{0%,60%{transform:translateX(-120%)}100%{transform:translateX(120%)}}",
    ".month-bar-fill{position:relative;overflow:hidden;background:linear-gradient(90deg,#F69500,#FFB438)!important}",
    ".aspect{padding:6px 8px;margin:0 -8px 4px;border-radius:10px;transition:background .2s}",
    ".aspect:hover{background:#FBF8F3}",
    ".aspect-top .enh-n{font-family:'Space Grotesk',sans-serif;font-weight:600;margin-left:8px;color:var(--ink)}",
    ".aspect-top .a-label{margin-left:auto}",
    ".aspect-top>span:first-child{display:flex;align-items:center}",
    /* radar */
    ".radar-wrap svg{overflow:visible}",
    ".save-btn-row{margin-top:16px!important}",
    ".trend-line-wrap svg{height:auto!important;width:100%;aspect-ratio:7/3;max-height:280px}",
    "html{background:#F6F3EE}",
    ".enh-radar-data{transform-origin:130px 130px;transform:scale(.02);opacity:0;transition:transform 1.1s cubic-bezier(.2,1.25,.3,1),opacity .5s}",
    "svg.in .enh-radar-data{transform:scale(1);opacity:1}",
    ".enh-radar-data circle{transition:r .2s;cursor:pointer}.enh-radar-data circle:hover{r:6}",
    ".radar-wrap svg polygon[stroke='var(--line)'],.radar-wrap svg line{opacity:0;transition:opacity .8s}svg.in polygon[stroke='var(--line)'],svg.in line{opacity:1}",
    /* radar: roomy labels + live animation */
    ".radar-wrap svg{width:76%!important;max-width:330px!important;margin:0 auto;display:block;height:auto!important;aspect-ratio:1}",
    ".enh-sweep{transform-origin:130px 130px;opacity:0;pointer-events:none}",
    "svg.in .enh-sweep{animation:enhSweep 6.5s linear 1.3s 1 both}",
    "@keyframes enhSweep{0%{opacity:0;transform:rotate(0)}8%{opacity:1}88%{opacity:1}100%{opacity:0;transform:rotate(720deg)}}",
    "svg.in .enh-radar-data polygon{animation:enhGlow 3.4s ease-in-out 1.3s infinite alternate}",
    "@keyframes enhGlow{from{filter:drop-shadow(0 0 2px rgba(246,149,0,.25))}to{filter:drop-shadow(0 0 11px rgba(246,149,0,.75))}}",
    ".enh-ping{fill:none;stroke-width:1.6;opacity:0;transform-box:fill-box;transform-origin:center;pointer-events:none}",
    "svg.in .enh-ping{animation:enhPing 2.8s ease-out infinite}",
    "@keyframes enhPing{0%{opacity:.8;transform:scale(1)}70%,100%{opacity:0;transform:scale(4.2)}}",
    ".radar-wrap svg text{opacity:0;transition:opacity .7s}svg.in text{opacity:1}",
    /* hero: comet ring, shimmer, tiles rise */
    ".enh-ring-live:before{content:'';position:absolute;inset:-7px;border-radius:50%;background:conic-gradient(from 0deg,transparent 0 68%,rgba(255,180,56,.9) 100%);-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 3px),#000 calc(100% - 2px));mask:radial-gradient(farthest-side,transparent calc(100% - 3px),#000 calc(100% - 2px));animation:enhSpin 3.6s linear infinite}",
    "@keyframes enhSpin{to{transform:rotate(360deg)}}",
    ".enh-hero>.enh-shine{position:absolute!important;z-index:0!important}",
    ".enh-shine{position:absolute;top:0;bottom:0;left:-40%;width:30%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.10),transparent);transform:skewX(-18deg);pointer-events:none;animation:enhShine 9s ease-in-out 1.4s infinite;z-index:0}",
    "@keyframes enhShine{0%{left:-40%}18%,100%{left:140%}}",
    ".enh-kpi{animation:enhRise .6s cubic-bezier(.2,.8,.2,1) both}.enh-kpi:nth-child(2){animation-delay:.12s}.enh-kpi:nth-child(3){animation-delay:.24s}",
    "@keyframes enhRise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}",
    ".enh-contact{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 12px}",
    ".enh-contact a,.enh-contact span{display:inline-flex;align-items:center;gap:6px;min-height:34px;padding:0 12px;border-radius:99px;background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.12);color:#fff;font:500 13px 'Inter',sans-serif;text-decoration:none;max-width:100%;overflow-wrap:anywhere;animation:enhRise .6s .3s cubic-bezier(.2,.8,.2,1) both}",
    ".enh-contact a:hover{background:rgba(255,180,56,.22);border-color:rgba(255,180,56,.5)}",
    ".enh-tap{cursor:pointer;position:relative}.enh-tap:focus-visible{outline:2px solid #FFB438;outline-offset:3px}",
    ".enh-kpi.enh-tap:hover{border-color:rgba(255,180,56,.6);background:rgba(255,255,255,.13)}.enh-ring.enh-tap:hover .ct span{color:#FFD35A}",
    ".enh-i{position:absolute;top:5px;right:6px;width:15px;height:15px;border-radius:50%;border:1px solid rgba(255,255,255,.4);color:#d9d4ca;font:italic 600 10px/13px Georgia,serif;text-align:center;font-style:italic}",
    ".enh-ring .enh-i{top:6px;right:6px;width:18px;height:18px;line-height:16px;font-size:12px}",
    ".aspect.enh-tap:hover .a-label{text-decoration:underline}",
    ".enh-ex{position:fixed;inset:0;z-index:99999;background:rgba(20,22,26,.55);display:flex;align-items:center;justify-content:center;padding:16px;animation:enhFade .2s}",
    ".enh-ex-box{background:#fff;color:#14161A;border-radius:16px;max-width:440px;width:100%;max-height:85vh;overflow:auto;padding:22px;box-shadow:0 20px 60px rgba(0,0,0,.35);animation:enhRise .3s cubic-bezier(.2,.8,.2,1)}",
    ".enh-ex-box h3{margin:0 0 10px;font:700 18px 'Space Grotesk',sans-serif}.enh-ex-body p{margin:0 0 10px;font-size:14px;line-height:1.5}.enh-ex-body .ex-note{background:#FEF3E2;border-radius:10px;padding:10px 12px;font-size:13px;color:#7a4a10}",
    ".enh-ex-x{width:100%;margin-top:6px}@keyframes enhFade{from{opacity:0}to{opacity:1}}",
    "@media (prefers-reduced-motion:reduce){.enh-sweep,.enh-ping,.enh-shine,.enh-ring-live:before,.enh-kpi,.enh-contact a,.enh-contact span,.enh-radar-data polygon{animation:none!important}.enh-sweep{display:none}}",
    /* trend */
    ".enh-trend path.enh-line{stroke-linecap:round;stroke-linejoin:round}",
    ".enh-trend circle{opacity:0;transform-box:fill-box;transform-origin:center;transform:scale(0);cursor:pointer}",
    ".enh-trend.in circle{opacity:1;transform:scale(1);transition:transform .45s cubic-bezier(.3,1.8,.5,1),opacity .3s;transition-delay:var(--cd,0ms)}",
    ".enh-trend .enh-area{opacity:0;transition:opacity 1s .5s}.enh-trend.in .enh-area{opacity:1}",
    /* tooltip */
    ".enh-tip{position:fixed;z-index:500;pointer-events:none;background:#14161A;color:#F3EFE8;font:600 12px/1.35 'Inter',sans-serif;padding:7px 10px;border-radius:9px;box-shadow:0 10px 24px rgba(0,0,0,.35);opacity:0;transform:translateY(4px);transition:opacity .12s,transform .12s;max-width:240px}",
    ".enh-tip.show{opacity:1;transform:none}",
    /* hero */
    ".enh-hero{position:relative;overflow:hidden;background:#14161A;color:#F3EFE8;border-radius:16px;padding:22px 22px 20px;margin:-6px -6px 22px;display:grid;grid-template-columns:auto minmax(0,1fr);gap:20px;align-items:center}",
    ".enh-hero:before{content:'';position:absolute;width:340px;height:340px;left:-90px;top:-170px;border-radius:50%;background:radial-gradient(circle,rgba(246,149,0,.4),transparent 65%);animation:enhDrift 10s ease-in-out infinite alternate}",
    ".enh-hero:after{content:'';position:absolute;width:300px;height:300px;right:-90px;bottom:-190px;border-radius:50%;background:radial-gradient(circle,rgba(0,140,187,.38),transparent 65%);animation:enhDrift 12s ease-in-out infinite alternate-reverse}",
    "@keyframes enhDrift{from{transform:translate(0,0)}to{transform:translate(46px,26px)}}",
    ".enh-hero>*{position:relative;z-index:1}",
    ".enh-hero .biz-name{color:#fff;font-size:24px;margin:0 0 3px;line-height:1.15}",
    ".enh-hero .biz-addr{color:#BDB8AE;margin:0 0 14px}",
    ".enh-hero .best-badge{background:rgba(246,149,0,.2);color:#FFB438}",
    ".enh-kpis{display:flex;gap:10px;flex-wrap:wrap}",
    ".enh-kpi{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:9px 13px;min-width:104px}",
    ".enh-kpi small{display:block;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#BDB8AE}",
    ".enh-kpi b{font:600 21px 'Space Grotesk',sans-serif;color:#fff}",
    ".enh-nodata{margin:12px 0 0;font:500 12.5px/1.45 'Inter',sans-serif;color:#c9c3b8;max-width:46ch}",
    ".enh-ring{position:relative;width:118px;height:118px}",
    ".enh-ring svg{width:100%;height:100%;transform:rotate(-90deg)}",
    ".enh-ring .tr{fill:none;stroke:rgba(255,255,255,.12);stroke-width:9}",
    ".enh-ring .pr{fill:none;stroke:url(#enhGrad);stroke-width:9;stroke-linecap:round;stroke-dasharray:289;stroke-dashoffset:289;transition:stroke-dashoffset 1.6s cubic-bezier(.2,.8,.2,1)}",
    ".enh-ring.in .pr{stroke-dashoffset:var(--off)}",
    ".enh-ring .ct{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;font:600 30px/1 'Space Grotesk',sans-serif;color:#fff}",
    ".enh-ring .ct small{text-align:center;font:600 11px 'Inter',sans-serif;color:#FFB438;letter-spacing:.06em;margin-top:3px}",
    ".enh-grid{display:grid;gap:0 32px;grid-template-columns:minmax(0,1fr)}",
    ".enh-cgrid{display:grid;gap:12px;grid-template-columns:minmax(0,1fr)}",
    ".enh-grid .list-block:first-child{border-top:0;margin-top:0;padding-top:0}",
    ".enh-colA .section-label{margin-top:0}",
    ".enh-colB .list-block{margin:0 0 26px;padding:0 0 22px}.enh-colB .list-block:last-child{margin-bottom:0}.enh-colB .list-block li{margin:0 0 9px;line-height:1.5}.enh-grid{margin-top:6px}",
    /* empty/welcome */
    ".empty{padding:0!important;border:0!important;background:transparent!important;text-align:left!important}",
    ".enh-welcome{position:relative;overflow:hidden;border-radius:22px;background:#14161A;color:#F3EFE8;padding:28px;display:grid;gap:22px;grid-template-columns:minmax(0,1fr)}",
    ".enh-welcome:before{content:'';position:absolute;width:420px;height:420px;left:-120px;top:-200px;border-radius:50%;background:radial-gradient(circle,rgba(246,149,0,.4),transparent 65%);animation:enhDrift 10s ease-in-out infinite alternate}",
    ".enh-welcome:after{content:'';position:absolute;width:360px;height:360px;right:-120px;bottom:-220px;border-radius:50%;background:radial-gradient(circle,rgba(0,140,187,.34),transparent 65%);animation:enhDrift 13s ease-in-out infinite alternate-reverse}",
    ".enh-welcome>*{position:relative;z-index:1}",
    ".enh-welcome small{display:block;font:600 11px 'Inter',sans-serif;letter-spacing:.16em;color:#FFB438;margin-bottom:10px}",
    ".enh-welcome h2{font:600 30px/1.1 'Space Grotesk',sans-serif;margin:0 0 10px;letter-spacing:-.02em}.enh-welcome h2 span{color:#F69500}",
    ".enh-welcome p{margin:0;color:#C9C4BA;font-size:14.5px;line-height:1.55;max-width:440px}",
    ".enh-feats{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}",
    ".enh-feat{display:flex;align-items:center;gap:7px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);border-radius:99px;padding:7px 13px;font-size:12.5px;font-weight:600;color:#F3EFE8}",
    ".enh-feat svg{width:15px;height:15px;stroke:#FFB438;fill:none;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}",
    ".enh-demo{background:#fff;color:#14161A;border-radius:18px;padding:16px 18px;box-shadow:0 24px 50px -16px rgba(0,0,0,.7);animation:enhFloat 6s ease-in-out infinite;max-width:380px;width:100%}",
    "@keyframes enhFloat{0%,100%{transform:translateY(0) rotate(-.6deg)}50%{transform:translateY(-8px) rotate(.6deg)}}",
    ".enh-demo .dt{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px}",
    ".enh-demo .dn{font:600 15px 'Space Grotesk',sans-serif}.enh-demo .ds{font-size:11px;color:#8a857d}",
    ".enh-demo .dr{white-space:nowrap;font:600 30px/1 'Space Grotesk',sans-serif}.enh-demo .dr i{font:500 12px 'Inter',sans-serif;color:#8a857d;font-style:normal}",
    ".enh-demo .row{display:flex;align-items:center;gap:9px;margin-top:9px;font-size:12px;color:#5E5A54}",
    ".enh-demo .row b{width:58px;font-weight:500}.enh-demo .row em{width:26px;text-align:right;font-style:normal;color:#14161A;font-weight:600}",
    ".enh-demo .tr{flex:1;height:8px;border-radius:5px;background:#F3EEE6;overflow:hidden}",
    ".enh-demo .tr i{display:block;height:100%;border-radius:5px;width:0;background:var(--c);animation:enhDemo 4.4s cubic-bezier(.2,.8,.2,1) infinite;animation-delay:var(--d)}",
    "@keyframes enhDemo{0%{width:0}30%,86%{width:var(--w)}100%{width:0}}",
    /* loading */
    ".proc-fill{background:linear-gradient(90deg,#F69500,#FFB438,#F69500)!important;background-size:200% 100%;animation:enhStripe 1.6s linear infinite;box-shadow:0 0 14px rgba(246,149,0,.6)}",
    "@keyframes enhStripe{to{background-position:-200% 0}}",
    ".proc-track{height:7px!important}",
    ".loading .lens-spin{filter:drop-shadow(0 0 10px rgba(246,149,0,.5))}",
    /* layout: side + main */
    ".side,.main{min-width:0}",
    "html body{background:#F6F3EE}",
    /* ---------- desktop ---------- */
    "@media (min-width:1024px){",
    " html body{display:block!important;padding:88px 40px 60px!important;min-height:100vh;background-attachment:fixed;background:radial-gradient(900px 500px at 8% -10%,rgba(246,149,0,.10),transparent 60%),radial-gradient(800px 500px at 100% 0,rgba(0,140,187,.08),transparent 60%),#F6F3EE}",
    " body:before{content:'';position:fixed;top:0;left:0;right:0;height:60px;background:rgba(255,255,255,.85);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-bottom:1px solid var(--line);z-index:40}",
    " .app{max-width:1300px!important;margin:0 auto;display:grid;grid-template-columns:392px minmax(0,1fr);gap:32px;align-items:start}",
    " .side{position:sticky;top:84px;background:#fff;border:1px solid var(--line);border-radius:22px;padding:24px;box-shadow:0 22px 50px -30px rgba(20,22,26,.35)}",
    " .tagline{margin-left:0!important;margin-bottom:20px!important}",
    " .side .hint{margin-bottom:6px}",
    " .main .card{padding:26px;border-radius:20px;box-shadow:0 22px 50px -34px rgba(20,22,26,.4)}",
    " .enh-hero{padding:26px 28px;margin:-8px -8px 26px}",
    " .enh-hero .biz-name{font-size:28px}",
    " .enh-ring{width:140px;height:140px}.enh-ring .ct{font-size:36px}",
    " .enh-grid{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}",
    " .enh-cgrid{grid-template-columns:repeat(2,minmax(0,1fr))}",
    " .enh-welcome{grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);align-items:center;padding:44px}",
    " .enh-welcome h2{font-size:38px}",
    " .privacy-foot{position:static!important;margin:14px 0 0!important;pointer-events:auto}",
    " .tab svg{display:none}.tab{font-size:13px!important;padding:9px 4px!important;white-space:nowrap}",
    " .radar-wrap svg{max-width:330px!important;height:auto!important;aspect-ratio:1}",
    " .help-btn{top:12px!important;right:16px!important}",
    " .stat-highlight{display:inline-block}",
    " #analyticsContent{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 18px}",
    " #analyticsContent .list-block,#analyticsContent .outlook-disclaimer{grid-column:1/-1}",
    " .saved-row{padding:18px}",
    " #savedListWrap{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}#savedListWrap .saved-row{margin:0}#savedListWrap .saved-empty{grid-column:1/-1}",
    "}",
    /* ---------- tablet ---------- */
    "@media (max-width:1023px){ html body{display:block!important} .app{margin:0 auto} }",
    "@media (min-width:768px) and (max-width:1023px){",
    " .app{max-width:760px!important}",
    " .enh-grid{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}",
    " .enh-cgrid{grid-template-columns:repeat(2,minmax(0,1fr))}",
    " .enh-welcome{grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:center}",
    "}",
    /* ---------- mobile app ---------- */
    "@media (max-width:767px){",
    " html body{padding:84px 14px calc(92px + env(safe-area-inset-bottom)) !important}",
    " .app{max-width:none!important}",
    " .brand svg{max-width:100%;height:auto}",
    " .tabs{position:fixed!important;left:0;right:0;bottom:0;margin:0!important;border-radius:20px 20px 0 0!important;border:0!important;border-top:1px solid var(--line)!important;padding:8px 8px calc(8px + env(safe-area-inset-bottom))!important;z-index:70;background:rgba(255,255,255,.94)!important;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);box-shadow:0 -12px 30px -18px rgba(20,22,26,.5)}",
    " .tab{flex-direction:column;gap:3px;font-size:11.5px!important;padding:7px 0 6px!important}",
    " .tab svg{width:22px;height:22px}",
    " .tab.active{color:#C77A24!important}",
    " .tab-ind{top:0!important;bottom:auto!important;height:3px;border-radius:0 0 4px 4px;background:#F69500;box-shadow:none}",
    " input[type=text]{font-size:16px!important;min-height:50px}",
    " button{min-height:46px}",
    " .input-row{flex-direction:column}",
    " .input-row button{width:100%}",
    " .privacy-foot{position:static!important;margin:20px 0 0!important;pointer-events:auto}",
    " .enh-hero{grid-template-columns:auto minmax(0,1fr);padding:18px;gap:14px;margin:-10px -10px 20px}",
    " .enh-ring{width:92px;height:92px}.enh-ring .ct{font-size:24px}",
    " .enh-hero .biz-name{font-size:19px}",
    " .enh-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.enh-kpi{min-width:0;padding:8px 10px}.enh-kpi small{font-size:10px;letter-spacing:.05em;overflow-wrap:anywhere}.enh-kpi b{font-size:18px}",
    " .enh-hero .enh-text{grid-column:1/-1}",
    " .card{padding:18px!important}",
    " .enh-welcome{padding:22px}.enh-welcome h2{font-size:25px}",
    " .help-btn{top:12px!important}",
    "}",
    "@media (prefers-reduced-motion:reduce){*,*:before,*:after{animation-duration:.001s!important;animation-iteration-count:1!important;transition-duration:.001s!important}}"
  ].join("\n");
  var st = document.createElement("style"); st.id = "enhStyle"; st.textContent = css; document.head.appendChild(st);

  // ---------------------------------------------------------------- layout: side + main
  var app = $(".app");
  if (app && !app.querySelector(":scope > .side")) {
    var side = h("div", "side"), main = h("div", "main");
    var sideIds = ["singleSection", "compareSection"];
    Array.prototype.slice.call(app.children).forEach(function (n) {
      var toSide = n.classList.contains("brand") || n.classList.contains("tagline") || n.classList.contains("tabs") || n.id === "usageInfo" || sideIds.indexOf(n.id) > -1;
      (toSide ? side : main).appendChild(n);
    });
    app.appendChild(side); app.appendChild(main);
  }

  // tab icons + sliding indicator
  var ICONS = {
    tabSingle: "M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-4.3-4.3",
    tabCompare: "M4 20V10M10 20V4M16 20v-7M22 20V8",
    tabSaved: "M6 3h12v18l-6-4-6 4z"
  };
  var tabsEl = $(".tabs"), ind = null;
  if (tabsEl) {
    ["tabSingle", "tabCompare", "tabSaved"].forEach(function (id) {
      var t = document.getElementById(id); if (!t || t.querySelector("svg")) return;
      var label = t.textContent; t.textContent = "";
      var s = sv("svg", { viewBox: "0 0 24 24" }); s.appendChild(sv("path", { d: ICONS[id] })); t.appendChild(s);
      t.appendChild(h("span", "", label));
    });
    ind = h("span", "tab-ind"); tabsEl.insertBefore(ind, tabsEl.firstChild);
    var moveInd = function () {
      var a = $(".tab.active", tabsEl); if (!a) { ind.style.width = "0"; return; }
      ind.style.width = a.offsetWidth + "px"; ind.style.transform = "translateX(" + a.offsetLeft + "px)";
    };
    new MutationObserver(moveInd).observe(tabsEl, { attributes: true, subtree: true, attributeFilter: ["class"] });
    window.addEventListener("resize", moveInd); setTimeout(moveInd, 50); setTimeout(moveInd, 600);
  }

  // ---------------------------------------------------------------- tooltip
  var tip = h("div", "enh-tip"); document.body.appendChild(tip);
  var tipTimer = null;
  function showTip(text, x, y) {
    tip.textContent = text; tip.classList.add("show");
    var w = tip.offsetWidth; var left = Math.min(Math.max(8, x - w / 2), innerWidth - w - 8);
    tip.style.left = left + "px"; tip.style.top = Math.max(8, y - tip.offsetHeight - 14) + "px";
  }
  function hideTip() { tip.classList.remove("show"); }
  document.addEventListener("mousemove", function (e) {
    var t = e.target.closest && e.target.closest("[data-tip]");
    if (t) showTip(t.getAttribute("data-tip"), e.clientX, e.clientY); else hideTip();
  });
  document.addEventListener("touchstart", function (e) {
    var t = e.target.closest && e.target.closest("[data-tip]");
    if (t) { var p = e.touches[0]; showTip(t.getAttribute("data-tip"), p.clientX, p.clientY); clearTimeout(tipTimer); tipTimer = setTimeout(hideTip, 1800); }
  }, { passive: true });

  // ---------------------------------------------------------------- reveal engine
  var io = ("IntersectionObserver" in window) ? new IntersectionObserver(function (entries) {
    entries.forEach(function (en) { if (en.isIntersecting) { io.unobserve(en.target); reveal(en.target); } });
  }, { threshold: 0.18 }) : null;
  function watch(el) { if (RM || !io) reveal(el, true); else io.observe(el); }

  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function fmt(v, dec) { return dec === 0 && Math.abs(v) >= 1000 ? Math.round(v).toLocaleString() : v.toFixed(dec); }
  function countUp(el, to, dec, dur, pre, post) {
    var start = null;
    if (RM) { el.textContent = (pre || "") + fmt(to, dec) + (post || ""); return; }
    function step(ts) {
      if (start == null) start = ts;
      var p = Math.min(1, (ts - start) / dur);
      el.textContent = (pre || "") + fmt(to * easeOut(p), dec) + (post || "");
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  function reveal(el, instant) {
    el.classList.add("in");
    if (el.classList.contains("enh-bar")) { el.style.width = el.dataset.w; }
    if (el.dataset.count != null) {
      var dec = +(el.dataset.dec || 0);
      countUp(el, parseFloat(el.dataset.count), dec, 1400, "", el.dataset.post || "");
    }
    if (el.classList.contains("enh-trend")) {
      var p = $("path.enh-line", el);
      if (p && !RM) { p.style.transition = "stroke-dashoffset 1.6s cubic-bezier(.4,.1,.2,1)"; requestAnimationFrame(function () { p.style.strokeDashoffset = "0"; }); }
      else if (p) p.style.strokeDashoffset = "0";
    }
  }

  // ---------------------------------------------------------------- enhancers
  function enhanceBars(root) {
    $$(".bar-fill:not([data-enh]), .month-bar-fill:not([data-enh])", root).forEach(function (b, i) {
      b.dataset.enh = "1"; b.classList.add("enh-bar");
      var w = b.style.width || "0%"; b.dataset.w = w;
      var sibs = b.parentElement ? $$(".bar-fill,.month-bar-fill", b.parentElement.parentElement) : [];
      b.style.width = "0%";
      b.style.transition = "width 1.2s cubic-bezier(.2,.8,.2,1) " + ((i % 8) * 80) + "ms";
      // numeric score beside aspect label
      var asp = b.closest(".aspect");
      if (asp && !$(".enh-n", asp)) {
        var sc = Math.round(parseFloat(w));
        var top = $(".aspect-top", asp);
        if (top && !isNaN(sc)) {
          var n = h("span", "enh-n"); n.dataset.count = sc; n.dataset.dec = 0; n.textContent = RM ? sc : "0";
          top.firstElementChild.appendChild(n);
          asp.setAttribute("data-tip", top.firstElementChild.firstChild.textContent + ": " + sc + "/100");
          asp.style.cursor = "default"; watchLater(n);
        }
      }
      watchLater(b.closest(".bar-track, .month-bar-track") || b, b);
    });
  }
  // observe the track but reveal the fill
  var map = new WeakMap();
  function watchLater(obs, target) {
    if (target) { map.set(obs, target); }
    var t = target || obs;
    if (RM || !io) { reveal(t, true); return; }
    var wrap = { el: obs };
    var o = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { o.disconnect(); reveal(t); } });
    }, { threshold: 0.2 });
    o.observe(obs);
  }

  function enhanceRadar(root) {
    $$(".radar-wrap svg:not([data-enh])", root).forEach(function (svg) {
      svg.dataset.enh = "1";
      var poly = $$("polygon", svg).filter(function (p) { return p.hasAttribute("fill-opacity"); });
      var texts = $$("text", svg).map(function (t) { return t.textContent; });
      poly.forEach(function (pg) {
        var g = sv("g", { class: "enh-radar-data" });
        var color = pg.getAttribute("stroke");
        pg.parentNode.insertBefore(g, pg); g.appendChild(pg);
        var dots = $$("circle", svg).filter(function (c) { return c.getAttribute("fill") === color && !c.closest(".enh-radar-data"); });
        var pts = pg.getAttribute("points").trim().split(/\s+/);
        dots.slice(0, pts.length).forEach(function (c, i) {
          g.appendChild(c);
          var pc = poly.length > 1 ? (poly.indexOf(pg) === 0 ? "A" : "B") : "";
          var lbl = texts[i] || "";
          c.setAttribute("data-tip", (pc ? "Business " + pc + " · " : "") + lbl);
        });
      });
      // scanning beam (plays twice, then fades) behind the data
      var first = $(".enh-radar-data", svg);
      if (first && !RM) {
        var sw = sv("g", { class: "enh-sweep" });
        sw.appendChild(sv("path", { d: "M130 130 L130 46 A84 84 0 0 1 184 65.6 Z", fill: "rgba(246,149,0,.20)" }));
        sw.appendChild(sv("line", { x1: 130, y1: 130, x2: 184, y2: 65.6, stroke: "rgba(246,149,0,.7)", "stroke-width": 1.5 }));
        first.parentNode.insertBefore(sw, first);
      }
      // gently pulsing rings on every point
      $$(".enh-radar-data", svg).forEach(function (g) {
        $$("circle", g).forEach(function (c, i) {
          var pg = sv("circle", { class: "enh-ping", cx: c.getAttribute("cx"), cy: c.getAttribute("cy"), r: 4, stroke: c.getAttribute("fill") });
          pg.style.animationDelay = (1.5 + i * 0.35) + "s";
          g.appendChild(pg);
        });
      });
      watchLater(svg, svg);
    });
  }

  function enhanceTrend(root) {
    $$(".trend-line-wrap svg:not([data-enh])", root).forEach(function (svg) {
      svg.dataset.enh = "1"; svg.classList.add("enh-trend");
      var path = $("path", svg); if (!path) return;
      path.classList.add("enh-line"); path.setAttribute("stroke-width", "3");
      var len = path.getTotalLength ? path.getTotalLength() : 400;
      path.style.strokeDasharray = len; path.style.strokeDashoffset = RM ? 0 : len;
      var vb = svg.viewBox.baseVal, hgt = vb.height, wid = vb.width;
      var dots = $$("circle", svg);
      // gradient area under the line
      var defs = sv("defs", {}), lg = sv("linearGradient", { id: "enhArea", x1: "0", y1: "0", x2: "0", y2: "1" });
      lg.appendChild(sv("stop", { offset: "0", "stop-color": "#F69500", "stop-opacity": ".32" }));
      lg.appendChild(sv("stop", { offset: "1", "stop-color": "#F69500", "stop-opacity": "0" }));
      defs.appendChild(lg); svg.insertBefore(defs, svg.firstChild);
      var d = path.getAttribute("d");
      var last = dots[dots.length - 1], first = dots[0];
      if (last && first) {
        var area = sv("path", { d: d + " L" + last.getAttribute("cx") + "," + hgt + " L" + first.getAttribute("cx") + "," + hgt + " Z", fill: "url(#enhArea)", class: "enh-area" });
        svg.insertBefore(area, path);
      }
      // faint grid
      [0.25, 0.5, 0.75].forEach(function (f) { svg.insertBefore(sv("line", { x1: 0, x2: wid, y1: hgt * f, y2: hgt * f, stroke: "#EAE6E1", "stroke-dasharray": "3 4" }), svg.firstChild.nextSibling || null); });
      // tooltips from the check-in list (newest first)
      var rows = $$(".snapshot-row", svg.closest(".card") || document);
      dots.forEach(function (c, i) {
        c.setAttribute("r", "4.5"); c.style.setProperty("--cd", (700 + i * 90) + "ms");
        var r = rows[rows.length - 1 - i];
        if (r) c.setAttribute("data-tip", r.textContent.replace(/\s+/g, " ").trim());
      });
      watchLater(svg, svg);
    });
  }

  function enhanceRise(root) {
    $$(".card, .list-block, .campaign-card, .saved-row, .stat-highlight, .snapshot-row, .cmp-biz, .cmp-aspect, .step, .enh-kpi", root).forEach(function (el, i) {
      if (el.dataset.rise || el.closest(".enh-hero")) return;
      el.dataset.rise = "1"; el.classList.add("enh-rise");
      el.style.setProperty("--rd", ((i % 6) * 70) + "ms");
      if (RM || !io) { el.classList.add("in"); return; }
      var o = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { o.disconnect(); el.classList.add("in"); } }); }, { threshold: 0.03 });
      o.observe(el);
    });
  }

  // single-business report becomes a dashboard
  function enhanceReport(root) {
    $$(".card:not([data-dash])", root).forEach(function (card) {
      var name = $(".biz-name", card), stats = $(".stat-grid", card);
      if (!name || !stats) return;
      card.dataset.dash = "1";
      var vals = $$(".stat .value", stats);
      var ratingTxt = vals[0] ? vals[0].childNodes[0].textContent.trim() : "";
      var rating = parseFloat(ratingTxt);
      var revTxt = vals[1] ? vals[1].textContent.trim() : "";
      var revNum = parseFloat(revTxt.replace(/,/g, ""));
      var bars = $$(".bar-fill", card).map(function (b) { return parseFloat(b.style.width) || 0; });
      var avg = bars.length ? Math.round(bars.reduce(function (a, b) { return a + b; }, 0) / bars.length) : null;

      var aiRating = null, gRating = isNaN(rating) ? null : rating;
      // The big number is always our own AI rating (the overall business health score on a 5-star scale).
      // Google's star rating is shown next to it, never in its place.
      if (avg != null) { aiRating = Math.max(1, Math.min(5, Math.round(avg / 20 * 10) / 10)); rating = aiRating; }
      var themes = 0, nLove = 0, nSlip = 0;
      $$(":scope > .list-block", card).forEach(function (lb) { var t = ($(".list-title", lb) || {}).textContent || ""; var n = $$("li", lb).length; if (/love/i.test(t)) { nLove = n; themes += n; } else if (/slips/i.test(t)) { nSlip = n; themes += n; } });
      var aspInfo = $$(".aspect", card).map(function (a) { var nm = $(".aspect-top span", a); var bf = $(".bar-fill", a); return { name: nm ? nm.textContent.trim() : "", score: bf ? Math.round(parseFloat(bf.style.width) || 0) : 0, el: a }; });

      var hero = h("div", "enh-hero");
      var ring = h("div", "enh-ring" + (isNaN(rating) ? "" : " enh-ring-live"));
      var circ = 2 * Math.PI * 46;
      var s = sv("svg", { viewBox: "0 0 110 110" });
      var defs = sv("defs", {}), g = sv("linearGradient", { id: "enhGrad", x1: "0", y1: "0", x2: "1", y2: "1" });
      g.appendChild(sv("stop", { offset: "0", "stop-color": "#FFB438" })); g.appendChild(sv("stop", { offset: "1", "stop-color": "#F69500" }));
      defs.appendChild(g); s.appendChild(defs);
      s.appendChild(sv("circle", { class: "tr", cx: 55, cy: 55, r: 46 })); s.appendChild(sv("circle", { class: "pr", cx: 55, cy: 55, r: 46 }));
      ring.appendChild(s);
      ring.style.setProperty("--off", isNaN(rating) ? circ : (circ * (1 - Math.min(rating, 5) / 5)));
      $(".pr", s).style.strokeDasharray = circ; $(".pr", s).style.strokeDashoffset = circ;
      var ct = h("div", "ct"); var num = h("span", "", isNaN(rating) ? "n/a" : (RM ? rating.toFixed(1) : "0.0"));
      if (!isNaN(rating)) { num.dataset.count = rating; num.dataset.dec = 1; } else num.style.fontSize = "0.62em";
      ct.appendChild(num); ct.appendChild(h("small", "", isNaN(rating) ? "NO RATING" : (aiRating != null ? "AI RATING" : "OUT OF 5"))); ring.appendChild(ct);
      hero.appendChild(ring);

      var txt = h("div", "enh-text");
      txt.appendChild(name); var addr = $(".biz-addr", card); if (addr) txt.appendChild(addr);
      var bcon = $(".biz-contact", card); if (bcon) { bcon.className = "enh-contact"; txt.appendChild(bcon); }
      var kp = h("div", "enh-kpis");
      var revMissing = !revTxt || /^(unknown|—|n\/a)$/i.test(revTxt); var useThemes = revMissing && themes > 0;
      var k1 = h("div", "enh-kpi", "<small>" + (useThemes ? "Themes found" : "Reviews") + "</small>"); var kb = h("b", "", useThemes ? (RM ? String(themes) : "0") : revMissing ? "Not available" : (isNaN(revNum) ? revTxt : (RM ? revNum.toLocaleString() : "0")));
      if (useThemes) { kb.dataset.count = themes; kb.dataset.dec = 0; } else if (revMissing) kb.style.fontSize = "0.72em";
      if (!useThemes && !isNaN(revNum) && /^[\d,]+$/.test(revTxt)) { kb.dataset.count = revNum; kb.dataset.dec = 0; } else if (!isNaN(revNum)) { kb.textContent = revTxt; }
      k1.appendChild(kb); kp.appendChild(k1);
      var kg = null;
      if (gRating != null && gRating > 0) { kg = h("div", "enh-kpi", "<small>Google rating</small>"); kg.appendChild(h("b", "", gRating.toFixed(1))); kp.appendChild(kg); }
      if (avg != null) {
        var k2 = h("div", "enh-kpi", "<small>Avg score</small>"); var b2 = h("b", "", RM ? avg : "0"); b2.dataset.count = avg; b2.dataset.dec = 0; k2.appendChild(b2); kp.appendChild(k2);
        var k3 = h("div", "enh-kpi", "<small>Aspects</small>"); var b3 = h("b", "", String(bars.length)); k3.appendChild(b3); kp.appendChild(k3);
      }
      txt.appendChild(kp);
      if (aiRating != null || revMissing) {
        var nt = h("p", "enh-nodata", "AI rating = the average of the four aspect scores out of 5, calculated by our AI from what guests say. It is an assessment, not Google's star rating.");
        txt.appendChild(nt);
      }
      hero.appendChild(txt);
      var band = function (v) { return v >= 85 ? "Strongest (85+)" : v >= 70 ? "Strong (70–84)" : v >= 50 ? "Mixed (50–69)" : "Needs attention (under 50)"; };
      var aspList = aspInfo.map(function (a) { return a.name + " " + a.score; }).join(", ");
      var realR = aiRating == null && !isNaN(rating), realC = !revMissing;
      var EX = {
        rating: aiRating != null ? ["AI rating: " + aiRating.toFixed(1) + " out of 5",
          "<p><b>What it means:</b> a quick one-number summary of how positive guest feedback is, on the familiar 5-star scale.</p><p><b>How it is calculated:</b> we take the average score of all " + aspInfo.length + " aspects (" + aspList + ") = <b>" + avg + "</b>, then divide by 20 to turn a 0–100 score into a 5-star one: " + avg + " ÷ 20 = <b>" + aiRating.toFixed(1) + "</b>.</p><p class='ex-note'>This is our AI's assessment of what guests say. It is not Google's star rating, which is the average of stars guests actually click, so the two can differ.</p>"]
          : ["Star rating: " + rating.toFixed(1) + " out of 5", "<p><b>What it means:</b> the business's public star rating from live Google data.</p><p><b>How it is calculated:</b> Google averages the stars every reviewer gave. We show it as reported.</p>"],
        reviews: useThemes ? ["Themes found: " + themes,
          "<p><b>What it means:</b> how many separate points our AI pulled out of the feedback: <b>" + nLove + "</b> things guests love plus <b>" + nSlip + "</b> things where it slips = <b>" + themes + "</b>.</p><p><b>How to use it:</b> more themes means the feedback covers more ground. Each one is listed below in 'What guests love' and 'Where it slips'.</p><p class='ex-note'>This is not a review count. It does not say how many reviews exist or were read.</p>"]
          : ["Reviews: " + revTxt, "<p><b>What it means:</b> the total number of public reviews for this business.</p><p><b>Why it matters:</b> a high rating from many reviews is far more reliable than the same rating from a few.</p>"],
        avg: ["Average score: " + avg + " out of 100",
          "<p><b>What it means:</b> overall how positive guests are across everything we looked at. Higher is better.</p><p><b>How it is calculated:</b> each aspect gets a 0–100 score from the feedback (" + aspList + "). The average score is the plain average of those, <b>" + avg + "</b>.</p><p><b>How to read it:</b> 85+ Strongest · 70–84 Strong · 50–69 Mixed · under 50 Needs attention. You are in: <b>" + band(avg) + "</b>.</p>"],
        aspects: ["Aspects: " + aspInfo.length,
          "<p><b>What it means:</b> the topics guests talk about most for this kind of business. Here: <b>" + aspInfo.map(function (a) { return a.name; }).join(", ") + "</b>.</p><p><b>How each is scored:</b> 0–100, based on how positive the feedback on that topic is. Tap any bar below to see why it got its score.</p>"]
      };
      if (kg) EX.google = ["Google rating: " + gRating.toFixed(1) + " out of 5",
        "<p><b>What it means:</b> the star rating the public gave this business on Google Maps.</p><p><b>How we use it:</b> it is one input to the Reviews part of our overall business health score, together with what guests say in their reviews. Our AI rating is the overall health score on the same 5-star scale.</p>"];
      hero.__ex = EX; hero.__isAI = aiRating != null;
      function openEx(k) { var e = EX[k]; if (e) explain(e[0], e[1]); }
      function mk(el, k) { if (!el) return; el.classList.add("enh-tap"); el.tabIndex = 0; el.setAttribute("role", "button"); el.setAttribute("aria-label", "What does this mean? " + el.textContent.trim()); el.addEventListener("click", function () { openEx(k); }); el.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openEx(k); } }); var i = h("i", "enh-i", "i"); el.appendChild(i); }
      mk(ring, "rating"); mk(k1, "reviews"); if (kg) mk(kg, "google"); if (typeof k2 !== "undefined" && k2) mk(k2, "avg"); if (typeof k3 !== "undefined" && k3) mk(k3, "aspects");
      aspInfo.forEach(function (a) {
        a.el.classList.add("enh-tap"); a.el.tabIndex = 0; a.el.setAttribute("role", "button");
        var go = function () { explain(a.name + ": " + a.score + " out of 100 (" + band(a.score).split(" (")[0] + ")", "<p><b>What it means:</b> how positive guest feedback is about <b>" + a.name + "</b>. Higher is better.</p><p><b>How it is scored:</b> our AI reads the feedback on this topic and rates it 0–100. 85+ Strongest · 70–84 Strong · 50–69 Mixed · under 50 Needs attention.</p><p><b>This one:</b> " + a.score + " = <b>" + band(a.score) + "</b>. It counts for " + Math.round(100 / aspInfo.length) + "% of the average score.</p>"); };
        a.el.addEventListener("click", go); a.el.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
      });
      if (!RM) hero.insertBefore(h("div", "enh-shine"), hero.firstChild);
      stats.remove();
      card.insertBefore(hero, card.firstChild);
      watchLater(ring, ring);
      $$("[data-count]", hero).forEach(function (n) { watchLater(n, n); });

      // two-column body
      var colA = h("div", "enh-colA"), colB = h("div", "enh-colB"), grid = h("div", "enh-grid");
      var sl = $(".section-label", card), radar = $(".radar-wrap", card);
      var aspects = $$(".aspect", card);
      if (sl) colA.appendChild(sl); if (radar) colA.appendChild(radar); aspects.forEach(function (a) { colA.appendChild(a); });
      var full = [];
      $$(":scope > .list-block", card).forEach(function (lb) {
        var t = ($(".list-title", lb) || {}).textContent || "";
        if (/love|slips|next steps/i.test(t)) colB.appendChild(lb); else full.push(lb);
      });
      grid.appendChild(colA); grid.appendChild(colB);
      card.insertBefore(grid, full[0] || $(".save-btn-row", card) || null);
      full.forEach(function (lb) {
        var cs = $$(".campaign-card", lb);
        if (cs.length) { var cg = h("div", "enh-cgrid"); cs[0].parentNode.insertBefore(cg, cs[0]); cs.forEach(function (c) { cg.appendChild(c); }); }
      });
    });
  }

  // compare view: animated colour legend and bars handled by generic enhancers
  function enhanceWelcome() {
    var e = document.getElementById("emptyState");
    if (!e || e.dataset.rich) return;
    e.dataset.rich = "1";
    var msg = e.textContent.trim();
    e.textContent = "";
    var w = h("div", "enh-welcome");
    var l = h("div");
    l.innerHTML = "<small>AI REVIEW INTELLIGENCE</small><h2>See what your customers <span>really</span> think.</h2>";
    var p = h("p", "", msg); l.appendChild(p);
    var feats = h("div", "enh-feats");
    [["Aspect scores", "M4 20V10M10 20V4M16 20v-7M22 20V8"], ["What guests love", "M12 21s-7-4.4-9-9a5 5 0 019-3 5 5 0 019 3c-2 4.6-9 9-9 9z"], ["Next steps", "M5 12h14M13 6l6 6-6 6"], ["Trend tracking", "M3 17l6-6 4 4 8-8"]].forEach(function (f) {
      var c = h("span", "enh-feat"); var s = sv("svg", { viewBox: "0 0 24 24" }); s.appendChild(sv("path", { d: f[1] })); c.appendChild(s); c.appendChild(document.createTextNode(f[0])); feats.appendChild(c);
    });
    l.appendChild(feats); w.appendChild(l);
    var d = h("div", "enh-demo");
    var rows = [["Food", 88, "#7FA10A"], ["Service", 76, "#F69500"], ["Ambience", 84, "#7FA10A"], ["Value", 70, "#F69500"], ["Wait time", 44, "#E0522D"]];
    d.innerHTML = '<div class="dt"><div><div class="dn">Example: Harbour Street Café</div><div class="ds">Sample report</div></div><div class="dr">4.3<i> /5</i></div></div>' +
      rows.map(function (r, i) { return '<div class="row"><b>' + r[0] + '</b><div class="tr"><i style="--w:' + r[1] + '%;--c:' + r[2] + ';--d:' + (i * 0.12) + 's"></i></div><em>' + (r[1] / 20).toFixed(1) + '</em></div>'; }).join("");
    w.appendChild(d); e.appendChild(w);
  }

  // ---------------------------------------------------------------- scan loop
  var queued = false;
  function scan() {
    queued = false;
    var root = document.querySelector(".main") || document;
    enhanceWelcome();
    enhanceReport(root);
    enhanceBars(root);
    enhanceRadar(root);
    enhanceTrend(root);
    enhanceRise(root);
  }
  function queue() { if (!queued) { queued = true; requestAnimationFrame(scan); } }
  new MutationObserver(queue).observe(document.body, { childList: true, subtree: true });
  scan();
})();
