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
| `subs` | De 3 a 5 subtítulos que van cambiando (se reparten a partes iguales; la voz y el `.txt` siguen el mismo reparto) |
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
**Desde la app:** abre el panel «Plantillas (recortes y fondos)», sube el recorte (PNG con transparencia, WebM con alfa o MP4) y, si quieres, un fondo; ponle un nombre y una descripción de cuándo usarla y pulsa «Guardar plantilla». Con «Subir al repo» marcado se sube a GitHub para que el CI también la use (el repo es público: solo material propio o con licencia). El chat las conoce y las usa en reacciones y lotes. Un PNG recortado es una imagen fija; para movimiento usa WebM con alfa (ver `scripts/recortar.sh`).

**Cómo sabe el chat qué plantilla usar:** cada plantilla lleva una `descripcion` («qué se ve y cuándo usarla») y `etiquetas` (emoción, situación). El chat las recibe en cada petición y elige la que encaje con el chiste; si ninguna encaja, usa `pista-zyra`. Para que esa descripción sea buena:
    node scripts/plantilla-desde-clip.mjs mi-clip.mp4 risa-companero --como fondo
Claude mira unos fotogramas y la escribe él (puedes retocarla en `plantillas/<id>.json`). Con `PEXELS_API_KEY=… node scripts/pexels.mjs "padel court" 3 --plantilla` baja clips libres y los deja ya registrados como plantillas.

**A mano:**
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

## Con o sin subtítulos (voz en off)

En el chat hay una casilla **Con subtítulos** (marcada por defecto). Si la desmarcas, el vídeo se genera sin los textos
bajo el móvil (guion) ni el texto/emojis (reacción); el gancho, el título y la llamada final se mantienen.
Además se crea `out/<id>.voz.txt` con una línea por tramo y sus segundos, por ejemplo:

```
[0:02,9 – 0:05,5]  Un botón y Zyra propone la alineación
```

A mano: añade `"subtitulos": false` al JSON del guion o la reacción y ejecuta `npm run render`.
En el CI el `.voz.txt` va dentro del artefacto `videos-tiktok`.

## Estilo de los vídeos de la app

La plantilla `Feature` lleva fondo vivo (rejilla de pista, luces y partículas), barridos de color entre escenas, destellos en cada cambio de subtítulo, móvil que entra en 3D con zoom lento y latido de cámara, subtítulos que aparecen palabra a palabra, puntos de avance y un cierre con logo, botón y URL. Los tiempos no cambian, así que `out/<id>.voz.txt` sigue valiendo.

## Voz en off (ElevenLabs) y música de fondo

Resultado final con todo en un mp4: `out/<id>.final.mp4`.

1. Clave y voz: en elevenlabs.io copia tu API key y el ID de la voz elegida (Voices → ID). En PowerShell:
   `$env:ELEVENLABS_API_KEY="…"; $env:ELEVENLABS_VOICE_ID="…"` (la clave nunca va al repo).
2. Música: deja un mp3 en `public/musica/` (`.gitignore` lo excluye; usa solo música propia o con licencia que permita su uso comercial). Se usa la primera; o `--musica ruta.mp3`.
3. Desde la app: marca **Con voz y música** con «Render: En local». A mano: pon `"voz": true` en el JSON del guion o reacción, `npm run render <id>` y `npm run voz <id>`.

Cómo encaja: `render.mjs` deja `out/<id>.voz.json` con los tramos y sus segundos; `scripts/voz.mjs` pide a ElevenLabs cada frase, la acelera hasta ×1,3 si no cabe en su tramo (avisa si aun así no cabe), la coloca en su segundo exacto, baja la música mientras habla y le pone fundido de entrada y salida. Las frases ya generadas se guardan en `out/.voz-cache` para no gastar caracteres al repetir. Necesita ffmpeg (el del sistema o el de Remotion).

### Dónde van las claves

En un archivo `.env` en la raíz del proyecto (copia `.env.example`), una por línea: `ELEVENLABS_API_KEY=…` y `ELEVENLABS_VOICE_ID=…`. Lo leen la app y `npm run voz`; está en `.gitignore`, así que no se sube. Las variables de entorno del sistema tienen prioridad sobre el `.env`.

