// Analiza un meme de referencia (vídeo o imagen) y guarda en referencias/<id>.md cómo está hecho.
// El chat de la app lee esas fichas para proponer memes del mismo formato con tus propios medios.
// Uso: node scripts/analizar-referencia.mjs <archivo.mp4|png|jpg> [nombre] ["nota: por qué funciona / métricas"]
// Los fotogramas se guardan en referencias/.cache (ignorado por git); solo la ficha de texto se sube al repo.
// Requiere el CLI `claude` con sesión iniciada y ffmpeg (o el que trae Remotion).
import {execFileSync} from 'node:child_process';
import {mkdirSync, writeFileSync, existsSync} from 'node:fs';
import {basename, extname, resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';

const [archivo, nombreArg, nota = ''] = process.argv.slice(2);
if (!archivo) { console.error('Uso: node scripts/analizar-referencia.mjs <archivo> [nombre] ["nota"]'); process.exit(1); }
if (!existsSync(archivo)) { console.error(`No encuentro el archivo: ${archivo}\nUsa la ruta real de tu vídeo (con una sola barra \\ en Windows). Truco: escribe el comando hasta "analizar-referencia.mjs " y arrastra el archivo a la terminal para pegar su ruta.`); process.exit(1); }
const id = (nombreArg || basename(archivo, extname(archivo))).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
mkdirSync('referencias/.cache', {recursive: true});
const dir = resolve(`referencias/.cache/${id}`);
mkdirSync(dir, {recursive: true});
const esVideo = /\.(mp4|mov|webm)$/i.test(archivo);
// ffmpeg del sistema si existe; si no, el que trae Remotion (se llama con node: `npx` no funciona sin shell en Windows).
const remotionCli = fileURLToPath(new URL('../node_modules/@remotion/cli/remotion-cli.js', import.meta.url));
const ffmpeg = (args) => { try { execFileSync('ffmpeg', args, {stdio: 'ignore'}); } catch (e) { if (e.code !== 'ENOENT') throw e; execFileSync(process.execPath, [remotionCli, 'ffmpeg', ...args], {stdio: 'ignore'}); } };
// Un fotograma cada 1,2 s (hasta 6) con -ss, sin filtros complejos: el ffmpeg de Remotion es mínimo.
const instantes = esVideo ? [0.3, 1.5, 2.7, 3.9, 5.1, 6.3] : [0];
const fotos = [];
for (const [i, t] of instantes.entries()) {
  const f = resolve(dir, `f${i + 1}.jpg`);
  try { ffmpeg(['-v', 'error', '-y', ...(esVideo ? ['-ss', String(t)] : []), '-i', archivo, '-vf', 'scale=480:-2', '-frames:v', '1', f]); } catch { /* instante fuera del vídeo */ }
  if (existsSync(f)) fotos.push(f);
}
if (!fotos.length) { console.error('No pude extraer fotogramas del archivo (¿formato no compatible?).'); process.exit(1); }

const prompt = `Mira estas imágenes con la herramienta Read, en orden (${esVideo ? 'fotogramas de un vídeo corto, uno cada ~1,2 s' : 'un meme'}): ${fotos.join(' , ')}. Es un meme de pádel de redes sociales que funciona. Escribe una ficha en español, en Markdown, SIN copiar su texto literal más de lo necesario, con estas secciones:
## Formato (una línea: cómo se llama el patrón, p. ej. «Tu compañero cuando…» + reacción)
## Estructura (fondo, personaje o recorte, texto: posición/estilo/longitud, emojis, ritmo; duración aproximada ${esVideo ? '(deduce de cuántos fotogramas hay)' : ''})
## Por qué funciona (2-3 frases)
## Cómo reproducirlo con Zyra Videos (campos de una reacción: caption, emojis, fondo, recorte, pos, seg; qué medios PROPIOS haría falta grabar o conseguir con licencia)
## No copiar (derechos de imagen o de autor del material original)
${nota ? `Nota del usuario: ${nota}` : ''}
Devuelve solo la ficha.`;
const ficha = execFileSync('claude', ['-p', '--output-format', 'text', '--allowedTools=Read'], {input: prompt, cwd: tmpdir(), encoding: 'utf8', maxBuffer: 1 << 20, shell: process.platform === 'win32'});
writeFileSync(`referencias/${id}.md`, `# Referencia: ${id}\n\n_Origen: ${basename(archivo)} (solo análisis; el material original no se guarda en el repo)_\n\n${ficha.trim()}\n`);
console.log(`Ficha guardada en referencias/${id}.md`);
