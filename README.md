# zyra-videos

Genera vídeos verticales de Zyra (1080×1920, 15 s, sin audio) a partir de un guion en JSON. Remotion + GitHub Actions; no depende de ninguna conversación.

## Flujo normal (sin instalar nada)
1. Copia un archivo de `guiones/` (por ejemplo `alineacion-sugerida.json`), cámbiale el nombre y edita los textos.
2. Súbelo (commit a `main`). El flujo **Generar vídeos** (pestaña Actions) renderiza todos y deja los MP4 en el artefacto `videos-tiktok`.
3. Descarga el ZIP, sube el MP4 a TikTok y añade música desde su biblioteca.

También se puede lanzar a mano: Actions → Generar vídeos → Run workflow.

## Formato del guion (`guiones/<id>.json`)
| Campo | Qué es |
| --- | --- |
| `hook` | Dos líneas del gancho (máx. ~16 caracteres cada una) |
| `title` | Título sobre el móvil (máx. ~23 caracteres) |
| `src`, `imgW` | Captura de `public/ui/` y su ancho en px |
| `scroll` | Desplazamiento inicial y final de la captura (px) |
| `box` | Destacado opcional `[x, y, ancho, alto]` en px de la captura |
| `subs` | Tres subtítulos que van cambiando |
| `cta` | Frase del cierre; la URL es siempre zyrapadel.com |

Capturas nuevas: solo con datos de demostración (JUGADOR 1…), nunca nombres reales.

## En local
    npm install
    npm run render [id]       # CHROME=/ruta/a/chrome si Remotion no descarga navegador
    npm run studio            # previsualizar

## Opcional: guion libre -> JSON con IA
Aún no incluido. Se puede añadir un paso que llame a la API de Claude para convertir un texto libre en este JSON (necesita un secreto `ANTHROPIC_API_KEY` y tiene coste por uso).

Licencias: fuentes Archivo y Syncopate bajo OFL (`public/fonts`). Logo y capturas de Zyra.
