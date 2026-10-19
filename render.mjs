// Une guiones/*.json (vídeos) memes/*.json (memes) y reacciones/*.json (reacciones) y renderiza out/<id>.mp4, out/meme-<id>.png y out/reaccion-<id>.mp4.
// Uso: npm run render [id…]   (los memes se llaman meme-<nombre>)
// Localmente puedes fijar CHROME=/ruta/a/chrome; en CI Remotion descarga su navegador.
import {execFileSync} from 'node:child_process';
import {existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync} from 'node:fs';

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
const quiere = (id) => !ids.length || ids.includes(id);
for (const {id} of videos) if (quiere(id)) remotion(['render', id, `out/${id}.mp4`, '--codec=h264', ...browser]);
for (const {id} of reacciones) if (quiere(`reaccion-${id}`)) remotion(['render', `reaccion-${id}`, `out/reaccion-${id}.mp4`, '--codec=h264', '--image-format=png', ...browser]);
for (const {id} of memes) if (quiere(`meme-${id}`)) remotion(['still', `meme-${id}`, `out/meme-${id}.png`, ...browser]);
