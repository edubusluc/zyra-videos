// Descarga clips verticales gratuitos de Pexels a public/medios/ y apunta el crédito.
// Uso: PEXELS_API_KEY=... node scripts/pexels.mjs "padel court" [cuántos=3]
// Clave gratuita en https://www.pexels.com/api/. La licencia de Pexels permite uso comercial sin atribución
// (no se pueden vender copias sin modificar, ni sugerir que personas o marcas respaldan Zyra).
import {appendFileSync, mkdirSync, writeFileSync} from 'node:fs';

const [consulta, n = '3'] = process.argv.slice(2);
const key = process.env.PEXELS_API_KEY;
if (!consulta || !key) { console.error('Uso: PEXELS_API_KEY=... node scripts/pexels.mjs "consulta" [n]'); process.exit(1); }
const r = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(consulta)}&orientation=portrait&per_page=${n}`, {headers: {Authorization: key}});
if (!r.ok) { console.error(`Pexels: ${r.status}`); process.exit(1); }
const {videos = []} = await r.json();
mkdirSync('public/medios', {recursive: true});
for (const v of videos) {
  const f = v.video_files.filter((x) => x.file_type === 'video/mp4' && x.width >= 720).sort((a, b) => a.width - b.width)[0] || v.video_files[0];
  const out = `public/medios/pexels-${v.id}.mp4`;
  writeFileSync(out, Buffer.from(await (await fetch(f.link)).arrayBuffer()));
  appendFileSync('public/medios/CREDITOS.md', `- medios/pexels-${v.id}.mp4 — ${v.user?.name ?? '?'} (${v.url}), licencia Pexels\n`);
  console.log(`${out}  ${f.width}x${f.height}  ${v.url}`);
}
if (!videos.length) console.log('Sin resultados.');
