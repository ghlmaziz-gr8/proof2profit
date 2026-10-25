// Connects the portal to Supabase (Google sign-in + storage) and the Worker (AI + search).
// Provides the small `claude.use(...)` surface the app code was written against.
(function () {
  var cfg = window.P2P_CONFIG || {};
  var gate = document.getElementById("authGate");
  var gateMsg = document.getElementById("authMsg");
  var gateBtn = document.getElementById("googleBtn");
  var chip = document.getElementById("userChip");
  var chipEmail = document.getElementById("userEmail");
  var outBtn = document.getElementById("signOutBtn");
  var sb = null, session = null, resolveReady;
  var ready = new Promise(function (r) { resolveReady = r; });

  function setGate(msg, showBtn) {
    gateMsg.textContent = msg || "";
    gateBtn.hidden = !showBtn;
  }

  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY || !cfg.API_URL || !window.supabase) {
    setGate("The portal isn't connected yet. Finish the setup steps in SETUP.md, then reload.", false);
  } else {
    sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    var onSession = function (s) {
      session = s;
      if (s) {
        sb.rpc("is_allowed").then(function (r) {
          if (r.data === true) {
            gate.hidden = true;
            chip.hidden = false;
            chipEmail.textContent = (s.user && s.user.email) || "Signed in";
            resolveReady();
          } else {
            gate.hidden = false;
            chip.hidden = true;
            setGate((s.user && s.user.email ? s.user.email + " " : "This account ") + "isn't on the invite list yet. Proof to Profit is invite-only for now. Contact us to request access.", false);
            if (!document.getElementById("gateOut")) {
              var o = document.createElement("button");
              o.id = "gateOut"; o.type = "button"; o.textContent = "Sign out";
              o.className = gateBtn.className;
              o.addEventListener("click", function () { sb.auth.signOut().then(function () { location.reload(); }); });
              gateBtn.parentNode.appendChild(o);
            }
          }
        });
      } else {
        gate.hidden = false;
        chip.hidden = true;
        setGate("Sign in to analyze businesses and save your reports.", true);
      }
    };
    sb.auth.getSession().then(function (r) { onSession(r.data && r.data.session); });
    sb.auth.onAuthStateChange(function (_e, s) {
      if (s && session && s.user && session.user && s.user.id === session.user.id) { session = s; return; }
      if (!s && session) { location.reload(); return; }
      onSession(s);
    });
    gateBtn.addEventListener("click", function () {
      setGate("Opening Google…", false);
      sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin + location.pathname } })
        .then(function (r) { if (r.error) setGate("Sign-in failed: " + r.error.message, true); });
    });
    outBtn.addEventListener("click", function () { sb.auth.signOut(); });
  }

  function api(path, body) {
    return fetch(cfg.API_URL.replace(/\/$/, "") + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
      body: JSON.stringify(body),
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (r.ok) return d;
        var code = d.error === "rate_limited" ? "rate_limited" : d.error === "prompt_too_large" ? "prompt_too_large" : "error";
        var e = { code: code, message: d.message || d.error || "Request failed" };
        throw e;
      });
    });
  }

  var sample = function (input) {
    var prompt = typeof input === "string" ? input : JSON.stringify(input);
    return api("/sample", { prompt: prompt });
  };
  sample.json = function (input) {
    return sample(input).then(function (r) {
      try { return JSON.parse(r.text); } catch (e) { return r.text; } // app repairs near-JSON itself
    });
  };

  var mcp = {
    callTool: function (_server, _tool, input) {
      return api("/search", { objective: input.objective, search_queries: input.search_queries });
    },
  };

  var user = { id: function () { return Promise.resolve(session.user.id); } };

  var db = {
    doc: function (path) {
      var key = path.split("/kv/")[1];
      return {
        get: function () {
          return sb.from("kv").select("value").eq("key", key).maybeSingle().then(function (r) {
            if (r.error) throw r.error;
            var d = r.data;
            return { exists: !!d, data: function () { return d ? { value: d.value } : undefined; } };
          });
        },
        set: function (obj) {
          return sb.from("kv").upsert({ key: key, value: obj.value, updated_at: new Date().toISOString() }, { onConflict: "user_id,key" })
            .then(function (r) { if (r.error) throw r.error; });
        },
      };
    },
  };

  window.claude = {
    use: function (name) {
      return ready.then(function () {
        if (name === "sample") return sample;
        if (name === "mcp") return mcp;
        if (name === "user") return user;
        if (name === "db") return db;
        return null;
      });
    },
  };
})();
