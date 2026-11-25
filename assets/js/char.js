/* Minecrifty Web — personaje en 3D armado con CSS a partir de la skin de Minecraft.
 *
 * Skins (64×64) en assets/img/skin/: normal.png, curious.png (ojo curioso), closed.png (ojos cerrados).
 * Solo cambia la cara; el resto de la skin es igual en las tres.
 *
 * Estados: "idle" (la cabeza sigue al mouse), "curious" (escribiendo el correo),
 *          "closed" (escribiendo la contraseña), "celebrate" (brazos y piernas en V + confeti).
 *
 * Brazos, piernas y salto se animan con resortes en JS (ver POSES): cualquier cambio de estado,
 * en cualquier orden, interpola desde la pose actual en vez de saltar.
 *
 * API: MCChar.mount(elemento) · start() · stop() · setState(nombre) · celebrate(ms) → Promise · reset()
 */
(function () {
  "use strict";

  var script = document.currentScript;
  var base = script && script.src ? script.src.replace(/js\/char\.js.*$/, "img/skin/") : "/assets/img/skin/";
  var SKINS = { normal: base + "normal.png", closed: base + "closed.png", curious: base + "curious.png" };
  var FACE = { idle: "normal", curious: "curious", closed: "closed", celebrate: "normal" };
  var CONFETTI = ["#be1b8d", "#ff6ac9", "#ffd166", "#7cf0c9", "#ffffff"];
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var stage = null, root = null, head = null, headFront = null, layer = null;
  var jumpEl = null, shadowEl = null, armR = null, armL = null, legR = null, legL = null;
  var state = "idle", celebrating = false, celTimer = 0, celResolve = null;
  var raf = 0, last = 0, u = 9, bodyYaw = 0;
  var px = 0, py = 0, hasPointer = false;
  var cur = [0, 0, 0]; // yaw, pitch, roll de la cabeza (grados, relativos al cuerpo)

  /* Poses del cuerpo. Todo se interpola en JS con resortes (así CUALQUIER cambio de pose es fluido,
   * también idle ⇄ curious ⇄ closed ⇄ celebrate, y no depende de transiciones CSS que se pisan con animaciones).
   * Vector: [brazo-der Z, brazo-der X, brazo-izq Z, brazo-izq X, pierna-der Z, pierna-izq Z, salto (0-1), respiración (0-1)] en grados. */
  var POSES = {
    idle:      [2.5,   0,  -2.5,   0,   0,   0, 0, 1],
    curious:   [26,    0,  -20,    0,  10,  -5, 0, 0],
    closed:    [40,  110,  -20,  138,   0,   0, 0, 0],
    celebrate: [148,   0, -148,    0,  16, -16, 1, 0]
  };
  var pose = POSES.idle.slice(), vel = [0, 0, 0, 0, 0, 0, 0, 0];
  var STIFF = 190, DAMP = 17; // resorte un poco subamortiguado: llega con un pequeño rebote

  function U(n) { return "calc(var(--u) * " + n + ")"; }
  function div(cls) { var n = document.createElement("div"); n.className = cls; return n; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* Precarga de las tres caras (en reposo) para que el cambio sea instantáneo */
  function preload() { Object.keys(SKINS).forEach(function (k) { new Image().src = SKINS[k]; }); }
  if ("requestIdleCallback" in window) requestIdleCallback(preload, { timeout: 4000 });
  else setTimeout(preload, 2500);

  /* Un prisma de 6 caras; cada cara recorta su zona de la skin (disposición estándar de Minecraft).
   * infl > 0 agranda el prisma (capas exteriores: pelo, chaqueta, mangas, pantalón). */
  function cuboid(o) {
    var W = o.w + o.infl, H = o.h + o.infl, D = o.d + o.infl;
    var ox = o.ox, oy = o.oy, w = o.w, h = o.h, d = o.d;
    var c = div("mc-cub");
    c.style.left = U(-o.infl / 2);
    c.style.top = U(-o.infl / 2);
    c.style.width = U(W);
    c.style.height = U(H);

    // nombre, ancho y alto de la cara, transformación, zona de la skin [x, y, ancho, alto]
    var faces = [
      ["front",  W, H, "translateZ(" + U(D / 2) + ")",                  [ox + d,         oy + d, w, h]],
      ["back",   W, H, "rotateY(180deg) translateZ(" + U(D / 2) + ")",  [ox + 2 * d + w, oy + d, w, h]],
      ["right",  D, H, "rotateY(-90deg) translateZ(" + U(W / 2) + ")",  [ox,             oy + d, d, h]],
      ["left",   D, H, "rotateY(90deg) translateZ(" + U(W / 2) + ")",   [ox + d + w,     oy + d, d, h]],
      ["top",    W, D, "rotateX(90deg) translateZ(" + U(H / 2) + ")",   [ox + d,         oy,     w, d]],
      ["bottom", W, D, "rotateX(-90deg) translateZ(" + U(H / 2) + ")",  [ox + d + w,     oy,     w, d]]
    ];

    faces.forEach(function (f) {
      var el = div("mc-face mc-f-" + f[0]);
      var r = f[4], sx = f[1] / r[2], sy = f[2] / r[3], s = el.style;
      s.width = U(f[1]);
      s.height = U(f[2]);
      s.marginLeft = U(-f[1] / 2);
      s.marginTop = U(-f[2] / 2);
      s.transform = f[3];
      s.backgroundImage = "url(" + SKINS.normal + ")";
      s.backgroundSize = U(64 * sx) + " " + U(64 * sy);
      s.backgroundPosition = U(-r[0] * sx) + " " + U(-r[1] * sy);
      c.appendChild(el);
      if (o.head && !o.overlay && f[0] === "front") headFront = el;
    });
    return c;
  }

  /* Una parte del cuerpo = capa base + capa exterior, con su punto de giro */
  function limb(cls, x, y, w, h, d, baseUV, overUV, infl, origin) {
    var l = div("mc-limb " + cls);
    l.style.left = U(x);
    l.style.top = U(y);
    l.style.width = U(w);
    l.style.height = U(h);
    if (origin) l.style.transformOrigin = origin;
    var isHead = cls === "mc-head";
    l.appendChild(cuboid({ ox: baseUV[0], oy: baseUV[1], w: w, h: h, d: d, infl: 0, head: isHead }));
    l.appendChild(cuboid({ ox: overUV[0], oy: overUV[1], w: w, h: h, d: d, infl: infl, overlay: true }));
    return l;
  }

  function mount(el) {
    if (root) return;
    stage = el;
    var jump = div("mc-jump");
    root = div("mc");
    // x, y, ancho, alto, fondo (en píxeles de Minecraft) · origen de la skin base y de la capa exterior
    legR = limb("mc-leg-r", 4, 20, 4, 12, 4, [0, 16], [0, 32], 0.5, "50% 0");
    legL = limb("mc-leg-l", 8, 20, 4, 12, 4, [16, 48], [0, 48], 0.5, "50% 0");
    armR = limb("mc-arm-r", 0, 8, 4, 12, 4, [40, 16], [40, 32], 0.5, "50% " + U(2));
    armL = limb("mc-arm-l", 12, 8, 4, 12, 4, [32, 48], [48, 48], 0.5, "50% " + U(2));
    jump.appendChild(legR);
    jump.appendChild(legL);
    jump.appendChild(limb("mc-body", 4, 8, 8, 12, 4, [16, 16], [16, 32], 0.5, null));
    jump.appendChild(armR);
    jump.appendChild(armL);
    jumpEl = jump;
    head = limb("mc-head", 4, 0, 8, 8, 8, [0, 0], [32, 0], 1, "50% 100%");
    jump.appendChild(head);
    root.appendChild(jump);

    layer = div("mc-confetti-layer");
    shadowEl = div("mc-shadow");
    stage.appendChild(shadowEl);
    stage.appendChild(root);
    stage.appendChild(layer);
    setState("idle", true);
    snapPose();
  }

  /* ---------------- Cuerpo: poses con resorte ---------------- */
  function applyPose(t) {
    var p = pose, w = Math.sin((t || 0) / 1000 * 2 * Math.PI / 4.2) * 2 * p[7]; // respiración: ±2° en brazos, ciclo de 4.2 s
    armR.style.transform = "rotateZ(" + (p[0] + w).toFixed(2) + "deg) rotateX(" + p[1].toFixed(2) + "deg)";
    armL.style.transform = "rotateZ(" + (p[2] - w).toFixed(2) + "deg) rotateX(" + p[3].toFixed(2) + "deg)";
    legR.style.transform = "rotateZ(" + p[4].toFixed(2) + "deg)";
    legL.style.transform = "rotateZ(" + p[5].toFixed(2) + "deg)";
    // salto del festejo: ciclo de 0.5 s, con amplitud suavizada para que empiece y termine sin tirones
    var hop = reduce ? 0 : p[6] * (1 - Math.cos((t || 0) / 1000 * 2 * Math.PI / 0.5)) / 2;
    jumpEl.style.transform = "translateY(" + (-hop * 2.4 * u).toFixed(2) + "px)";
    shadowEl.style.transform = "scale(" + (1 - 0.28 * hop).toFixed(3) + ")";
    shadowEl.style.opacity = (1 - 0.4 * hop).toFixed(3);
  }

  function stepPose(dt, t) {
    var tg = POSES[state === "celebrate" ? "celebrate" : state] || POSES.idle, i, n, h;
    if (reduce) {
      for (i = 0; i < 8; i++) { pose[i] = tg[i]; vel[i] = 0; }
    } else {
      n = Math.max(1, Math.ceil(dt / 0.008)); h = dt / n;
      for (var s = 0; s < n; s++) {
        for (i = 0; i < 8; i++) {
          vel[i] += (STIFF * (tg[i] - pose[i]) - DAMP * vel[i]) * h;
          pose[i] += vel[i] * h;
        }
      }
    }
    applyPose(t);
  }

  function snapPose() {
    var tg = POSES[state] || POSES.idle;
    for (var i = 0; i < 8; i++) { pose[i] = tg[i]; vel[i] = 0; }
    if (jumpEl) applyPose(0);
  }

  /* ---------------- Estados ---------------- */
  function setState(s, force) {
    if (!root || !FACE[s]) return;
    if (celebrating && !force) return;
    state = s;
    stage.setAttribute("data-state", s);
    headFront.style.backgroundImage = "url(" + SKINS[FACE[s]] + ")";
  }

  function burst() {
    if (reduce || !layer) return;
    var sw = stage.clientWidth || 240;
    for (var i = 0; i < 36; i++) {
      var p = div("mc-confetti"), s = p.style, size = 5 + Math.random() * 5;
      s.setProperty("--dx", Math.round((Math.random() * 2 - 1) * (sw * 0.5 + Math.random() * 70)) + "px");
      s.setProperty("--up", -Math.round(70 + Math.random() * 110) + "px");
      s.setProperty("--fall", Math.round(110 + Math.random() * 150) + "px");
      s.setProperty("--rot", Math.round(Math.random() * 720 - 360) + "deg");
      s.setProperty("--c", CONFETTI[i % CONFETTI.length]);
      s.width = size + "px";
      s.height = size * 1.6 + "px";
      s.animationDelay = Math.round(Math.random() * 140) + "ms";
      layer.appendChild(p);
    }
  }

  function celebrate(ms) {
    if (!root) return Promise.resolve();
    celebrating = true;
    setState("celebrate", true);
    burst();
    return new Promise(function (resolve) {
      clearTimeout(celTimer);
      celResolve = resolve;
      celTimer = setTimeout(function () {
        celebrating = false;
        celResolve = null;
        resolve();
      }, ms || 1900);
    });
  }

  function reset() {
    if (!root) return;
    clearTimeout(celTimer);
    celebrating = false;
    if (celResolve) { celResolve(); celResolve = null; }
    layer.textContent = "";
    setState("idle", true);
    stop();
    snapPose(); // el panel está cerrado: la próxima vez que se abra arranca en reposo
  }

  /* ---------------- Cabeza: sigue al mouse ---------------- */
  window.addEventListener("pointermove", function (e) {
    px = e.clientX; py = e.clientY; hasPointer = true;
  }, { passive: true });

  function targets() {
    var r = stage.getBoundingClientRect();
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2 - 12 * u; // centro de la cabeza
    var wide = window.innerWidth >= 840; // en pantallas anchas el formulario queda a la derecha
    var yaw, pitch, roll = 0;
    if (state === "curious") { yaw = wide ? 40 : 6; pitch = wide ? -8 : -24; roll = 9; }
    else if (state === "closed") { yaw = -72; pitch = -14; roll = -4; }
    else if (state === "celebrate") { yaw = 0; pitch = 8; }
    else if (hasPointer) {
      yaw = clamp((px - cx) / (window.innerWidth * 0.3) * 55, -62, 62);
      pitch = clamp(-(py - cy) / (window.innerHeight * 0.45) * 32, -30, 32);
    } else { yaw = wide ? 18 : 0; pitch = 0; }
    return [clamp(yaw - bodyYaw, -80, 70), pitch, roll];
  }

  function tick(t) {
    raf = requestAnimationFrame(tick);
    var dt = Math.min(0.05, (t - last) / 1000 || 0.016);
    last = t;
    var g = targets(), k = reduce ? 1 : 1 - Math.exp(-dt * 9);
    for (var i = 0; i < 3; i++) cur[i] += (g[i] - cur[i]) * k;
    stepPose(dt, t);
    head.style.transform = "rotateY(" + cur[0].toFixed(2) + "deg) rotateX(" + cur[1].toFixed(2) + "deg) rotateZ(" + cur[2].toFixed(2) + "deg)";
  }

  function start() {
    if (!root || raf) return;
    var cs = getComputedStyle(root);
    u = parseFloat(cs.getPropertyValue("--u")) || 9;
    bodyYaw = parseFloat(cs.getPropertyValue("--ry")) || 0;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  window.addEventListener("resize", function () {
    if (!raf) return;
    var cs = getComputedStyle(root);
    u = parseFloat(cs.getPropertyValue("--u")) || 9;
    bodyYaw = parseFloat(cs.getPropertyValue("--ry")) || 0;
  });

  window.MCChar = { mount: mount, start: start, stop: stop, setState: setState, celebrate: celebrate, reset: reset };
})();
