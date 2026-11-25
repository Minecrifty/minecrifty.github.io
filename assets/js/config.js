/* Configuración editable del sitio.
 *
 * YouTube
 * -------
 * - featuredVideos / shorts: lista de IDs de video (lo que va después de "v=" en la URL,
 *   o el ID de un Short en youtube.com/shorts/ID). Mientras estén vacías se muestran espacios
 *   "Próximamente". Ejemplo:  featuredVideos: ["dQw4w9WgXcQ", "abc123XYZ00"]
 *
 * - apiKey: Activa las estadísticas del canal (suscriptores, visualizaciones, videos)
 *   y los títulos de los videos usando la YouTube Data API v3, que es gratuita.
 *   Cómo obtenerla: Google Cloud Console → crear proyecto → habilitar "YouTube Data API v3"
 *   → Credenciales → Clave de API → restringirla a "Referentes HTTP" con
 *   https://minecrifty.github.io/*  (así nadie más puede usarla).
 *   Una clave en el frontend es pública por naturaleza; por eso la restricción de referente
 *   es obligatoria. Sin clave, la sección de estadísticas permanece oculta (no se inventan cifras).
 */
/* Cuentas y perfiles (Iniciar sesión / Registrarse / Perfil)
 * ----------------------------------------------------------
 * Usa Supabase (gratis): autenticación, base de datos de perfiles y almacenamiento de fotos y skins.
 * Pasos en README.md (sección "Cuentas con Supabase") y SQL en supabase/setup.sql.
 * Pega aquí la "Project URL" y la clave "anon public" (Project Settings → API). Ambas son públicas
 * por diseño; la seguridad la dan las reglas RLS del SQL. NUNCA pegues aquí la clave "service_role".
 * Mientras estén vacías, los botones abren el panel pero avisan que las cuentas no están activadas.
 */
/* Frases del globo junto al personaje
 * -----------------------------------
 * Cada vez que alguien entra a la página se muestra una de estas, al azar (evita repetir la anterior).
 * Para agregar más, añade otra línea entre comillas separada por comas. No necesitan traducción:
 * se muestran tal cual en español e inglés.
 */
window.SITE_CONFIG = {
  supabase: {
    url: "https://xkdslgotlhqlecftkjnc.supabase.co",
    anonKey: "sb_publishable_Ba8PgtzmMw-w-mV5eUN2qw_ViP80Lqh"
  },

  greetings: [
    "¡Hola!",
    "weboz",
  	"Extraño a mi ex",
  	"Soy Noob",
  	"Soy Pro",
  	"Soy God",
  	"Imaginate estar formado por 6 cubos",
  	"Mincerifty",
  	"309",
  	"456",
  	"67",
  	"Nezcuik",
  	"Yupi?",
  	"Tengo mucho sueño",
  	"No dormí nada anoche",
  	"421",
    "¡Suscríbete y deja like!"
  ],

  youtube: {
    handle: "@Minecrifty",
    channelUrl: "https://www.youtube.com/@Minecrifty",
    apiKey: "AIzaSyAQiusYUnuY0GLrqS-EwegzOBIxScHhaiI",
    featuredVideos: [],
    shorts: []
  }
};
