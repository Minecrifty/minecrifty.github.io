/* Minecrifty Web — cuentas (iniciar sesión / registrarse) con Firebase Authentication.
 * Se activa solo si assets/js/config.js tiene la sección "firebase" completa.
 * El SDK se carga desde el CDN de Google únicamente cuando hay configuración. */
(function () {
  "use strict";

  var cfg = (window.SITE_CONFIG && window.SITE_CONFIG.firebase) || {};
  var configured = !!(cfg.apiKey && cfg.authDomain && cfg.projectId && cfg.appId);
  var SDK = "https://www.gstatic.com/firebasejs/10.12.2/";
  var dict = window.I18N || {};
  var auth = null;
  var user = null;
  var mode = "login"; // "login" | "signup"
  var modal = null;
  var lastFocus = null;
  var busy = false;

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
      '  <div class="auth-tabs" role="tablist">' +
      '    <button type="button" role="tab" data-auth-tab="login" data-i18n="auth.login">Iniciar sesión</button>' +
      '    <button type="button" role="tab" data-auth-tab="signup" data-i18n="auth.signup">Registrarse</button>' +
      '  </div>' +
      '  <h2 id="auth-title" class="auth-title"></h2>' +
      '  <p class="auth-msg" role="status" aria-live="polite" hidden></p>' +
      '  <form class="auth-form" novalidate>' +
      '    <label class="auth-field" data-only="signup"><span data-i18n="auth.name">Nombre de usuario</span><input type="text" name="name" autocomplete="nickname" maxlength="32"></label>' +
      '    <label class="auth-field"><span data-i18n="auth.email">Correo electrónico</span><input type="email" name="email" autocomplete="email" required></label>' +
      '    <label class="auth-field"><span data-i18n="auth.password">Contraseña</span><input type="password" name="password" minlength="8" autocomplete="current-password" required></label>' +
      '    <button type="submit" class="btn btn-primary auth-submit"></button>' +
      '  </form>' +
      '  <button type="button" class="auth-link" data-auth-forgot data-only="login" data-i18n="auth.forgot">¿Olvidaste tu contraseña?</button>' +
      '  <div class="auth-or mono"><span data-i18n="auth.or">o</span></div>' +
      '  <button type="button" class="auth-google" data-auth-google><svg viewBox="0 0 18 18" aria-hidden="true"><path fill="#EA4335" d="M9 3.6c1.3 0 2.5.5 3.4 1.3l2.5-2.5A8.6 8.6 0 0 0 9 .4 8.6 8.6 0 0 0 1.4 5l2.9 2.3C5 5.1 6.9 3.6 9 3.6z"/><path fill="#4285F4" d="M17.6 9.2c0-.6-.1-1.1-.2-1.6H9v3.1h4.8a4.1 4.1 0 0 1-1.8 2.7l2.8 2.2c1.7-1.5 2.8-3.8 2.8-6.4z"/><path fill="#FBBC05" d="M4.3 10.7a5.2 5.2 0 0 1 0-3.4L1.4 5a8.6 8.6 0 0 0 0 7.9l2.9-2.2z"/><path fill="#34A853" d="M9 17.6c2.3 0 4.2-.8 5.6-2.1l-2.8-2.2c-.8.5-1.7.8-2.8.8-2.1 0-3.9-1.4-4.7-3.3L1.4 12.9A8.6 8.6 0 0 0 9 17.6z"/></svg><span data-i18n="auth.google">Continuar con Google</span></button>' +
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
    modal.querySelector(".auth-title").textContent = t(mode === "login" ? "auth.title.login" : "auth.title.signup");
    modal.querySelector(".auth-submit").textContent = t(mode === "login" ? "auth.login" : "auth.signup");
  }

  function setMode(m) {
    mode = m;
    modal.querySelectorAll("[data-auth-tab]").forEach(function (b) {
      b.setAttribute("aria-selected", b.getAttribute("data-auth-tab") === m ? "true" : "false");
    });
    modal.querySelectorAll("[data-only]").forEach(function (n) { n.hidden = n.getAttribute("data-only") !== m; });
    modal.querySelector('[name="password"]').autocomplete = m === "login" ? "current-password" : "new-password";
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
    var first = form.querySelector(m === "signup" ? '[name="name"]' : '[name="email"]');
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

  /* ---------------- Firebase ---------------- */
  var sdkPromise = null;
  function loadScript(src) {
    return new Promise(function (ok, fail) {
      var s = document.createElement("script");
      s.src = src; s.async = true;
      s.onload = ok; s.onerror = function () { fail(new Error("sdk")); };
      document.head.appendChild(s);
    });
  }
  function loadSdk() {
    if (sdkPromise) return sdkPromise;
    sdkPromise = loadScript(SDK + "firebase-app-compat.js")
      .then(function () { return loadScript(SDK + "firebase-auth-compat.js"); })
      .then(function () {
        window.firebase.initializeApp(cfg);
        auth = window.firebase.auth();
        auth.useDeviceLanguage();
        auth.onAuthStateChanged(function (u) { user = u; renderButtons(); });
      })
      .catch(function (e) { sdkPromise = null; throw e; });
    return sdkPromise;
  }

  // Al iniciar sesión o registrarse con éxito: el personaje festeja y luego se cierra el panel
  function celebrateAndClose() {
    if (!window.MCChar) return closeModal();
    return MCChar.celebrate(1900).then(closeModal);
  }

  function errText(e) {
    var code = (e && e.code) || "";
    var map = {
      "auth/invalid-credential": "auth.err.credential",
      "auth/wrong-password": "auth.err.credential",
      "auth/user-not-found": "auth.err.credential",
      "auth/invalid-email": "auth.err.email",
      "auth/email-already-in-use": "auth.err.inuse",
      "auth/weak-password": "auth.err.weak",
      "auth/too-many-requests": "auth.err.many",
      "auth/network-request-failed": "auth.err.network",
      "auth/unauthorized-domain": "auth.err.domain",
      "auth/operation-not-allowed": "auth.err.disabled"
    };
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return "";
    if (e && e.message === "sdk") return t("auth.err.network");
    return t(map[code] || "auth.err.generic");
  }

  function setBusy(b) {
    busy = b;
    modal.querySelectorAll(".auth-submit, [data-auth-google], [data-auth-forgot]").forEach(function (n) { n.disabled = b; });
  }

  function run(fn, okMsg) {
    if (busy) return;
    showMsg("");
    setBusy(true);
    loadSdk().then(fn).then(function () {
      if (okMsg) showMsg(t(okMsg), "ok");
    }).catch(function (e) {
      var m = errText(e);
      if (m) showMsg(m, "error");
    }).then(function () { setBusy(false); });
  }

  function submit(e) {
    e.preventDefault();
    var f = e.target;
    var email = f.email.value.trim();
    var pass = f.password.value;
    var name = f.name.value.trim();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) return showMsg(t("auth.err.email"), "error");
    if (mode === "signup" && pass.length < 8) return showMsg(t("auth.err.weak"), "error");
    if (!pass) return showMsg(t("auth.err.credential"), "error");

    if (mode === "login") {
      run(function () {
        return auth.signInWithEmailAndPassword(email, pass).then(celebrateAndClose);
      });
    } else {
      run(function () {
        return auth.createUserWithEmailAndPassword(email, pass).then(function (cred) {
          var jobs = [];
          if (name) jobs.push(cred.user.updateProfile({ displayName: name }));
          jobs.push(cred.user.sendEmailVerification().catch(function () {}));
          return Promise.all(jobs).then(function () { user = auth.currentUser; renderButtons(); return celebrateAndClose(); });
        });
      });
    }
  }

  function googleSignIn() {
    run(function () {
      var provider = new window.firebase.auth.GoogleAuthProvider();
      return auth.signInWithPopup(provider).then(celebrateAndClose);
    });
  }

  function forgot() {
    var email = modal.querySelector('[name="email"]').value.trim();
    if (!email) return showMsg(t("auth.reset.needemail"), "error");
    run(function () { return auth.sendPasswordResetEmail(email); }, "auth.reset.sent");
  }

  /* ---------------- Botones del encabezado ---------------- */
  function renderButtons() {
    document.querySelectorAll(".auth-split").forEach(function (box) {
      var left = box.querySelector(".auth-login, .auth-user");
      var right = box.querySelector(".auth-signup, .auth-logout");
      if (user) {
        left.className = "auth-user";
        left.setAttribute("data-auth", "user");
        left.removeAttribute("data-i18n");
        left.textContent = user.displayName || (user.email || "").split("@")[0];
        left.title = user.email || "";
        right.className = "auth-logout";
        right.setAttribute("data-auth", "logout");
        right.setAttribute("data-i18n", "auth.logout");
        right.textContent = t("auth.logout");
      } else {
        left.className = "auth-login";
        left.setAttribute("data-auth", "login");
        left.setAttribute("data-i18n", "auth.login");
        left.removeAttribute("title");
        left.textContent = t("auth.login");
        right.className = "auth-signup";
        right.setAttribute("data-auth", "signup");
        right.setAttribute("data-i18n", "auth.signup");
        right.textContent = t("auth.signup");
      }
    });
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
    } else if (a === "logout" && auth) {
      auth.signOut();
    }
  });

  document.addEventListener("langchange", function () { applyModalText(); renderButtons(); });

  // Restaurar la sesión al cargar cualquier página
  if (configured) loadSdk().catch(function () {});
})();
