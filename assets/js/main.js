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

  function renderVideos(container, ids, titles) {
    if (!container || !ids || !ids.length) return; // se conservan los "Próximamente"
    container.textContent = "";
    ids.forEach(function (id) { container.appendChild(ytItem(id, titles && titles[id])); });
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

    var key = yt.apiKey;
    var ids = (yt.featuredVideos || []).concat(yt.shorts || []);
    var titles = {};

    function render() {
      renderVideos(featured, yt.featuredVideos, titles);
      renderVideos(shorts, yt.shorts, titles);
      initMedia();
    }

    if (!key) { render(); return; }

    var jobs = [];
    if (ids.length) {
      jobs.push(fetchJSON("https://www.googleapis.com/youtube/v3/videos?part=snippet&id=" +
        encodeURIComponent(ids.join(",")) + "&key=" + encodeURIComponent(key))
        .then(function (d) {
          (d.items || []).forEach(function (v) { titles[v.id] = v.snippet.title; });
        }).catch(function () {}));
    }
    if (statsSection && yt.handle) {
      jobs.push(fetchJSON("https://www.googleapis.com/youtube/v3/channels?part=statistics&forHandle=" +
        encodeURIComponent(yt.handle) + "&key=" + encodeURIComponent(key))
        .then(function (d) {
          var s = d.items && d.items[0] && d.items[0].statistics;
          if (!s) return;
          ytStats = {
            subs: s.hiddenSubscriberCount ? null : Number(s.subscriberCount),
            views: Number(s.viewCount),
            videos: Number(s.videoCount)
          };
          statsSection.hidden = false;
          formatStats();
        }).catch(function () {})); // si falla, la sección sigue oculta
    }
    Promise.all(jobs).then(render);
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
    initMedia();
    initYouTube();
    initReveal();
    requestAnimationFrame(function () { doc.classList.add("ready"); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
