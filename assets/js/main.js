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
    initYouTube();
    initReveal();
    requestAnimationFrame(function () { doc.classList.add("ready"); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
