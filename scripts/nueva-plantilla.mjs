// Registra una plantilla propia para los memes de reacción en plantillas/<id>.json.
// Uso: node scripts/nueva-plantilla.mjs <id> --desc "cuándo usarla" [--fondo medios/x.mp4] [--recorte medios/y.webm] [--seg 6] [--pos arriba|abajo] [--silencio]
// Pon antes los archivos en public/medios/. El id: letras minúsculas, números y guiones.
import {existsSync, mkdirSync, writeFileSync} from 'node:fs';

const [id, ...rest] = process.argv.slice(2);
if (!id || !/^[a-z0-9-]+$/.test(id)) { console.error('Uso: node scripts/nueva-plantilla.mjs <id> --desc "…" [--fondo …] [--recorte …] [--seg n] [--pos arriba|abajo] [--silencio]'); process.exit(1); }
const arg = (n) => { const i = rest.indexOf(`--${n}`); return i >= 0 ? rest[i + 1] : undefined; };
const t = {descripcion: arg('desc') || id, fondo: arg('fondo') ?? null, recorte: arg('recorte') ?? null, seg: Number(arg('seg') ?? 7), pos: arg('pos') ?? 'arriba', sonido: !rest.includes('--silencio')};
for (const k of ['fondo', 'recorte']) if (t[k] && !existsSync(`public/${t[k]}`)) { console.error(`No existe public/${t[k]}`); process.exit(1); }
mkdirSync('plantillas', {recursive: true});
writeFileSync(`plantillas/${id}.json`, JSON.stringify(t, null, 2) + '\n');
console.log(`Plantilla guardada en plantillas/${id}.json`);
