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
/* Cuentas (Iniciar sesión / Registrarse)
 * --------------------------------------
 * Usa Firebase Authentication (gratis). Pega aquí los datos de tu app web de Firebase
 * (Configuración del proyecto → Tus apps → Configuración del SDK). Estos valores son públicos
 * por diseño; la seguridad la dan los "Dominios autorizados" de Firebase. Mientras estén vacíos,
 * los botones abren el panel pero avisan que las cuentas no están activadas.
 */
/* Frases del globo junto al personaje
 * -----------------------------------
 * Cada vez que alguien entra a la página se muestra una de estas, al azar (evita repetir la anterior).
 * Para agregar más, añade otra línea entre comillas separada por comas. No necesitan traducción:
 * se muestran tal cual en español e inglés.
 */
window.SITE_CONFIG = {
  firebase: {
    apiKey: "AIzaSyB_LhoBiOystUvmfiWKYPmYYRarXEnmIZQ",
    authDomain: "minecrifty-web.firebaseapp.com",
    projectId: "minecrifty-web",
    appId: "1:90832039161:web:3df02e0b9a3bfe1e04c628"
  },

  greetings: [
    "¡Hola!",
    "weboz",
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
