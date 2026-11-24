/* Minecrifty Web — panel de Perfil (foto, usuario, nametag y skin de Minecraft Bedrock).
 * Los datos se guardan en Supabase: tabla "profiles" y buckets "avatars" y "skins" (ver supabase/setup.sql).
 * Usa la sesión de auth.js (window.MCAuth). Los cambios se guardan todos juntos con el botón "Guardar". */
(function () {
  "use strict";

  var A = window.MCAuth;
  if (!A) return;

  var t = A.t;
  var MAX_AVATAR_IN = 5 * 1024 * 1024;   // foto original que se acepta (se reduce antes de subir)
  var MAX_SKIN = 250 * 1024;
  var SKIN_SIZES = [[64, 32], [64, 64], [128, 128]];
  var GAMERTAG_RE = /^[A-Za-z0-9][A-Za-z0-9 #]{0,19}$/;

  var modal = null, form = null, msg = null, lastFocus = null, busy = false;
  var st = null;   // cambios pendientes

  function el(tag, cls) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    return n;
  }
  function freshState() {
    return { avatarBlob: null, avatarUrl: "", avatarRemove: false, skinBlob: null, skinImg: null, skinRemove: false };
  }
  function revoke() { if (st && st.avatarUrl) URL.revokeObjectURL(st.avatarUrl); }

  /* ---------------- Construcción ---------------- */
  function build() {
    modal = el("div", "auth-modal profile-modal");
    modal.hidden = true;
    modal.innerHTML =
      '<div class="auth-backdrop" data-p-close></div>' +
      '<div class="auth-wrap">' +
      '<div class="auth-dialog profile-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-title">' +
      '  <button type="button" class="auth-x" data-p-close data-i18n-attr="aria-label:auth.close" aria-label="Cerrar">×</button>' +
      '  <h2 id="profile-title" class="auth-title" data-i18n="profile.title">Tu perfil</h2>' +
      '  <p class="auth-msg" role="status" aria-live="polite" hidden></p>' +
      '  <form class="auth-form profile-form" novalidate>' +
      '    <div class="pf-row">' +
      '      <span class="avatar pf-avatar" aria-hidden="true"></span>' +
      '      <div class="pf-actions">' +
      '        <span class="pf-label mono" data-i18n="profile.photo">Foto de perfil</span>' +
      '        <div class="pf-btns">' +
      '          <button type="button" class="pf-btn" data-p-photo data-i18n="profile.photo.change">Cambiar foto</button>' +
      '          <button type="button" class="pf-btn pf-btn-quiet" data-p-photo-remove data-i18n="profile.photo.remove">Quitar foto</button>' +
      '        </div>' +
      '        <input type="file" hidden accept="image/png,image/jpeg,image/webp" data-p-photo-input>' +
      '      </div>' +
      '    </div>' +
      '    <label class="auth-field"><span data-i18n="profile.username">Nombre de usuario</span><input type="text" name="username" maxlength="32" autocomplete="nickname" required></label>' +
      '    <label class="auth-field"><span data-i18n="profile.email">Correo electrónico</span><input type="email" name="email" readonly autocomplete="email"></label>' +
      '    <label class="auth-field"><span data-i18n="profile.gamertag">Nametag de Minecraft Bedrock</span><input type="text" name="gamertag" maxlength="20" autocomplete="off" spellcheck="false"><small class="pf-hint" data-i18n="profile.gamertag.hint"></small></label>' +
      '    <div class="pf-row pf-skin">' +
      '      <canvas class="pf-skin-canvas is-empty" width="16" height="32" aria-hidden="true"></canvas>' +
      '      <div class="pf-actions">' +
      '        <span class="pf-label mono" data-i18n="profile.skin">Skin de Minecraft Bedrock</span>' +
      '        <small class="pf-hint" data-i18n="profile.skin.hint"></small>' +
      '        <div class="pf-btns">' +
      '          <button type="button" class="pf-btn" data-p-skin data-i18n="profile.skin.upload">Subir skin</button>' +
      '          <button type="button" class="pf-btn pf-btn-quiet" data-p-skin-remove data-i18n="profile.skin.remove">Quitar skin</button>' +
      '        </div>' +
      '        <input type="file" hidden accept="image/png" data-p-skin-input>' +
      '      </div>' +
      '    </div>' +
      '    <button type="submit" class="btn btn-primary auth-submit" data-i18n="profile.save">Guardar cambios</button>' +
      '  </form>' +
      '</div>' +
      '</div>';
    document.body.appendChild(modal);

    form = modal.querySelector("form");
    msg = modal.querySelector(".auth-msg");

    modal.addEventListener("click", function (e) {
      var q = function (s) { return e.target.closest(s); };
      if (q("[data-p-close]")) return close();
      if (q("[data-p-photo]")) return modal.querySelector("[data-p-photo-input]").click();
      if (q("[data-p-photo-remove]")) return removePhoto();
      if (q("[data-p-skin]")) return modal.querySelector("[data-p-skin-input]").click();
      if (q("[data-p-skin-remove]")) return removeSkin();
    });
    modal.querySelector("[data-p-photo-input]").addEventListener("change", onPhoto);
    modal.querySelector("[data-p-skin-input]").addEventListener("change", onSkin);
    form.addEventListener("submit", save);
    form.username.addEventListener("input", function () { if (!hasAvatar()) paintPhoto(); });
    modal.addEventListener("keydown", trapFocus);
    applyText();
  }

  function trapFocus(e) {
    if (e.key !== "Tab") return;
    var f = Array.prototype.filter.call(
      modal.querySelectorAll("button, input, [href]"),
      function (n) { return !n.disabled && !n.hidden && n.type !== "file" && n.offsetParent !== null; }
    );
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function applyText() {
    if (!modal) return;
    modal.querySelectorAll("[data-i18n]").forEach(function (n) { n.textContent = t(n.getAttribute("data-i18n")); });
    modal.querySelectorAll("[data-i18n-attr]").forEach(function (n) {
      n.getAttribute("data-i18n-attr").split(",").forEach(function (p) {
        var kv = p.split(":"); n.setAttribute(kv[0], t(kv[1]));
      });
    });
  }

  function showMsg(text, kind) {
    msg.textContent = text || "";
    msg.hidden = !text;
    msg.className = "auth-msg" + (kind ? " is-" + kind : "");
  }

  /* ---------------- Abrir / cerrar ---------------- */
  function open() {
    if (!A.user()) return;
    if (!modal) build();
    lastFocus = document.activeElement;
    revoke();
    st = freshState();
    modal.hidden = false;
    document.documentElement.classList.add("auth-open");
    showMsg("");
    fill();
    // Si el perfil aún no se ha cargado (sesión recién restaurada), se pide y se rellena al llegar
    if (!A.profile()) {
      A.reloadProfile().then(function (p) {
        if (A.profileFailed()) showMsg(t("profile.err.load"), "error");
        else if (!modal.hidden) fill();
      });
    }
    setTimeout(function () { form.username.focus(); }, 30);
  }

  function close() {
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    document.documentElement.classList.remove("auth-open");
    revoke();
    st = freshState();
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && modal && !modal.hidden) close();
  });
  document.addEventListener("langchange", applyText);

  /* ---------------- Rellenar ---------------- */
  function profile() { return A.profile() || {}; }
  function hasAvatar() { return !!st.avatarBlob || (!st.avatarRemove && !!profile().avatar_url); }
  function hasSkin() { return !!st.skinBlob || (!st.skinRemove && !!profile().skin_url); }

  function fill() {
    var p = profile(), u = A.user();
    form.username.value = p.username || A.displayName();
    form.email.value = (u && u.email) || "";
    form.gamertag.value = p.bedrock_gamertag || "";
    paintPhoto();
    if (st.skinImg) drawSkin(st.skinImg);
    else if (!st.skinRemove && p.skin_url) {
      var url = p.skin_url;
      loadImage(url, true).then(function (img) { if (!modal.hidden && !st.skinBlob && !st.skinRemove) drawSkin(img); })
        .catch(function () { clearSkin(); });
    } else clearSkin();
    refreshControls();
  }

  function paintPhoto() {
    var node = modal.querySelector(".pf-avatar");
    var url = st.avatarBlob ? st.avatarUrl : (st.avatarRemove ? "" : profile().avatar_url || "");
    A.paintAvatar(node, form.username.value.trim() || A.displayName(), url);
  }

  function refreshControls() {
    modal.querySelector("[data-p-photo-remove]").hidden = !hasAvatar();
    modal.querySelector("[data-p-skin-remove]").hidden = !hasSkin();
  }

  /* ---------------- Imágenes ---------------- */
  function loadImage(src, cors) {
    return new Promise(function (ok, fail) {
      var img = new Image();
      if (cors) img.crossOrigin = "anonymous";
      img.onload = function () { ok(img); };
      img.onerror = function () { fail(new Error("img")); };
      img.src = src;
    });
  }
  function toBlob(canvas, type, q) {
    return new Promise(function (ok) { canvas.toBlob(ok, type, q); });
  }
  function readFile(file) {
    var url = URL.createObjectURL(file);
    return loadImage(url).then(function (img) { URL.revokeObjectURL(url); return img; },
      function (e) { URL.revokeObjectURL(url); throw e; });
  }

  // Foto: recorte cuadrado centrado, 256×256, WEBP (o JPEG si el navegador no puede WEBP)
  function onPhoto(e) {
    var file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    showMsg("");
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return showMsg(t("profile.err.image"), "error");
    if (file.size > MAX_AVATAR_IN) return showMsg(t("profile.err.imagesize"), "error");
    readFile(file).then(function (img) {
      var side = Math.min(img.naturalWidth, img.naturalHeight);
      var c = document.createElement("canvas");
      c.width = c.height = 256;
      var ctx = c.getContext("2d");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, 256, 256);
      return toBlob(c, "image/webp", 0.86).then(function (b) {
        return b && b.type === "image/webp" ? b : toBlob(c, "image/jpeg", 0.9);
      });
    }).then(function (blob) {
      if (!blob) throw new Error("blob");
      revoke();
      st.avatarBlob = blob;
      st.avatarUrl = URL.createObjectURL(blob);
      st.avatarRemove = false;
      paintPhoto();
      refreshControls();
    }).catch(function () { showMsg(t("profile.err.image"), "error"); });
  }

  function removePhoto() {
    revoke();
    st.avatarBlob = null; st.avatarUrl = "";
    st.avatarRemove = true;
    paintPhoto();
    refreshControls();
  }

  // Skin: solo PNG 64×32, 64×64 o 128×128; se vuelve a codificar para dejar solo los píxeles
  function onSkin(e) {
    var file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    showMsg("");
    if (file.type !== "image/png") return showMsg(t("profile.err.skin"), "error");
    if (file.size > MAX_SKIN) return showMsg(t("profile.err.skinsize"), "error");
    readFile(file).then(function (img) {
      var w = img.naturalWidth, h = img.naturalHeight;
      var okSize = SKIN_SIZES.some(function (s) { return s[0] === w && s[1] === h; });
      if (!okSize) throw new Error("size");
      var c = document.createElement("canvas");
      c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, 0, 0);
      return toBlob(c, "image/png").then(function (blob) {
        if (!blob || blob.size > 262144) throw new Error("size");
        st.skinBlob = blob;
        st.skinImg = c;
        st.skinRemove = false;
        drawSkin(c);
        refreshControls();
      });
    }).catch(function () { showMsg(t("profile.err.skin"), "error"); });
  }

  function removeSkin() {
    st.skinBlob = null; st.skinImg = null;
    st.skinRemove = true;
    clearSkin();
    refreshControls();
  }

  /* Vista previa frontal de la skin (cabeza, torso, brazos y piernas, con capa exterior) */
  function drawSkin(src) {
    var cv = modal.querySelector(".pf-skin-canvas");
    var w = src.naturalWidth || src.width, h = src.naturalHeight || src.height;
    var s = w / 64, legacy = h * 2 === w;
    cv.width = 16 * s; cv.height = 32 * s;
    cv.classList.remove("is-empty");
    var ctx = cv.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, cv.width, cv.height);
    function part(sx, sy, pw, ph, dx, dy, flip) {
      if (flip) {
        ctx.save();
        ctx.translate((dx + pw) * s, dy * s);
        ctx.scale(-1, 1);
        ctx.drawImage(src, sx * s, sy * s, pw * s, ph * s, 0, 0, pw * s, ph * s);
        ctx.restore();
      } else {
        ctx.drawImage(src, sx * s, sy * s, pw * s, ph * s, dx * s, dy * s, pw * s, ph * s);
      }
    }
    // base
    part(4, 20, 4, 12, 4, 20);                 // pierna derecha
    part(legacy ? 4 : 20, legacy ? 20 : 52, 4, 12, 8, 20, legacy);   // pierna izquierda
    part(20, 20, 8, 12, 4, 8);                 // torso
    part(44, 20, 4, 12, 0, 8);                 // brazo derecho
    part(legacy ? 44 : 36, legacy ? 20 : 52, 4, 12, 12, 8, legacy); // brazo izquierdo
    part(8, 8, 8, 8, 4, 0);                    // cabeza
    // capa exterior
    if (!legacy) {
      part(4, 36, 4, 12, 4, 20);
      part(4, 52, 4, 12, 8, 20);
      part(20, 36, 8, 12, 4, 8);
      part(44, 36, 4, 12, 0, 8);
      part(52, 52, 4, 12, 12, 8);
    }
    part(40, 8, 8, 8, 4, 0);                   // sombrero / capa de la cabeza
  }
  function clearSkin() {
    var cv = modal.querySelector(".pf-skin-canvas");
    cv.width = 16; cv.height = 32;
    cv.classList.add("is-empty");
  }

  /* ---------------- Guardar ---------------- */
  function setBusy(b) {
    busy = b;
    form.querySelectorAll("button, input").forEach(function (n) {
      if (n.name !== "email") n.disabled = b;
    });
  }

  function upload(bucket, path, blob) {
    var c = A.client();
    return c.storage.from(bucket).upload(path, blob, { upsert: true, contentType: blob.type, cacheControl: "3600" })
      .then(function (res) {
        if (res.error) throw res.error;
        return c.storage.from(bucket).getPublicUrl(path).data.publicUrl + "?v=" + Date.now();
      });
  }
  function removeFile(bucket, path) {
    return A.client().storage.from(bucket).remove([path]).then(function () {}, function () {});
  }

  function save(e) {
    e.preventDefault();
    if (busy || !A.user()) return;
    // Si no se pudo leer el perfil, guardar podría borrar la foto o la skin que ya tiene
    if (A.profileFailed()) return showMsg(t("profile.err.load"), "error");
    var username = form.username.value.trim();
    var gamertag = form.gamertag.value.trim();
    if (!username || Array.from(username).length > 32) return showMsg(t("profile.err.username"), "error");
    if (gamertag && !GAMERTAG_RE.test(gamertag)) return showMsg(t("profile.err.gamertag"), "error");

    showMsg("");
    setBusy(true);
    var uid = A.user().id, p = profile();
    var avatarUrl = p.avatar_url || null;
    var skinUrl = p.skin_url || null;

    var jobs = Promise.resolve();
    if (st.avatarBlob) jobs = jobs.then(function () { return upload("avatars", uid + "/avatar", st.avatarBlob); }).then(function (u) { avatarUrl = u; });
    else if (st.avatarRemove) jobs = jobs.then(function () { avatarUrl = null; return removeFile("avatars", uid + "/avatar"); });
    if (st.skinBlob) jobs = jobs.then(function () { return upload("skins", uid + "/skin.png", st.skinBlob); }).then(function (u) { skinUrl = u; });
    else if (st.skinRemove) jobs = jobs.then(function () { skinUrl = null; return removeFile("skins", uid + "/skin.png"); });

    jobs.then(function () {
      return A.client().from("profiles").upsert({
        id: uid,
        username: username,
        avatar_url: avatarUrl,
        bedrock_gamertag: gamertag || null,
        skin_url: skinUrl
      }).select().single();
    }).then(function (res) {
      if (res.error) throw res.error;
      revoke();
      st = freshState();
      A.setProfile(res.data);
      fill();
      showMsg(t("profile.saved"), "ok");
    }).catch(function () {
      showMsg(t("profile.err.save"), "error");
    }).then(function () { setBusy(false); });
  }

  window.MCProfile = { open: function () { A.ready().then(open, open); } };
})();
