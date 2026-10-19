// Añade capturas de la app al catálogo (capturas.json) para que el chat y los guiones puedan usarlas.
// Uso: node scripts/captura.mjs <imagen.png | carpeta> [más…] [--desc "qué muestra" | --descs descripciones.json]   (npm run captura -- …)
// Copia cada PNG a public/ui/, calcula el desplazamiento (de arriba a abajo de la pantalla) y añade la entrada.
// La descripción es lo que lee Claude para elegir la captura: con --desc (solo con una imagen) o editándola después en capturas.json.
import {copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync} from 'node:fs';
import {basename, extname, join} from 'node:path';

const args = process.argv.slice(2);
const i = args.indexOf('--desc');
const desc = i >= 0 ? args.splice(i, 2)[1] : undefined;
const j = args.indexOf('--descs');
const descs = j >= 0 ? JSON.parse(readFileSync(args.splice(j, 2)[1], 'utf8')) : {}; // {"archivo.png": "descripción"} para varias imágenes a la vez
if (!args.length) { console.error('Uso: node scripts/captura.mjs <imagen.png | carpeta> [más…] [--desc "qué muestra"]'); process.exit(1); }
const archivos = args.flatMap((a) => {
  if (!existsSync(a)) { console.error(`No existe: ${a}`); process.exit(1); }
  return statSync(a).isDirectory() ? readdirSync(a).filter((f) => /\.png$/i.test(f)).sort().map((f) => join(a, f)) : [a];
});
if (desc && archivos.length !== 1) { console.error('--desc solo vale con una imagen; para varias, edita capturas.json.'); process.exit(1); }
const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const PH_W = 680, PH_H = 900; // mismo móvil que src/Feature.tsx
mkdirSync('public/ui', {recursive: true});
const cat = JSON.parse(readFileSync('capturas.json', 'utf8'));
for (const f of archivos) {
  if (extname(f).toLowerCase() !== '.png') { console.warn(`Salto ${f}: solo PNG.`); continue; }
  const buf = readFileSync(f);
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  const nombre = slug(basename(f, extname(f))) + '.png';
  copyFileSync(f, join('public/ui', nombre));
  const visible = Math.round((PH_H * w) / PH_W); // alto de la imagen que cabe en la pantalla del móvil
  const fin = Math.round(Math.min(Math.max(0, h - visible), visible * 1.2)); // en pantallas largas solo se recorre el principio, para que el vídeo no vaya a toda velocidad
  const ini = Math.min(fin, Math.round(fin * 0.1));
  const entrada = {src: `ui/${nombre}`, descripcion: desc || descs[basename(f)] || `PENDIENTE: describe qué muestra «${basename(f)}»`, scroll: [ini, fin]};
  const k = cat.findIndex((c) => c.src === entrada.src);
  if (k >= 0) cat[k] = {...cat[k], scroll: entrada.scroll, ...(desc || descs[basename(f)] ? {descripcion: desc || descs[basename(f)]} : {})}; else cat.push(entrada);
  console.log(`${k >= 0 ? 'Actualizada' : 'Añadida'} ${entrada.src} (${w}×${h}, scroll ${ini}→${fin})${entrada.descripcion.startsWith('PENDIENTE') && k < 0 ? ' · falta la descripción' : ''}`);
}
writeFileSync('capturas.json', '[\n' + cat.map((c) => '  ' + JSON.stringify(c)).join(',\n') + '\n]\n');
