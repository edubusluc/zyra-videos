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

## Memes
Formato «antes / después» con la marca (imagen 1080×1350, `memes/<id>.json`: `beforeLabel`, `before`, `afterLabel`, `after`; textos de máx. 70 caracteres). El CI los deja como PNG junto a los vídeos. Son originales de Zyra: no se usan plantillas ni fotos con derechos de terceros. Generar imágenes con IA (fotos, ilustraciones) exigiría un modelo de imagen externo, normalmente de pago, y no está incluido.

## En local
    npm install
    npm run render [id]       # CHROME=/ruta/a/chrome si Remotion no descarga navegador
    npm run studio            # previsualizar

## App local: «genera un vídeo para mostrar…»
    git clone https://github.com/edubusluc/zyra-videos && cd zyra-videos && npm install
    export GITHUB_TOKEN=...        # token con permiso de lectura de Actions en este repo (solo para el modo CI)
    npm run app                    # abre http://localhost:4173

El guion lo escribe Claude de una de estas dos formas:
- **Sin coste extra:** si tienes instalado Claude Code (`claude`) con la sesión de tu suscripción iniciada, la app lo usa por defecto (`claude -p`). Cuenta contra los límites de tu suscripción.
- **Con API:** si defines `ANTHROPIC_API_KEY`, usa la API de Claude, que se factura aparte de la suscripción (de pago por uso).

La página es un **chat**: pídele ideas («dame 5 ideas que no hayamos hecho», «busca tendencias», «un meme para capitanes»). Si la idea está lista, la respuesta trae un botón **Crear este vídeo / meme**. Marca «Buscar en la web» para que investigue tendencias (con la suscripción usa las búsquedas del CLI; con API usa la herramienta de búsqueda web de la API, sin probar). Claude conoce lo que ya hay en `guiones/` y `memes/` para no repetirlo. Eliges dónde renderizar:
- **CI de GitHub:** Claude escribe el guion, la app lo sube con `git push`, el CI renderiza solo ese vídeo y la app descarga el MP4 en `out/`. Hace falta que `git push` funcione en tu equipo.
- **En local:** renderiza en tu ordenador (puede requerir `CHROME=/ruta/a/chrome`).

Claude solo elige entre las capturas de `capturas.json` (con su descripción); para ofrecerle más pantallas, añade la imagen a `public/ui/` y una entrada en ese archivo. Las claves nunca se guardan en el repo.

Licencias: fuentes Archivo y Syncopate bajo OFL (`public/fonts`). Logo y capturas de Zyra.