### Ajustar la voz

Opcional, en el mismo `.env` (ver `.env.example`): `ELEVENLABS_STABILITY`, `ELEVENLABS_SIMILARITY`, `ELEVENLABS_STYLE`, `ELEVENLABS_SPEED` (0,7–1,2), `ELEVENLABS_SPEAKER_BOOST` y `ELEVENLABS_MODEL`. Al cambiarlos se regeneran las frases (la caché los tiene en cuenta). La voz en sí se cambia con `ELEVENLABS_VOICE_ID` o `--voz <id>`; la música, con `--musica` o `--sin-musica`.

## Añadir más pantallas de la app

1. Haz la captura en el móvil (o en el navegador a ~390 px de ancho, escala ×2) con **datos de demostración**, nunca nombres reales.
2. `npm run captura -- ruta/pantalla.png --desc "Qué muestra, con los textos clave"` (o una carpeta entera: `npm run captura -- ruta/capturas/`).
3. Se copia a `public/ui/`, se calcula el desplazamiento y se añade a `capturas.json`. Si no pones `--desc`, queda «PENDIENTE: describe…»: edítalo, porque esa descripción es lo que lee Claude para elegir la captura y no inventar funciones.
4. Opcional: en `capturas.json` ajusta `scroll` y añade `box` `[x, y, ancho, alto]` para resaltar un elemento.

Para el chat basta con reiniciar `npm run app`.

### Capturar todas las pantallas automáticamente

`scripts/capturar-app.py` recorre la app de Zyra con datos de demostración y añade cada pantalla al catálogo. Se ejecuta con el Python del proyecto Zyra (el que tiene Django y Playwright; si falta el navegador: `playwright install chromium`):

```
python scripts/capturar-app.py --zyra C:\ruta\a\Zyra
```

Sin tocar tu base de datos ni el repo de Zyra: crea una SQLite temporal, carga `populate_db.py`, la **anonimiza** (club «ZYRA CLUB», jugadores «JUGADOR n», rivales «EQUIPO RIVAL n», sin escudos ni lugares), arranca el servidor en local, entra como capitán y hace una captura de móvil (390 px ×2) de unas 19 pantallas: inicio, jugadores, ficha, plantilla, equipos, enfrentamientos (borrador y cerrado), las cuatro estadísticas, miembros y perfil. Deja los PNG en `capturas-app/` (ignorado por git) y en `public/ui/`, con su descripción en `capturas.json`. Cuando cambie la interfaz, vuelve a ejecutarlo. Si añades una pantalla nueva a la app, añádela a la lista `PAGINAS` y a `DESCRIPCIONES` del script. En pantallas largas solo se recorre el principio para que el vídeo no vaya a toda velocidad.

### Error 402 de ElevenLabs y progreso del render

**Error 402 «paid_plan_required»:** el plan gratuito de ElevenLabs no puede usar por API las voces de la biblioteca. Lista las de tu cuenta con `node scripts/voz.mjs --voces` y copia el ID de una marcada como `★ premade` en `ELEVENLABS_VOICE_ID` (o pasa a un plan de pago para usar cualquier voz). Comprueba también que la licencia de la voz permita el uso que le des.

**Progreso:** al renderizar en local, la app muestra una barra con el porcentaje, la fase (fotogramas, codificación, voz y música) y el tiempo restante.

## Resultado final con voz y música (local y CI)

