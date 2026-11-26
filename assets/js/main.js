/* Minecrifty Web — comportamiento del sitio (sin dependencias). */
(function () {
  "use strict";

  var doc = document.documentElement;
  var dict = window.I18N || {};
  var cfg = window.SITE_CONFIG || {};
  var LANGS = ["es", "en"];
  var lang = "es";
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function t(key) {
    if (dict[lang] && dict[lang][key] != null) return dict[lang][key];
    if (dict.es && dict.es[key] != null) return dict.es[key];
    return key;
  }

  /* ---------------- Idioma ---------------- */
  function initialLang() {
    try {
      var q = new URLSearchParams(location.search).get("lang");
      if (LANGS.indexOf(q) !== -1) return q;
    } catch (e) {}
    try {
      var s = localStorage.getItem("lang");
      if (LANGS.indexOf(s) !== -1) return s;
    } catch (e) {}
    var nav = (navigator.languages && navigator.languages[0]) || navigator.language || "es";
    return String(nav).toLowerCase().indexOf("en") === 0 ? "en" : "es";
  }

  function applyLang(next, persist) {
    lang = next;
    doc.lang = next;

    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    document.querySelectorAll("[data-i18n-attr]").forEach(function (el) {
      el.getAttribute("data-i18n-attr").split(",").forEach(function (pair) {
        var p = pair.split(":");
        if (p.length === 2) el.setAttribute(p[0].trim(), t(p[1].trim()));
      });
    });
    document.querySelectorAll(".lang-switch button").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-lang") === next));
    });

    if (persist) {
      try { localStorage.setItem("lang", next); } catch (e) {}
    }
    document.dispatchEvent(new CustomEvent("langchange", { detail: { lang: next } }));
  }

  /* ---------------- Navegación móvil ---------------- */
  function initNav() {
    var header = document.querySelector(".site-header");
    var toggle = document.querySelector(".nav-toggle");
    if (!header || !toggle) return;

    function setOpen(open) {
      header.classList.toggle("nav-open", open);
      toggle.setAttribute("aria-expanded", String(open));
    }
    toggle.addEventListener("click", function () {
      setOpen(!header.classList.contains("nav-open"));
    });
    header.querySelectorAll(".site-nav a").forEach(function (a) {
      a.addEventListener("click", function () { setOpen(false); });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && header.classList.contains("nav-open")) {
        setOpen(false);
        toggle.focus();
      }
    });
    window.addEventListener("resize", function () {
      if (window.innerWidth >= 760) setOpen(false);
    });
  }

  /* ---------------- Aparición al desplazar ---------------- */
  function initReveal() {
    document.querySelectorAll("[data-stagger]").forEach(function (parent) {
      Array.prototype.forEach.call(parent.children, function (child, i) {
        child.style.setProperty("--d", i * 80 + "ms");
      });
    });

    var items = document.querySelectorAll(".reveal");
    if (reduceMotion || !("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    items.forEach(function (el) { io.observe(el); });
  }

  /* ---------------- Imágenes con espacio reservado ---------------- */
  function initMedia(scope) {
    (scope || document).querySelectorAll(".media img").forEach(function (img) {
      var box = img.closest(".media");
      function mark() { if (img.naturalWidth > 0 && box) box.classList.add("is-loaded"); }
      if (img.complete) mark();
      else img.addEventListener("load", mark, { once: true });
    });
  }

  /* ---------------- YouTube ---------------- */
  var ytStats = null;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  function ytItem(id, title) {
    var item = el("div", "yt-item reveal is-visible");
    var box = el("div", "yt-box");
    var btn = el("button");
    btn.type = "button";
    btn.setAttribute("data-i18n-attr", "aria-label:yt.play");
    btn.setAttribute("aria-label", t("yt.play"));
    var img = el("img");
    img.src = "https://i.ytimg.com/vi/" + encodeURIComponent(id) + "/hqdefault.jpg";
    img.alt = "";
    img.loading = "lazy";
    btn.appendChild(img);
    btn.appendChild(el("span", "yt-play"));
    btn.addEventListener("click", function () {
      var frame = el("iframe");
      frame.src = "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(id) + "?autoplay=1&rel=0";
      frame.title = title || t("yt.play");
      frame.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
      frame.allowFullscreen = true;
      box.replaceChild(frame, btn);
    });
    box.appendChild(btn);
    item.appendChild(box);
    if (title) item.appendChild(el("p", "yt-title", title));
    return item;
  }

  function renderVideos(container, items, titles, max) {
    if (!container || !items || !items.length) return; // se conservan los "Próximamente"
    container.textContent = "";
    items.slice(0, max || 12).forEach(function (it) {
      container.appendChild(ytItem(it.id, (titles && titles[it.id]) || it.title));
    });
  }

  function toItems(list) {
    return (list || []).map(function (v) { return typeof v === "string" ? { id: v } : v; });
  }

  function fetchJSON(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    });
  }

  function formatStats() {
    if (!ytStats) return;
    var fmt;
    try { fmt = new Intl.NumberFormat(lang, { notation: "compact", maximumFractionDigits: 1 }); }
    catch (e) { fmt = { format: function (n) { return String(n); } }; }
    Object.keys(ytStats).forEach(function (k) {
      var dd = document.querySelector('[data-stat="' + k + '"]');
      var box = document.querySelector('[data-stat-box="' + k + '"]');
      if (!dd || !box) return;
      if (ytStats[k] == null) { box.hidden = true; return; }
      box.hidden = false;
      dd.textContent = fmt.format(ytStats[k]);
    });
  }

  function initYouTube() {
    var yt = cfg.youtube || {};
    var featured = document.querySelector('[data-yt="featured"]');
    var shorts = document.querySelector('[data-yt="shorts"]');
    var statsSection = document.querySelector("[data-yt-stats]");
    if (!featured && !shorts && !statsSection) return;

    var auto = window.SITE_VIDEOS || {};
    // 1) IDs escritos a mano en config.js, 2) lista de videos.js (opcional), 3) consulta en vivo con la clave
    var vids = (yt.featuredVideos && yt.featuredVideos.length) ? toItems(yt.featuredVideos) : toItems(auto.videos);
    var shs = (yt.shorts && yt.shorts.length) ? toItems(yt.shorts) : toItems(auto.shorts);
    var key = yt.apiKey;
    var API = "https://www.googleapis.com/youtube/v3/";

    function render() {
      renderVideos(featured, vids, null, 6);
      renderVideos(shorts, shs, null, 10);
      initMedia();
    }
    if (!key) { render(); return; }

    function cacheGet(k) {
      try {
        var o = JSON.parse(localStorage.getItem(k));
        if (o && Date.now() - o.t < 10 * 60 * 1000) return o.v;
      } catch (e) {}
      return null;
    }
    function cacheSet(k, v) {
      try { localStorage.setItem(k, JSON.stringify({ t: Date.now(), v: v })); } catch (e) {}
    }
    function list(playlistId, max) {
      return fetchJSON(API + "playlistItems?part=snippet&maxResults=" + max + "&playlistId=" +
        encodeURIComponent(playlistId) + "&key=" + encodeURIComponent(key))
        .then(function (d) {
          return (d.items || []).map(function (it) {
            return { id: it.snippet.resourceId.videoId, title: it.snippet.title };
          });
        });
    }

    var cached = cacheGet("yt-data");
    var job;
    if (cached) {
      job = Promise.resolve(cached);
    } else {
      job = fetchJSON(API + "channels?part=statistics&forHandle=" + encodeURIComponent(yt.handle) +
        "&key=" + encodeURIComponent(key)).then(function (d) {
        var ch = d.items && d.items[0];
        if (!ch) throw new Error("canal no encontrado");
        var base = ch.id.slice(2);
        // UULF = solo videos largos, UUSH = solo Shorts (listas automáticas de YouTube)
        return Promise.all([
          list("UULF" + base, 6).catch(function () { return []; }),
          list("UUSH" + base, 10).catch(function () { return []; })
        ]).then(function (r) {
          var out = { videos: r[0], shorts: r[1], stats: ch.statistics || null };
          if (out.videos.length || out.shorts.length) cacheSet("yt-data", out);
          return out;
        });
      });
    }

    job.then(function (data) {
      if (data.videos && data.videos.length) vids = data.videos;
      if (data.shorts && data.shorts.length) shs = data.shorts;
      var st = data.stats;
      if (statsSection && st) {
        ytStats = {
          subs: st.hiddenSubscriberCount ? null : Number(st.subscriberCount),
          views: Number(st.viewCount),
          videos: Number(st.videoCount)
        };
        statsSection.hidden = false;
        formatStats();
      }
      render();
    }).catch(render); // si la API falla, se usan los datos locales o los "Próximamente"
  }

  /* ---------------- Frase aleatoria del globo ---------------- */
  function initGreeting() {
    var el = document.querySelector("[data-greeting]");
    var list = cfg.greetings;
    if (!el || !list || !list.length) return;
    var last = -1;
    try { last = parseInt(sessionStorage.getItem("greeting"), 10); } catch (e) {}
    var i = Math.floor(Math.random() * list.length);
    if (list.length > 1 && i === last) i = (i + 1 + Math.floor(Math.random() * (list.length - 1))) % list.length;
    el.textContent = list[i];
    try { sessionStorage.setItem("greeting", String(i)); } catch (e) {}
  }

  /* ---------------- Carrusel de proyectos ---------------- */
  function initRail() {
    var rail = document.querySelector(".rail");
    var prev = document.querySelector('[data-rail="prev"]');
    var next = document.querySelector('[data-rail="next"]');
    if (!rail || !prev || !next) return;

    function step() {
      var slide = rail.querySelector(".slide");
      return slide ? slide.getBoundingClientRect().width + 20 : 300;
    }
    function update() {
      prev.disabled = rail.scrollLeft <= 4;
      next.disabled = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 4;
    }
    function go(dir) {
      rail.scrollBy({ left: dir * step(), behavior: reduceMotion ? "auto" : "smooth" });
    }
    prev.addEventListener("click", function () { go(-1); });
    next.addEventListener("click", function () { go(1); });
    rail.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  /* ---------------- Eventos destacados (inicio) ----------------
     Lee /events/ y convierte cada .prow en una tarjeta del carrusel.
     Si no se puede leer (por ejemplo abriendo el archivo con doble clic), se queda el contenido de respaldo del HTML. */
  function initEventsFeed() {
    var rail = document.querySelector("[data-events-feed]");
    if (!rail || !window.fetch || !window.DOMParser) return;
    var url = new URL(rail.getAttribute("data-events-feed"), location.href);
    fetch(url.href).then(function (r) {
      if (!r.ok) throw new Error("events " + r.status);
      return r.text();
    }).then(function (html) {
      var rows = new DOMParser().parseFromString(html, "text/html").querySelectorAll(".prow");
      if (!rows.length) return;
      var frag = document.createDocumentFragment();
      Array.prototype.slice.call(rows, 0, 6).forEach(function (row) {
        var href = row.getAttribute("href");
        var link = row.tagName === "A" ? row : row.querySelector("a[href]");
        if (!href && link) href = link.getAttribute("href");
        var slide = el(href ? "a" : "article", "slide" + (href ? " is-link" : ""));
        if (href) slide.href = new URL(href, url).href;

        var thumb = row.querySelector(".prow-thumb");
        var media = thumb ? document.importNode(thumb, true) : el("div", "media ev-ph");
        media.classList.remove("prow-thumb");
        media.classList.add("slide-media");
        media.querySelectorAll("img").forEach(function (img) {
          var src = img.getAttribute("src");
          if (src) img.src = new URL(src, url).href;
        });
        slide.appendChild(media);

        var body = el("div", "slide-body");
        var date = row.querySelector(".ev-date");
        if (date) body.appendChild(document.importNode(date, true));
        var title = row.querySelector("h2, h3");
        if (title) {
          var h3 = el("h3");
          Array.prototype.forEach.call(title.childNodes, function (n) { h3.appendChild(document.importNode(n, true)); });
          body.appendChild(h3);
        }
        var desc = row.querySelector(".desc");
        if (desc) body.appendChild(document.importNode(desc, true));
        var end = row.querySelector(".prow-end");
        if (end) {
          var more = document.importNode(end, true);
          more.className = "more mono" + (end.classList.contains("is-muted") ? " is-muted" : "");
          body.appendChild(more);
        }
        slide.appendChild(body);
        frag.appendChild(slide);
      });
      rail.textContent = "";
      rail.appendChild(frag);
      initMedia(rail);
      applyLang(lang, false);
    }).catch(function () { /* se mantiene el respaldo */ });
  }

  /* ---------------- Galería ampliable (lightbox) ---------------- */
  function initLightbox() {
    // Cada contenedor [data-lightbox] es un grupo: las flechas pasan entre las imágenes de ese grupo
    var groups = Array.prototype.slice.call(document.querySelectorAll("[data-lightbox]")).map(function (g) {
      return Array.prototype.slice.call(g.querySelectorAll(".gallery-item, .feature-art")).filter(function (n) { return n.querySelector("img"); });
    }).filter(function (g) { return g.length; });
    if (!groups.length) return;
    var items = groups[0];
    var box = null, imgEl, capEl, cntEl, closeB, prevB, nextB, cur = 0, lastFocus = null, startX = null;

    function build() {
      box = document.createElement("div");
      box.className = "lb";
      box.hidden = true;
      box.setAttribute("role", "dialog");
      box.setAttribute("aria-modal", "true");
      box.innerHTML =
        '<div class="lb-backdrop" data-lb-close></div>' +
        '<figure class="lb-fig"><img class="lb-img" alt=""><figcaption class="lb-cap"></figcaption></figure>' +
        '<button type="button" class="lb-btn lb-close" data-lb-close>×</button>' +
        '<button type="button" class="lb-btn lb-prev">‹</button>' +
        '<button type="button" class="lb-btn lb-next">›</button>' +
        '<p class="lb-count mono" aria-live="polite"></p>';
      document.body.appendChild(box);
      imgEl = box.querySelector(".lb-img"); capEl = box.querySelector(".lb-cap"); cntEl = box.querySelector(".lb-count");
      closeB = box.querySelector(".lb-close"); prevB = box.querySelector(".lb-prev"); nextB = box.querySelector(".lb-next");
      box.addEventListener("click", function (e) {
        if (e.target.closest("[data-lb-close]")) close();
        else if (e.target.closest(".lb-prev")) go(-1);
        else if (e.target.closest(".lb-next")) go(1);
      });
      // deslizar con el dedo
      box.addEventListener("pointerdown", function (e) { if (e.pointerType === "touch") startX = e.clientX; });
      box.addEventListener("pointerup", function (e) {
        if (startX == null) return;
        var dx = e.clientX - startX; startX = null;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
      });
      box.addEventListener("pointercancel", function () { startX = null; });
    }

    function labels() {
      closeB.setAttribute("aria-label", t("lb.close"));
      prevB.setAttribute("aria-label", t("lb.prev"));
      nextB.setAttribute("aria-label", t("lb.next"));
      box.setAttribute("aria-label", t("lb.label"));
    }

    function show(i) {
      cur = (i + items.length) % items.length;
      var src = items[cur].querySelector("img");
      imgEl.classList.remove("is-in");
      imgEl.src = src.currentSrc || src.src;
      imgEl.alt = src.alt || "";
      capEl.textContent = src.alt || "";
      cntEl.textContent = (cur + 1) + " / " + items.length;
      imgEl.classList.toggle("is-contain", items[cur].classList.contains("is-contain") || items[cur].classList.contains("feature-art"));
      requestAnimationFrame(function () { imgEl.classList.add("is-in"); });
      var multi = items.length > 1;
      prevB.hidden = nextB.hidden = cntEl.hidden = !multi;
      // precarga de las vecinas
      [cur - 1, cur + 1].forEach(function (k) {
        var n = items[(k + items.length) % items.length].querySelector("img");
        if (n) new Image().src = n.currentSrc || n.src;
      });
    }

    function go(d) { show(cur + d); }

    function open(g, i) {
      items = g;
      if (!box) build();
      lastFocus = document.activeElement;
      labels();
      show(i);
      box.hidden = false;
      doc.classList.add("lb-open");
      closeB.focus();
    }

    function close() {
      if (!box || box.hidden) return;
      box.hidden = true;
      doc.classList.remove("lb-open");
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    groups.forEach(function (g) {
      g.forEach(function (n, i) {
        n.setAttribute("tabindex", "0");
        n.setAttribute("role", "button");
        n.classList.add("is-zoomable");
        n.addEventListener("click", function () { open(g, i); });
        n.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(g, i); }
        });
      });
    });
    function relabel() { groups.forEach(function (g) { g.forEach(function (n) { n.setAttribute("aria-label", t("lb.open")); }); }); }
    relabel();
    document.addEventListener("langchange", function () { relabel(); if (box && !box.hidden) labels(); });

    document.addEventListener("keydown", function (e) {
      if (!box || box.hidden) return;
      if (e.key === "Escape") { e.stopPropagation(); close(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
      else if (e.key === "Tab") { // el foco no sale del visor
        var f = [closeB, prevB, nextB].filter(function (b) { return !b.hidden; });
        var i = f.indexOf(document.activeElement);
        e.preventDefault();
        f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
      }
    }, true);
  }

  /* Al abrir los archivos directamente (file://), los enlaces a carpetas necesitan index.html */
  function fixLocalLinks() {
    if (location.protocol !== "file:") return;
    document.querySelectorAll("a[href]").forEach(function (a) {
      var h = a.getAttribute("href");
      if (/^(https?:|mailto:|#)/.test(h)) return;
      if (h === "" || h.slice(-1) === "/") a.setAttribute("href", h + "index.html");
    });
  }

  /* ---------------- Inicio ---------------- */
  function init() {
    fixLocalLinks();
    document.querySelectorAll("[data-year]").forEach(function (n) {
      n.textContent = String(new Date().getFullYear());
    });

    document.querySelectorAll(".lang-switch button").forEach(function (b) {
      b.addEventListener("click", function () {
        var next = b.getAttribute("data-lang");
        if (next !== lang) applyLang(next, true);
      });
    });
    document.addEventListener("langchange", formatStats);

    applyLang(initialLang(), false);
    initNav();
    initRail();
    initGreeting();
    initMedia();
    initLightbox();
    initYouTube();
    initEventsFeed();
    initReveal();
    requestAnimationFrame(function () { doc.classList.add("ready"); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
