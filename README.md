# Minecrifty Web

Sitio personal de Minecrifty. HTML, CSS y JavaScript puros, sin dependencias ni compilación. Listo para GitHub Pages.

## Estructura

```
index.html                     Inicio (/)
youtube/index.html             YouTube (/youtube/)
projects/index.html            Catálogo de proyectos (/projects/)
projects/tictactoe/index.html  Detalle de TicTacToe (/projects/tictactoe/)
404.html                       Página de error
favicon.ico · robots.txt · sitemap.xml · .nojekyll
assets/
  css/style.css                Estilos (variables de color al inicio: --accent = #BE1B8D)
  js/main.js                   Idioma, menú móvil, animaciones, YouTube
  js/i18n.js                   Textos ES / EN
  js/config.js                 Videos, Shorts y clave opcional de YouTube
  img/                         Imágenes optimizadas y favicons
```

## Ver el sitio en local

Las rutas son relativas, así que también se puede abrir `index.html` con doble clic. Para probarlo como en GitHub Pages:

```
python3 -m http.server 8000
```

y abrir http://localhost:8000/

## Publicar

Sube el contenido de esta carpeta a la raíz del repositorio `Minecrifty/minecrifty.github.io` (rama principal). En *Settings → Pages* elige "Deploy from a branch" → `main` → `/ (root)`. Si más adelante usas un dominio propio o un repositorio de proyecto (no de usuario), hay que cambiar las URLs de `canonical`, `og:` y `sitemap.xml`.

## Idiomas

El texto en español está escrito directamente en el HTML (funciona sin JavaScript y mejora el SEO). El inglés se aplica con `i18n.js`. La preferencia se guarda en el navegador; la primera visita usa el idioma del navegador. También funciona `?lang=en` o `?lang=es`.

Para un texto nuevo: escríbelo en español en el HTML con `data-i18n="mi.clave"` y agrega `mi.clave` en `es` y `en` dentro de `i18n.js`. Para atributos (`alt`, `aria-label`, `content`): `data-i18n-attr="alt:mi.clave"`.

## Agregar un proyecto

1. Copia una tarjeta `<article class="card ...">` en `index.html` y `projects/index.html`.
2. Cambia nombre, etiqueta y descripción (con sus claves en `i18n.js`).
3. Imagen: agrega `<img src="assets/img/projects/tu-imagen.webp" alt="" loading="lazy">` (en `projects/index.html` usa `../assets/...`)`` dentro de `.media`. Mientras no haya imagen se muestra "Imagen próximamente". Para logos, añade la clase `contain` a `.media`.
4. Página de detalle: copia `projects/tictactoe/` a `projects/<nombre>/`, y enlaza la tarjeta con `class="card is-link"` y un `<a class="card-link" href="projects/<nombre>/">` (en `projects/index.html`: `href="<nombre>/"`)``. Añade la URL a `sitemap.xml`.

## YouTube

Edita `assets/js/config.js`:

- `featuredVideos` y `shorts`: IDs de video. Mientras estén vacíos se ven espacios "Próximamente". Los videos usan un reproductor que solo carga YouTube al hacer clic.
- `apiKey` (opcional): activa estadísticas del canal y títulos de videos con la YouTube Data API v3, que es gratuita. Debe restringirse por referente HTTP a `https://minecrifty.github.io/*`. Sin clave, las estadísticas no se muestran (no se inventan cifras).

## Pendientes de contenido

- Imágenes de TicTacToe y CriftyStudios (tarjetas y galería).
- Descripciones de los tres modos de TicTacToe.
- Enlaces de descarga de TicTacToe (el botón está desactivado hasta entonces).
- Render final de la skin: reemplaza `assets/img/minecrifty-wave.webp` (y `og-image.jpg` si cambia).

## Videos de YouTube

Con `apiKey` en `assets/js/config.js`, la página consulta el canal en vivo (últimos Shorts y videos y estadísticas públicas). Lo de abajo es un respaldo opcional sin clave.

La página de YouTube muestra los Shorts y videos más recientes leyendo `assets/js/videos.js`.
Ese archivo lo genera `tools/update_videos.py` (sin claves ni servicios de pago).

- **Automático:** al subir el sitio a GitHub, el flujo `.github/workflows/update-videos.yml` lo actualiza cada 6 horas.
  La primera vez: pestaña *Actions* → *Actualizar videos de YouTube* → *Run workflow*.
- **Manual:** `python3 tools/update_videos.py` y vuelve a subir `assets/js/videos.js`.
- Para fijar videos concretos, escribe sus IDs en `assets/js/config.js` (`featuredVideos` / `shorts`); tienen prioridad.
