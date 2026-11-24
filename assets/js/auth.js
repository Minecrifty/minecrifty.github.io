/* Minecrifty Web — cuentas (iniciar sesión / registrarse / menú de usuario) con Supabase Auth.
 * Se activa solo si assets/js/config.js tiene "supabase.url" y "supabase.anonKey".
 * El SDK se carga desde el CDN (jsDelivr, versión fija) únicamente cuando hay configuración.
 * Expone window.MCAuth para que profile.js use la sesión y el cliente. */
(function () {
  "use strict";

  var cfg = (window.SITE_CONFIG && window.SITE_CONFIG.supabase) || {};
  var configured = !!(cfg.url && cfg.anonKey);
  var SDK = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js";
  var HINT_KEY = "mc.hint";
  var dict = window.I18N || {};
  var client = null;
  var user = null;
  var profile = null;
  var profileFailed = false; // la última carga del perfil falló (no confundir con "aún no tiene fila")
  var resolved = false;      // ya se supo si hay sesión o no
  var hint = readHint();     // nombre/foto guardados para pintar el círculo sin parpadeo
  var mode = "login";        // "login" | "signup" | "recover"
  var modal = null;
  var lastFocus = null;
  var busy = false;
  var menu = null;

  function lang() { return (document.documentElement.lang || "es").indexOf("en") === 0 ? "en" : "es"; }
  function t(key) {
    var l = lang();
    if (dict[l] && dict[l][key] != null) return dict[l][key];
    if (dict.es && dict.es[key] != null) return dict.es[key];
    return key;
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  /* ---------------- Modal ---------------- */
  function buildModal() {
    modal = el("div", "auth-modal");
    modal.hidden = true;
    modal.innerHTML =
      '<div class="auth-backdrop" data-auth-close></div>' +
      '<div class="auth-wrap">' +
      '<div class="auth-stage" aria-hidden="true"></div>' +
      '<div class="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">' +
      '  <button type="button" class="auth-x" data-auth-close data-i18n-attr="aria-label:auth.close" aria-label="Cerrar">×</button>' +
      '  <div class="auth-tabs" role="tablist" data-only="login signup">' +
      '    <button type="button" role="tab" data-auth-tab="login" data-i18n="auth.login">Iniciar sesión</button>' +
      '    <button type="button" role="tab" data-auth-tab="signup" data-i18n="auth.signup">Registrarse</button>' +
      '  </div>' +
      '  <h2 id="auth-title" class="auth-title"></h2>' +
      '  <p class="auth-msg" role="status" aria-live="polite" hidden></p>' +
      '  <form class="auth-form" novalidate>' +
      '    <label class="auth-field" data-only="signup"><span data-i18n="auth.name">Nombre de usuario</span><input type="text" name="name" autocomplete="nickname" maxlength="32"></label>' +
      '    <label class="auth-field" data-only="login signup"><span data-i18n="auth.email">Correo electrónico</span><input type="email" name="email" autocomplete="email" required></label>' +
      '    <label class="auth-field"><span data-i18n="auth.password">Contraseña</span><input type="password" name="password" minlength="8" autocomplete="current-password" required></label>' +
      '    <button type="submit" class="btn btn-primary auth-submit"></button>' +
      '  </form>' +
      '  <button type="button" class="auth-link" data-auth-forgot data-only="login" data-i18n="auth.forgot">¿Olvidaste tu contraseña?</button>' +
      '  <div class="auth-or mono" data-only="login signup"><span data-i18n="auth.or">o</span></div>' +
      '  <button type="button" class="auth-google" data-auth-google data-only="login signup"><svg viewBox="0 0 18 18" aria-hidden="true"><path fill="#EA4335" d="M9 3.6c1.3 0 2.5.5 3.4 1.3l2.5-2.5A8.6 8.6 0 0 0 9 .4 8.6 8.6 0 0 0 1.4 5l2.9 2.3C5 5.1 6.9 3.6 9 3.6z"/><path fill="#4285F4" d="M17.6 9.2c0-.6-.1-1.1-.2-1.6H9v3.1h4.8a4.1 4.1 0 0 1-1.8 2.7l2.8 2.2c1.7-1.5 2.8-3.8 2.8-6.4z"/><path fill="#FBBC05" d="M4.3 10.7a5.2 5.2 0 0 1 0-3.4L1.4 5a8.6 8.6 0 0 0 0 7.9l2.9-2.2z"/><path fill="#34A853" d="M9 17.6c2.3 0 4.2-.8 5.6-2.1l-2.8-2.2c-.8.5-1.7.8-2.8.8-2.1 0-3.9-1.4-4.7-3.3L1.4 12.9A8.6 8.6 0 0 0 9 17.6z"/></svg><span data-i18n="auth.google">Continuar con Google</span></button>' +
      '</div>' +
      '</div>';
    document.body.appendChild(modal);

    modal.addEventListener("click", function (e) {
      if (e.target.closest("[data-auth-close]")) return closeModal();
      var tab = e.target.closest("[data-auth-tab]");
      if (tab) return setMode(tab.getAttribute("data-auth-tab"));
      if (e.target.closest("[data-auth-google]")) return googleSignIn();
      if (e.target.closest("[data-auth-forgot]")) return forgot();
    });
    modal.querySelector("form").addEventListener("submit", submit);
    if (window.MCChar) MCChar.mount(modal.querySelector(".auth-stage"));
    var form = modal.querySelector("form"), idleTimer = 0;
    form.addEventListener("focusin", function (e) {
      clearTimeout(idleTimer);
      var n = e.target.name;
      if (window.MCChar) MCChar.setState(n === "email" ? "curious" : n === "password" ? "closed" : "idle");
    });
    form.addEventListener("focusout", function () {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(function () { if (window.MCChar) MCChar.setState("idle"); }, 0);
    });
    modal.addEventListener("keydown", trapFocus);
  }

  function trapFocus(e) {
    if (e.key !== "Tab") return;
    var f = Array.prototype.filter.call(
      modal.querySelectorAll("button, input, [href]"),
      function (n) { return !n.disabled && n.offsetParent !== null; }
    );
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function applyModalText() {
    if (!modal) return;
    modal.querySelectorAll("[data-i18n]").forEach(function (n) { n.textContent = t(n.getAttribute("data-i18n")); });
    modal.querySelectorAll("[data-i18n-attr]").forEach(function (n) {
      n.getAttribute("data-i18n-attr").split(",").forEach(function (p) {
        var kv = p.split(":"); n.setAttribute(kv[0], t(kv[1]));
      });
    });
    var titles = { login: "auth.title.login", signup: "auth.title.signup", recover: "auth.title.recover" };
    var submits = { login: "auth.login", signup: "auth.signup", recover: "auth.recover.save" };
    modal.querySelector(".auth-title").textContent = t(titles[mode]);
    modal.querySelector(".auth-submit").textContent = t(submits[mode]);
  }

  function setMode(m) {
    mode = m;
    modal.querySelectorAll("[data-auth-tab]").forEach(function (b) {
      b.setAttribute("aria-selected", b.getAttribute("data-auth-tab") === m ? "true" : "false");
    });
    modal.querySelectorAll("[data-only]").forEach(function (n) { n.hidden = n.getAttribute("data-only").split(" ").indexOf(m) < 0; });
    modal.querySelector('[name="password"]').autocomplete = m === "login" ? "current-password" : "new-password";
    modal.querySelector(".auth-form").setAttribute("data-mode", m);
    showMsg("");
    applyModalText();
  }

  function showMsg(text, kind) {
    var p = modal.querySelector(".auth-msg");
    p.textContent = text || "";
    p.hidden = !text;
    p.className = "auth-msg" + (kind ? " is-" + kind : "");
  }

  function openModal(m) {
    if (!modal) buildModal();
    lastFocus = document.activeElement;
    modal.hidden = false;
    document.documentElement.classList.add("auth-open");
    setMode(m);
    var form = modal.querySelector("form");
    var off = !configured;
    Array.prototype.forEach.call(modal.querySelectorAll("input, .auth-submit, [data-auth-google], [data-auth-forgot]"), function (n) { n.disabled = off; });
    if (off) showMsg(t("auth.notconfigured"), "error");
    var first = form.querySelector(m === "signup" ? '[name="name"]' : m === "recover" ? '[name="password"]' : '[name="email"]');
    setTimeout(function () { (off ? modal.querySelector(".auth-x") : first).focus(); }, 30);
    if (configured) loadSdk();
    if (window.MCChar) { MCChar.setState("idle"); MCChar.start(); }
  }

  function closeModal() {
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    document.documentElement.classList.remove("auth-open");
    if (window.MCChar) MCChar.reset();
    modal.querySelector("form").reset();
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeModal(); });

  /* ---------------- Supabase ---------------- */
  var sdkPromise = null;
  function loadScript(src) {
    return new Promise(function (ok, fail) {
      var el2 = document.createElement("script");
      el2.src = src; el2.async = true;
      el2.onload = ok; el2.onerror = function () { fail(new Error("sdk")); };
      document.head.appendChild(el2);
    });
  }
  function loadSdk() {
    if (sdkPromise) return sdkPromise;
    sdkPromise = loadScript(SDK)
      .then(function () {
        client = window.supabase.createClient(cfg.url, cfg.anonKey, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
        });
        client.auth.onAuthStateChange(onAuthChange);
        return client;
      })
      .catch(function (e) { sdkPromise = null; throw e; });
    return sdkPromise;
  }

  // No se llama a Supabase dentro del propio callback (puede bloquearse): se difiere un tick.
  function onAuthChange(event, session) {
    setTimeout(function () {
      var next = (session && session.user) || null;
      var changed = (next && next.id) !== (user && user.id);
      user = next;
      resolved = true;
      if (!user) { profile = null; saveHint(); }
      else if (changed || !profile) { profile = null; loadProfile(); }
      renderUser();
      if (event === "PASSWORD_RECOVERY") openModal("recover");
      document.dispatchEvent(new CustomEvent("authchange", { detail: { user: user } }));
    }, 0);
  }

  function loadProfile() {
    if (!client || !user) return Promise.resolve(null);
    var uid = user.id;
    return client.from("profiles").select("*").eq("id", uid).maybeSingle().then(function (res) {
      if (!user || user.id !== uid) return null;
      if (res.error) throw res.error;
      profile = res.data || null;
      profileFailed = false;
      saveHint();
      renderUser();
      document.dispatchEvent(new CustomEvent("profilechange", { detail: { profile: profile } }));
      return profile;
    }).catch(function () { profileFailed = true; return null; });
  }

  // Al iniciar sesión o registrarse con éxito: el personaje festeja y luego se cierra el panel
  function celebrateAndClose() {
    if (!window.MCChar) return closeModal();
    return MCChar.celebrate(1900).then(closeModal);
  }

  function errText(e) {
    var code = (e && (e.code || e.error_code)) || "";
    var msg = (e && e.message) || "";
    var map = {
      invalid_credentials: "auth.err.credential",
      user_already_exists: "auth.err.inuse",
      email_exists: "auth.err.inuse",
      weak_password: "auth.err.weak",
      over_request_rate_limit: "auth.err.many",
      over_email_send_rate_limit: "auth.err.many",
      email_not_confirmed: "auth.err.unconfirmed",
      validation_failed: "auth.err.email",
      email_address_invalid: "auth.err.email",
      provider_disabled: "auth.err.disabled",
      signup_disabled: "auth.err.disabled"
    };
    if (map[code]) return t(map[code]);
    if (msg === "sdk" || (e && e.name === "AuthRetryableFetchError") || /failed to fetch|network/i.test(msg)) return t("auth.err.network");
    if (/invalid login credentials/i.test(msg)) return t("auth.err.credential");
    if (/already (been )?registered/i.test(msg)) return t("auth.err.inuse");
    if (/not confirmed/i.test(msg)) return t("auth.err.unconfirmed");
    if (/password.*(at least|weak|short)/i.test(msg)) return t("auth.err.weak");
    if (/rate limit|too many/i.test(msg)) return t("auth.err.many");
    return t("auth.err.generic");
  }

  function setBusy(b) {
    busy = b;
    modal.querySelectorAll(".auth-submit, [data-auth-google], [data-auth-forgot]").forEach(function (n) { n.disabled = b; });
  }

  function run(fn) {
    if (busy) return;
    showMsg("");
    setBusy(true);
    loadSdk().then(fn).catch(function (e) {
      var m = errText(e);
      if (m) showMsg(m, "error");
    }).then(function () { setBusy(false); });
  }

  function redirectUrl() {
    return /^https?:/.test(location.origin) ? location.origin + location.pathname : undefined;
  }
  function check(res) { if (res && res.error) throw res.error; return res; }

  function submit(e) {
    e.preventDefault();
    var f = e.target;
    var email = f.email.value.trim();
    var pass = f.password.value;
    var name = f.name.value.trim();

    if (mode === "recover") {
      if (pass.length < 8) return showMsg(t("auth.err.weak"), "error");
      return run(function () {
        return client.auth.updateUser({ password: pass }).then(check).then(function () {
          showMsg(t("auth.recover.ok"), "ok");
          f.reset();
          setTimeout(closeModal, 1400);
        });
      });
    }

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) return showMsg(t("auth.err.email"), "error");
    if (mode === "signup" && pass.length < 8) return showMsg(t("auth.err.weak"), "error");
    if (!pass) return showMsg(t("auth.err.credential"), "error");

    if (mode === "login") {
      run(function () {
        return client.auth.signInWithPassword({ email: email, password: pass }).then(check).then(celebrateAndClose);
      });
    } else {
      run(function () {
        return client.auth.signUp({
          email: email,
          password: pass,
          options: { data: { username: name }, emailRedirectTo: redirectUrl() }
        }).then(check).then(function (res) {
          var d = res.data || {};
          // Con la confirmación por correo activada, un correo ya registrado devuelve un usuario sin identidades
          if (d.user && d.user.identities && d.user.identities.length === 0) throw { code: "user_already_exists" };
          if (d.session) return celebrateAndClose();
          showMsg(t("auth.confirm.sent"), "ok");
        });
      });
    }
  }

  function googleSignIn() {
    run(function () {
      return client.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectUrl() } }).then(check);
    });
  }

  function forgot() {
    var email = modal.querySelector('[name="email"]').value.trim();
    if (!email) return showMsg(t("auth.reset.needemail"), "error");
    run(function () {
      return client.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl() }).then(check).then(function () {
        showMsg(t("auth.reset.sent"), "ok");
      });
    });
  }

  /* ---------------- Círculo de usuario y menú ---------------- */
  function readHint() {
    try { return JSON.parse(localStorage.getItem(HINT_KEY) || "null"); } catch (e) { return null; }
  }
  function saveHint() {
    try {
      if (user) {
        hint = { n: displayName(), a: (profile && profile.avatar_url) || "" };
        localStorage.setItem(HINT_KEY, JSON.stringify(hint));
      } else {
        hint = null;
        localStorage.removeItem(HINT_KEY);
      }
    } catch (e) {}
  }

  function displayName() {
    if (profile && profile.username) return profile.username;
    if (user) {
      var m = user.user_metadata || {};
      return m.username || m.full_name || m.name || (user.email || "").split("@")[0] || "?";
    }
    return (hint && hint.n) || "?";
  }
  function initial(name) {
    var c = Array.from(String(name || "?").trim())[0] || "?";
    return c.toUpperCase();
  }
  // Foto si existe; si no (o si falla al cargar), la inicial del usuario
  function paintAvatar(node, name, url) {
    node.textContent = "";
    if (url) {
      var img = document.createElement("img");
      img.alt = "";
      img.decoding = "async";
      img.onerror = function () { paintAvatar(node, name, ""); };
      img.src = url;
      node.appendChild(img);
    } else {
      node.textContent = initial(name);
    }
  }

  function buildMenu() {
    var bar = document.querySelector(".site-header .bar");
    if (!bar || menu) return;
    menu = el("div", "user-menu");
    menu.hidden = true;
    menu.innerHTML =
      '<button type="button" class="user-btn" aria-haspopup="menu" aria-expanded="false" data-i18n-attr="aria-label:user.menu" aria-label="Menú de usuario"><span class="avatar"></span></button>' +
      '<div class="user-pop" role="menu" hidden>' +
      '  <div class="user-pop-head"><strong class="user-pop-name"></strong><small class="user-pop-email"></small></div>' +
      '  <button type="button" role="menuitem" data-user="profile" data-i18n="user.profile">Perfil</button>' +
      '  <button type="button" role="menuitem" data-user="logout" data-i18n="auth.logout">Cerrar sesión</button>' +
      '</div>';
    bar.insertBefore(menu, bar.querySelector(".nav-toggle"));

    var btn = menu.querySelector(".user-btn");
    btn.addEventListener("click", function () { togglePop(); });
    menu.querySelector(".user-pop").addEventListener("click", function (e) {
      var b = e.target.closest("[data-user]");
      if (!b) return;
      togglePop(false);
      if (b.getAttribute("data-user") === "logout") signOut();
      else if (window.MCProfile) window.MCProfile.open();
    });
    document.addEventListener("click", function (e) { if (menu && !menu.contains(e.target)) togglePop(false); });
    menu.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { togglePop(false); btn.focus(); }
    });
    applyMenuText();
  }

  function togglePop(open) {
    if (!menu) return;
    var pop = menu.querySelector(".user-pop");
    var btn = menu.querySelector(".user-btn");
    var show = open == null ? pop.hidden : open;
    pop.hidden = !show;
    btn.setAttribute("aria-expanded", String(show));
    if (show) {
      var hd = document.querySelector(".site-header");
      var tg = document.querySelector(".nav-toggle");
      if (hd && tg && hd.classList.contains("nav-open")) tg.click();
    }
  }

  function applyMenuText() {
    if (!menu) return;
    menu.querySelectorAll("[data-i18n]").forEach(function (n) { n.textContent = t(n.getAttribute("data-i18n")); });
    menu.querySelectorAll("[data-i18n-attr]").forEach(function (n) {
      n.getAttribute("data-i18n-attr").split(",").forEach(function (p) {
        var kv = p.split(":"); n.setAttribute(kv[0], t(kv[1]));
      });
    });
  }

  function signOut() {
    user = null; profile = null; saveHint(); renderUser();
    if (client) client.auth.signOut().catch(function () {});
  }

  function renderUser() {
    // Mientras no se sabe si la sesión sigue activa, se usa lo guardado para evitar el parpadeo
    var active = !!user || (!resolved && !!hint && configured);
    document.documentElement.classList.toggle("has-user", active);
    if (!menu) return;
    menu.hidden = !active;   // no depende solo del CSS: sin sesión el círculo nunca se muestra
    var name = displayName();
    var url = (profile && profile.avatar_url) || (!user && !resolved && hint && hint.a) || "";
    paintAvatar(menu.querySelector(".avatar"), name, url);
    menu.querySelector(".user-pop-name").textContent = name;
    menu.querySelector(".user-pop-email").textContent = (user && user.email) || "";
    if (!active) togglePop(false);
  }

  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-auth]");
    if (!b || b.closest(".auth-modal")) return;
    var a = b.getAttribute("data-auth");
    if (a === "login" || a === "signup") {
      var hd = document.querySelector(".site-header");
      var tg = document.querySelector(".nav-toggle");
      if (hd && tg && hd.classList.contains("nav-open")) tg.click();
      openModal(a);
    }
  });

  document.addEventListener("langchange", function () { applyModalText(); applyMenuText(); renderUser(); });

  window.MCAuth = {
    configured: configured,
    ready: function () { return loadSdk(); },
    client: function () { return client; },
    user: function () { return user; },
    profile: function () { return profile; },
    displayName: displayName,
    initial: initial,
    paintAvatar: paintAvatar,
    setProfile: function (p) { profile = p; saveHint(); renderUser(); },
    reloadProfile: loadProfile,
    profileFailed: function () { return profileFailed; },
    t: t
  };

  buildMenu();
  renderUser();
  // Restaurar la sesión al cargar cualquier página
  if (configured) loadSdk().catch(function () { resolved = true; renderUser(); });
})();
