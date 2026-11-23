/* Configuración editable del sitio.
 *
 * YouTube
 * -------
 * - featuredVideos / shorts: lista de IDs de video (lo que va después de "v=" en la URL,
 *   o el ID de un Short en youtube.com/shorts/ID). Mientras estén vacías se muestran espacios
 *   "Próximamente". Ejemplo:  featuredVideos: ["dQw4w9WgXcQ", "abc123XYZ00"]
 *
 * - apiKey: opcional. Activa las estadísticas del canal (suscriptores, visualizaciones, videos)
 *   y los títulos de los videos usando la YouTube Data API v3, que es gratuita.
 *   Cómo obtenerla: Google Cloud Console → crear proyecto → habilitar "YouTube Data API v3"
 *   → Credenciales → Clave de API → restringirla a "Referentes HTTP" con
 *   https://minecrifty.github.io/*  (así nadie más puede usarla).
 *   Una clave en el frontend es pública por naturaleza; por eso la restricción de referente
 *   es obligatoria. Sin clave, la sección de estadísticas permanece oculta (no se inventan cifras).
 */
window.SITE_CONFIG = {
  youtube: {
    handle: "@Minecrifty",
    channelUrl: "https://www.youtube.com/@Minecrifty",
    apiKey: "",
    featuredVideos: [],
    shorts: []
  }
};
