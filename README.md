# Minecrifty Web

Sitio personal de Minecrifty. HTML, CSS y JavaScript puros, sin dependencias ni compilación. Listo para GitHub Pages.

## Estructura

```
index.html                     Inicio (/)
youtube/index.html             YouTube (/youtube/)
projects/index.html            Catálogo de proyectos (/projects/)
projects/tictactoe/index.html  Detalle de TicTacToe (/projects/tictactoe/)
404.html                       Página de error
supabase/setup.sql             Tablas, reglas y almacenamiento de Supabase (se ejecuta una vez)
favicon.ico · robots.txt · sitemap.xml · .nojekyll
assets/
  css/style.css                Estilos (variables de color al inicio: --accent = #BE1B8D)
  js/main.js                   Idioma, menú móvil, animaciones, YouTube
  js/i18n.js                   Textos ES / EN
  js/config.js                 Videos, Shorts, clave opcional de YouTube y datos de Supabase
  js/auth.js                   Iniciar sesión / Registrarse y menú del círculo de usuario (Supabase Auth)
  js/profile.js                Panel de Perfil: foto, usuario, nametag y skin de Bedrock (Supabase)
  js/char.js                   Personaje 3D del panel de acceso (CSS 3D a partir de la skin)
  img/                         Imágenes optimizadas y favicons
  img/skin/                    Skin 64×64 en tres versiones: normal.png, curious.png, closed.png
```

## Ver el sitio en local

Las rutas son relativas, así que también se puede abrir `index.html` con doble clic. Para probarlo como en GitHub Pages:

```
python3 -m http.server 8000
```

y abrir http://localhost:8000/

## Publicar

Sube el contenido de esta carpeta a la raíz del repositorio `Minecrifty/minecrifty.github.io` (rama principal). En *Settings → Pages* elige "Deploy from a branch" → `main` → `/ (root)`. Si más adelante usas un dominio propio o un repositorio de proyecto (no de usuario), hay que cambiar las URLs de `canonical`, `og:` y `sitemap.xml`.

## Cuentas con Supabase

Las cuentas, los perfiles y los archivos (foto y skin) viven en Supabase (plan gratuito, sin tarjeta).

1. Crea un proyecto en https://supabase.com (New project).
2. En **SQL Editor → New query** pega todo `supabase/setup.sql` y pulsa **Run**. Crea la tabla `profiles`, las reglas de seguridad (cada usuario solo ve y edita lo suyo) y los buckets `avatars` y `skins`.
3. En **Project Settings → API** copia la *Project URL* y la clave *anon public* y pégalas en `assets/js/config.js` (`supabase.url` y `supabase.anonKey`). La clave `service_role` **nunca** va en el sitio.
4. En **Authentication → URL Configuration**: *Site URL* = `https://minecrifty.github.io` y en *Redirect URLs* añade `https://minecrifty.github.io/**` (y `http://localhost:8000/**` para pruebas locales).
5. Google: **Authentication → Providers → Google**, activa y pega el Client ID y Secret de Google Cloud. En Google Cloud, como URI de redireccionamiento autorizado usa la que Supabase muestra en esa pantalla.
6. Opcional: en **Authentication → Providers → Email** puedes desactivar "Confirm email" si no quieres que los nuevos usuarios confirmen su correo.

Datos que guarda cada perfil: nombre de usuario, URL de la foto, nametag de Minecraft Bedrock y URL de la skin.

## Idiomas

El texto en español está escrito directamente en el HTML (funciona sin JavaScript y mejora el SEO). El inglés se aplica con `i18n.js`. La preferencia se guarda en el navegador; la primera visita usa el idioma del navegador. También funciona `?lang=en` o `?lang=es`.

Para un texto nuevo: escríbelo en español en el HTML con `data-i18n="mi.clave"` y agrega `mi.clave` en `es` y `en` dentro de `i18n.js`. Para atributos (`alt`, `aria-label`, `content`): `data-i18n-attr="alt:mi.clave"`.

## Agregar un proyecto

1. Copia una tarjeta `<article class="card ...">` en `index.html` y `projects/index.html`.
2. Cambia nombre, etiqueta y descripción (con sus claves en `i18n.js`).
3. Imagen: agrega `<img src="assets/img/projects/tu-imagen.webp" alt="" loading="lazy">` (en `projects/index.html` usa `../assets/...`)`` dentro de `.media`. Mientras no haya imagen se muestra "Imagen próximamente". Para logos, añade la clase `contain` a `.media`.
4. Página de detalle: copia `projects/tictactoe/` a `projects/<nombre>/`, y enlaza la tarjeta con `class="card is-link"` y un `<a class="card-link" href="projects/<nombre>/">` (en `projects/index.html`: `href="<nombre>/"`)``. Añade la URL a `sitemap.xml`.

## Agregar un evento

1. En `events/index.html` copia un `<article class="prow ev-card">` (el de Squid Crifty Games) y cambia nombre, fecha, estado, descripción y logo (`assets/img/events/`).
2. Textos: agrega sus claves en `assets/js/i18n.js` (ES y EN), igual que `ev.scg.*`.
3. Imágenes: dentro de `.ev-gallery` agrega un `<div class="media gallery-item">` por imagen (hay un ejemplo comentado) y borra el aviso "Imagen próximamente".
4. El carrusel "Eventos destacados" del inicio se llena solo con esas tarjetas. La línea desplazadora (solo PC) aparece cuando hay más tarjetas de las que caben.

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

## Iniciar sesión con usuario o correo

El campo de acceso acepta nombre de usuario **o** correo; el registro pide ambos. Para que funcione con usuario hay que ejecutar
`supabase/setup.sql` completo en Supabase → SQL Editor (se puede repetir sin problema). Ahí se crean los nombres únicos y las
funciones `username_available` y `login_email`. Tras 8 intentos fallidos con un mismo usuario se bloquea 10 minutos (por correo
siempre se puede entrar).

## Personaje del panel de acceso

Las caras están en `assets/img/skin/` (`normal.png`, `curious.png`, `closed.png`; skins de 64×64). Las poses (respiración, correo,
contraseña y festejo) están en `assets/css/style.css`, sección "Personaje 3D junto al panel".