- **Dónde está el vídeo:** en local, cada prompt crea su carpeta `salidas/<fecha>_<hora>-<texto>/`. El vídeo bueno es `…FINAL-con-voz.mp4` (voz + música); `…sin-audio.mp4` es el mismo sin sonido, junto al `.voz.txt` con los tiempos y el JSON del guion. El archivo `out/<id>.mp4` es SIEMPRE el vídeo sin audio.
- **Música:** `public/musica/musica-zyra.mp3` (la del anuncio, sintetizada por nosotros, sin muestras externas ni licencias) se usa por defecto; baja sola mientras habla la voz y entra y sale con fundido. Otra: `--musica ruta.mp3` o deja otro mp3 en esa carpeta (se usa el primero por orden alfabético); sin música: `--sin-musica`.
- **En el CI:** en el repo (Settings → Secrets and variables → Actions) crea los *secrets* `ELEVENLABS_API_KEY` y `ELEVENLABS_VOICE_ID`; opcionalmente las *variables* `ELEVENLABS_MODEL`, `ELEVENLABS_STABILITY`, `ELEVENLABS_SIMILARITY`, `ELEVENLABS_STYLE` y `ELEVENLABS_SPEED`. Los guiones con `"voz": true` salen del artefacto `videos-tiktok` como `out/<id>.final.mp4`. Sin los secretos el CI avisa y deja el vídeo sin voz. Cada ejecución gasta caracteres de ElevenLabs solo de los guiones nuevos o cambiados.
- **Voz natural (punto de partida):** `ELEVENLABS_MODEL=eleven_multilingual_v2`, `ELEVENLABS_STABILITY=0.4`, `ELEVENLABS_SIMILARITY=0.75`, `ELEVENLABS_STYLE=0.1`, `ELEVENLABS_SPEED=1.0`. Estabilidad baja = más variación y menos robótica (por debajo de 0,3 puede inventar entonaciones raras). Estilo alto la hace teatral pero la encarece y la vuelve inestable. Escribe los subtítulos como se habla (frases cortas, sin mayúsculas ni siglas) y la voz suena mejor. Una voz nativa en español suena más natural que una premade inglesa.

**Descargar el resultado del CI:** el artefacto `videos-tiktok` contiene, para los vídeos con voz, solo `<id>.mp4` (con voz y música); el mudo queda en `sin-audio/<id>.mp4`. La app lo descomprime en `out/` (con `unzip` o, en Windows, `tar`) y lo ordena en `salidas/<fecha>-<texto>/` como `…FINAL-con-voz.mp4`. Si descargas el ZIP a mano desde la pestaña Actions, abre el `<id>.mp4` de la raíz. Si una frase es más larga que su hueco se acelera hasta ×1,35 y, si aun así no cabe, se corta con un fundido: acórtala.

## Eliminar y volver a generar (en la app)

El panel **Mis vídeos (eliminar o volver a generar)** lista los vídeos, reacciones y memes guardados. **Volver a generar** renderiza de nuevo el mismo archivo (sin duplicarlo; solo en local, y respeta las casillas «Con subtítulos» y «Con voz y música»). **Eliminar** borra su JSON y los archivos de `out/`; con la casilla marcada lo quita también del repo (commit y push), para que el CI no lo regenere. Las carpetas de `salidas/` no se tocan. En **Plantillas** cada una tiene su botón Eliminar; sus archivos de fondo y recorte solo se borran si ninguna otra plantilla ni reacción los usa.

## Voz más expresiva y con acento neutro

- **Perfil expresivo (por defecto):** estabilidad 0,3, estilo 0,55 y speaker boost, para que la entonación suba y baje en vez de sonar plana (`ELEVENLABS_PERFIL=natural` la contiene algo; cualquier `ELEVENLABS_*` suelto manda sobre el perfil). **Quita del `.env` los ajustes sueltos que pusiste antes** o no se aplicará el perfil.
- **Texto para hablar:** los titulares en MAYÚSCULAS se leen como frase normal (conservando siglas como SNP) y con puntuación de cierre; así suenan menos planos y deletreados.
- **Acento:** las voces `premade` gratuitas son inglesas y conservan acento al hablar español; eso no se arregla con ajustes. Opciones: una voz nativa de la biblioteca (plan de pago) o **diseñar una**: `node scripts/voz.mjs --disenar "mujer joven, español neutro latinoamericano, cercana y expresiva"` crea candidatas en `out/voces-diseno/` (escúchalas) y `node scripts/voz.mjs --guardar-voz <id> --nombre "Voz Zyra"` guarda la elegida y te da el `ELEVENLABS_VOICE_ID`. El diseño de voz puede requerir un plan de pago y no he podido probarlo contra la API real.
