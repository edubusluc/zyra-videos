// Busca y prepara fondos de vídeo sin intervención: clips verticales libres de Pexels sobre pádel y deporte, pasados por el
// «etalonaje Zyra» (casi en blanco y negro, oscuros, con un toque verde lima en las luces y viñeta) para que nunca rompan la marca.
// Resultado: public/fondos/auto-<id>.mp4 (1080×1920, 12 s, sin audio) y su crédito en public/fondos/CREDITOS.md.
// Uso: PEXELS_API_KEY=... node scripts/fondos-auto.mjs [cuántos=6]   (en el CI se lanza solo si existe el secreto PEXELS_API_KEY)
// Licencia de Pexels: uso comercial sin atribución; no se usan clips donde se reconozca a nadie como protagonista (se descartan los de
// personas en primer plano por la búsqueda: términos de pista, pelota y red) ni se sugiere que nadie respalde Zyra.
import {execFileSync} from 'node:child_process';
import {appendFileSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync} from 'node:fs';

const key = process.env.PEXELS_API_KEY;
if (!key) { console.log('Sin PEXELS_API_KEY: no se buscan fondos (se usan los de public/fondos/ o la captura).'); process.exit(0); }
const quiero = Number(process.argv[2] || 6);
const DIR = 'public/fondos';
mkdirSync(DIR, {recursive: true});
const hay = readdirSync(DIR).filter((f) => f.startsWith('auto-') && f.endsWith('.mp4'));
if (hay.length >= quiero) { console.log(`Ya hay ${hay.length} fondos automáticos en ${DIR}/.`); process.exit(0); }
// Escenas sin protagonistas: la marca es la app; el fondo solo da ambiente de pista.
const CONSULTAS = ['padel court', 'tennis ball slow motion', 'padel ball', 'tennis net close up', 'sports court night lights', 'tennis court aerial'];
const ETALONAJE = [
  'scale=1080:1920:force_original_aspect_ratio=increase', 'crop=1080:1920', 'fps=30',
  'hue=s=0', 'eq=brightness=-0.14:contrast=1.1', // blanco y negro oscuro: el lima de la marca es el único color
  'colorbalance=gh=0.09:rh=0.02:bh=-0.10:gm=0.03:bm=-0.04', // luces hacia el verde lima de Zyra (#B4F100)
  'vignette=PI/4', 'gblur=sigma=2',
].join(',');
let nuevos = 0;
for (const q of CONSULTAS) {
  if (hay.length + nuevos >= quiero) break;
  const r = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(q)}&orientation=portrait&size=medium&per_page=6`, {headers: {Authorization: key}});
  if (!r.ok) { console.warn(`Pexels ${r.status} con «${q}»`); continue; }
  for (const v of (await r.json()).videos || []) {
    if (hay.length + nuevos >= quiero) break;
    const out = `${DIR}/auto-${v.id}.mp4`;
    if (existsSync(out) || v.duration < 6 || v.height < v.width) continue;
    const f = v.video_files.filter((x) => x.file_type === 'video/mp4' && x.width >= 720 && x.height > x.width).sort((a, b) => a.width - b.width)[0];
    if (!f) continue;
    const tmp = `${DIR}/.tmp-${v.id}.mp4`;
    try {
      writeFileSync(tmp, Buffer.from(await (await fetch(f.link)).arrayBuffer()));
      execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', tmp, '-t', '12', '-an', '-vf', ETALONAJE, '-c:v', 'libx264', '-crf', '30', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]);
      appendFileSync(`${DIR}/CREDITOS.md`, `- fondos/auto-${v.id}.mp4 — ${v.user?.name ?? '?'} (${v.url}), licencia Pexels, etalonaje Zyra\n`);
      console.log(`✓ ${out} («${q}», ${v.url})`);
      nuevos++;
    } catch (e) { console.warn(`✖ ${v.url}: ${e.message.split('\n')[0]}`); rmSync(out, {force: true}); }
    rmSync(tmp, {force: true});
  }
}
console.log(`Fondos automáticos: ${hay.length + nuevos} en ${DIR}/ (${nuevos} nuevos).`);
