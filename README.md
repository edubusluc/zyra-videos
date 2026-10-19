# zyra-videos

Genera vídeos verticales de Zyra (1080×1920, 15 s, sin audio) a partir de un guion en JSON. Remotion + GitHub Actions; no depende de ninguna conversación.

## Flujo normal (sin instalar nada)
1. Copia un archivo de `guiones/` (por ejemplo `alineacion-sugerida.json`), cámbiale el nombre y edita los textos.
2. Súbelo (commit a `main`). El flujo **Generar vídeos** (pestaña Actions) renderiza todos y deja los MP4 en el artefacto `videos-tiktok`.
3. Descarga el ZIP, sube el MP4 a TikTok y añade música desde su biblioteca.

También se puede lanzar a mano: Actions → Generar vídeos → Run workflow.

## Token de GitHub para descargar los vídeos del CI
Sin token, la app sube el guion y el CI renderiza, pero no puede descargar el resultado (lo bajas a mano desde Actions → ejecución → Artifacts). Para que lo descargue sola, una de dos:
- Instala el [CLI de GitHub](https://cli.github.com/) y ejecuta `gh auth login`; la app usa esa sesión.
- O crea un token en GitHub → Settings → Developer settings → Fine-grained tokens, solo para este repo, con permiso **Actions: Read-only**, y expórtalo como `GITHUB_TOKEN` antes de `npm run app`.

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

## Memes de reacción (como los de @AdictosPadel)
Formato: un fondo (foto o vídeo de pista), un recorte opcional de una persona reaccionando y un texto con borde: «Tu compañero cuando…». Se genera con `reacciones/<id>.json` (`caption`, `emojis`, `fondo`, `recorte`, `seg`) y sale como MP4 vertical; sin fondo ni recorte usa la pista de Zyra.
- **Fondos libres:** `PEXELS_API_KEY=… node scripts/pexels.mjs "padel court"` baja clips verticales gratuitos de Pexels (clave gratis; licencia de uso comercial sin atribución) y apunta el crédito en `public/medios/CREDITOS.md`.
- **Recortes:** lo mejor es grabar a tu equipo reaccionando; `scripts/recortar.sh clip.mp4 public/medios/recorte.webm` quita el fondo en local con [backgroundremover](https://github.com/albertbj/backgroundremover) (MIT).
- **No uses** clips de otras cuentas (p. ej. el vídeo viral de referencia): llevan derechos de imagen y de autor de terceros. Copiar el formato es libre; copiar el clip, no.
- Audio: si el recorte trae sonido se mantiene; si no, pon un sonido desde la biblioteca de TikTok al subirlo.

## Biblioteca de referencias (memes que funcionan)
No se «entrena» a Claude: se le da contexto. Cuando veas un meme que funciona en redes, analízalo:
    node scripts/analizar-referencia.mjs ruta/al/meme.mp4 nombre "nota: por qué crees que funciona / alcance"
Genera `referencias/<nombre>.md` (formato, estructura, por qué funciona, cómo reproducirlo con tus medios y qué no copiar). El chat lee esas fichas y propone memes del mismo patrón. Los fotogramas se quedan en `referencias/.cache` (no se suben): el repo es público, así que no se guarda material de terceros, solo el análisis. Añade también tus propias métricas en la nota (visitas, guardados) para que el chat aprenda qué rinde en vuestra cuenta.

## Plantillas propias y lotes
Una plantilla (`plantillas/<id>.json`) guarda un fondo, un recorte, la duración y la posición del texto para reutilizarlos. El chat las conoce, elige la que encaje y puede crear **varios memes de una vez** («Lote de memes»: hasta 8 textos con la misma plantilla).
    node scripts/nueva-plantilla.mjs doble-cristal --desc "compañero que se come el cristal" --recorte medios/doble-cristal.webm --fondo medios/pista.mp4 --pos arriba
Antes copia los archivos a `public/medios/`.

**Plantillas de CapCut:** no se pueden importar (son proyectos propietarios que solo abre CapCut, sin API ni formato abierto). Lo que sí sirve: monta en CapCut el fondo o la animación **sin texto**, expórtala en MP4/WebM, ponla en `public/medios/` y regístrala como plantilla; el texto lo pone esta app y así sale cada variante automáticamente. Usa solo material propio o con licencia: las plantillas de memes virales (imágenes y clips de terceros) llevan derechos de autor y de imagen.

## En local
    npm install
    npm run render [id]       # CHROME=/ruta/a/chrome si Remotion no descarga navegador
    npm run studio            # previsualizar

## App local: «genera un vídeo para mostrar…»
    git clone https://github.com/edubusluc/zyra-videos && cd zyra-videos && npm install
    export GITHUB_TOKEN=...        # solo modo CI; o usa `gh auth login` (CLI de GitHub) y no hace falta
    npm run app                    # abre http://localhost:4173

El guion lo escribe Claude de una de estas dos formas:
- **Sin coste extra:** si tienes instalado Claude Code (`claude`) con la sesión de tu suscripción iniciada, la app lo usa por defecto (`claude -p`). Cuenta contra los límites de tu suscripción.
- **Con API:** si defines `ANTHROPIC_API_KEY`, usa la API de Claude, que se factura aparte de la suscripción (de pago por uso).

La página es un **chat**: pídele ideas («dame 5 ideas que no hayamos hecho», «busca tendencias», «un meme para capitanes»). Si la idea está lista, la respuesta trae un botón **Crear este vídeo / meme**. Marca «Buscar en la web» para que investigue tendencias (con la suscripción usa las búsquedas del CLI; con API usa la herramienta de búsqueda web de la API, sin probar). Claude conoce lo que ya hay en `guiones/` y `memes/` para no repetirlo. Eliges dónde renderizar:
- **CI de GitHub:** Claude escribe el guion, la app lo sube con `git push`, el CI renderiza solo ese vídeo y la app descarga el MP4 en `out/`. Hace falta que `git push` funcione en tu equipo.
- **En local:** renderiza en tu ordenador (puede requerir `CHROME=/ruta/a/chrome`).

Claude solo elige entre las capturas de `capturas.json` (con su descripción); para ofrecerle más pantallas, añade la imagen a `public/ui/` y una entrada en ese archivo. Las claves nunca se guardan en el repo.

Licencias: fuentes Archivo y Syncopate bajo OFL (`public/fonts`). Logo y capturas de Zyra.
