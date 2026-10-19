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

## App local: «genera un vídeo para mostrar…»
    git clone https://github.com/edubusluc/zyra-videos && cd zyra-videos && npm install
    export ANTHROPIC_API_KEY=...   # clave de la API de Claude (de pago por uso, unos céntimos por guion)
    export GITHUB_TOKEN=...        # token con permiso de lectura de Actions en este repo (solo para el modo CI)
    npm run app                    # abre http://localhost:4173

Escribes qué vídeo quieres y eliges dónde renderizar:
- **CI de GitHub:** Claude escribe el guion, la app lo sube con `git push`, el CI renderiza solo ese vídeo y la app descarga el MP4 en `out/`. Hace falta que `git push` funcione en tu equipo.
- **En local:** renderiza en tu ordenador (puede requerir `CHROME=/ruta/a/chrome`).

Claude solo elige entre las capturas de `capturas.json` (con su descripción); para ofrecerle más pantallas, añade la imagen a `public/ui/` y una entrada en ese archivo. Las claves nunca se guardan en el repo.

Licencias: fuentes Archivo y Syncopate bajo OFL (`public/fonts`). Logo y capturas de Zyra.
