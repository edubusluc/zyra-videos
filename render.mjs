// Une guiones/*.json (vídeos) memes/*.json (memes) y reacciones/*.json (reacciones) y renderiza out/<id>.mp4, out/meme-<id>.png y out/reaccion-<id>.mp4.
// Uso: npm run render [id…]   (los memes se llaman meme-<nombre>)
// Localmente puedes fijar CHROME=/ruta/a/chrome; en CI Remotion descarga su navegador.
import {execFileSync, spawnSync} from 'node:child_process';
import {existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync} from 'node:fs';

const ids = process.argv.slice(2);
const leer = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')).sort() : []).map((f) => ({id: f.replace(/\.json$/, ''), ...JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'))}));
const videos = leer('guiones');
const memes = leer('memes');
const reacciones = leer('reacciones');
writeFileSync('src/scripts.json', JSON.stringify(videos, null, 2));
writeFileSync('src/memes.json', JSON.stringify(memes, null, 2));
writeFileSync('src/reacciones.json', JSON.stringify(reacciones, null, 2));
mkdirSync('out', {recursive: true});
const browser = process.env.CHROME ? [`--browser-executable=${process.env.CHROME}`, '--chrome-mode=chrome-for-testing'] : [];
// Se llama al CLI de Remotion con node directamente: `npx` no se puede lanzar sin shell en Windows.
const remotion = (args) => execFileSync(process.execPath, ['node_modules/@remotion/cli/remotion-cli.js', ...args], {stdio: 'inherit'});
// Sin subtítulos: deja out/<id>.voz.txt con el texto y los segundos para grabar la voz en off.
const t = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0').replace('.', ',')}`;
const linea = (a, b, txt, leer = true) => ({a, b, txt, leer});
const guionVoz = (nombre, tramos) => {
  writeFileSync(`out/${nombre}.voz.txt`, `GUION PARA VOZ EN OFF · ${nombre}\nTiempos [min:seg,décimas]. Una frase por tramo; ajusta el ritmo para que quepa.\n\n${tramos.map((x) => `[${t(x.a)} – ${t(x.b)}]  ${x.txt}`).join('\n')}\n`);
  writeFileSync(`out/${nombre}.voz.json`, JSON.stringify(tramos, null, 2)); // lo lee scripts/voz.mjs
};
const quiere = (id) => !ids.length || ids.includes(id);
for (const v of videos) if (quiere(v.id)) {
  const conVoz = v.subtitulos === false || v.voz;
  if (conVoz) {
    // Mismo reparto que src/Feature.tsx (sin locución única): los subtítulos van de 104 a 450 fotogramas a partes iguales.
    const ini = v.subs.map((_, i) => Math.round(104 + (i * 346) / v.subs.length) / 30);
    guionVoz(v.id, [{...linea(0.1, 2.3, v.hook.map((h, i) => (i < v.hook.length - 1 && !/[.!?…,:]$/.test(h) ? `${h}.` : h)).join(' ') /* sin punto, «LISTA LLENA ¿Y AHORA QUIÉN?» se leía de corrido */), gancho: true} /* una sola locución: voz.mjs la sintetiza de una vez, con pausa corta entre las frases */, linea(2.3, 2.9, `(título en pantalla: ${v.title})`, false), ...v.subs.map((x, i) => linea(ini[i], ini[i + 1] ?? 15, (v.locucion?.[i] || x))), linea(15, 18, v.cta)]);
  }
  if (v.voz) {
    // Con voz: primero la locución única; los subtítulos y cortes del vídeo siguen a la voz. Si no hay credenciales o falla, tiempos fijos y una voz por frase (scripts/voz.mjs).
    rmSync(`out/${v.id}.tiempos.json`, {force: true});
    spawnSync(process.execPath, ['scripts/voz.mjs', v.id, '--narracion'], {stdio: 'inherit'});
    if (existsSync(`out/${v.id}.tiempos.json`)) {
      const {hookEnd, hookB, subs, cta, frames} = JSON.parse(readFileSync(`out/${v.id}.tiempos.json`, 'utf8'));
      v.tiempos = {hookEnd, ...(hookB !== undefined ? {hookB} : {}), subs, cta, frames};
    } else delete v.tiempos;
    writeFileSync('src/scripts.json', JSON.stringify(videos, null, 2));
  }
  remotion(['render', v.id, `out/${v.id}.mp4`, '--codec=h264', ...browser]);
}
for (const r of reacciones) if (quiere(`reaccion-${r.id}`)) {
  remotion(['render', `reaccion-${r.id}`, `out/reaccion-${r.id}.mp4`, '--codec=h264', '--image-format=png', ...browser]);
  if (r.subtitulos === false || r.voz) guionVoz(`reaccion-${r.id}`, [linea(0, r.seg ?? 6, r.caption)]);
}
for (const {id} of memes) if (quiere(`meme-${id}`)) remotion(['still', `meme-${id}`, `out/meme-${id}.png`, ...browser]);
