// Crea una plantilla de memes a partir de un clip o imagen: lo copia a public/medios/, Claude mira unos fotogramas
// y escribe cuándo usarla (descripción + etiquetas) en plantillas/<id>.json. El chat elige plantillas por esa descripción.
// Uso: node scripts/plantilla-desde-clip.mjs <archivo> <id> [--como recorte|fondo] [--pos arriba|abajo] [--seg 7] [--silencio]
// (con --como recorte el archivo debe ser PNG/WebM con transparencia o un clip ya recortado; por defecto: fondo)
import {execFileSync} from 'node:child_process';
import {copyFileSync, existsSync, mkdirSync, writeFileSync} from 'node:fs';
import {basename, extname, resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';

const [archivo, id, ...rest] = process.argv.slice(2);
const arg = (n, def) => { const i = rest.indexOf(`--${n}`); return i >= 0 ? rest[i + 1] : def; };
if (!archivo || !id || !/^[a-z0-9-]{2,40}$/.test(id)) { console.error('Uso: node scripts/plantilla-desde-clip.mjs <archivo> <id-en-minusculas> [--como recorte|fondo] [--pos arriba|abajo] [--seg 7] [--silencio]'); process.exit(1); }
if (!existsSync(archivo)) { console.error(`No encuentro el archivo: ${archivo}`); process.exit(1); }
const como = arg('como', 'fondo');
const ext = extname(archivo).toLowerCase();
const destino = `public/medios/${id}${ext}`;
mkdirSync('public/medios', {recursive: true});
copyFileSync(archivo, destino);

// Fotogramas sueltos (hasta 4) con el ffmpeg del sistema o el que trae Remotion.
const remotionCli = fileURLToPath(new URL('../node_modules/@remotion/cli/remotion-cli.js', import.meta.url));
const ffmpeg = (args) => { try { execFileSync('ffmpeg', args, {stdio: 'ignore'}); } catch (e) { if (e.code !== 'ENOENT') throw e; execFileSync(process.execPath, [remotionCli, 'ffmpeg', ...args], {stdio: 'ignore'}); } };
const dir = resolve(`referencias/.cache/plantilla-${id}`);
mkdirSync(dir, {recursive: true});
const esVideo = /\.(mp4|mov|webm)$/i.test(ext);
const fotos = [];
for (const [i, t] of (esVideo ? [0.3, 1.5, 2.7, 3.9] : [0]).entries()) {
  const f = resolve(dir, `f${i + 1}.jpg`);
  try { ffmpeg(['-v', 'error', '-y', ...(esVideo ? ['-ss', String(t)] : []), '-i', archivo, '-vf', 'scale=480:-2', '-frames:v', '1', f]); } catch { /* fuera de duración */ }
  if (existsSync(f)) fotos.push(f);
}
if (!fotos.length) { console.error('No pude extraer fotogramas.'); process.exit(1); }

const prompt = `Mira estas imágenes con la herramienta Read: ${fotos.join(' , ')}. Es material (${como === 'recorte' ? 'un recorte de persona u objeto' : 'un fondo'}) para memes de pádel de TikTok de Zyra (app para capitanes de equipos). Devuelve SOLO un JSON: {"descripcion":"una frase: qué se ve y CUÁNDO usarla (qué tipo de chiste o emoción encaja), máx 140 caracteres","etiquetas":["3-6 palabras sueltas: emoción, situación, lugar"]}`;
let meta = {descripcion: id, etiquetas: []};
try {
  const out = execFileSync('claude', ['-p', '--output-format', 'text', '--allowedTools=Read'], {input: prompt, cwd: tmpdir(), encoding: 'utf8', maxBuffer: 1 << 20, shell: process.platform === 'win32'});
  meta = JSON.parse(out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1));
} catch (e) { console.warn('No pude generar la descripción con Claude; edita plantillas/' + id + '.json a mano.'); }
const t = {descripcion: String(meta.descripcion || id).slice(0, 160), etiquetas: Array.isArray(meta.etiquetas) ? meta.etiquetas.slice(0, 8) : [], fondo: null, recorte: null, seg: Number(arg('seg', 7)), pos: arg('pos', 'arriba'), sonido: !rest.includes('--silencio')};
t[como === 'recorte' ? 'recorte' : 'fondo'] = `medios/${basename(destino)}`;
mkdirSync('plantillas', {recursive: true});
writeFileSync(`plantillas/${id}.json`, JSON.stringify(t, null, 2) + '\n');
console.log(`Plantilla guardada: plantillas/${id}.json\n  ${t.descripcion}\n  etiquetas: ${t.etiquetas.join(', ')}`);
