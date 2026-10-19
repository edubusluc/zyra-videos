// Une guiones/*.json en src/scripts.json y renderiza out/<id>.mp4. Uso: npm run render [id…]
// Localmente puedes fijar CHROME=/ruta/a/chrome; en CI Remotion descarga su navegador.
import {execFileSync} from 'node:child_process';
import {readdirSync, readFileSync, writeFileSync, mkdirSync} from 'node:fs';

const ids = process.argv.slice(2);
const files = readdirSync('guiones').filter((f) => f.endsWith('.json')).sort();
const all = files.map((f) => ({id: f.replace(/\.json$/, ''), ...JSON.parse(readFileSync(`guiones/${f}`, 'utf8'))}));
writeFileSync('src/scripts.json', JSON.stringify(all, null, 2));
mkdirSync('out', {recursive: true});
const browser = process.env.CHROME ? [`--browser-executable=${process.env.CHROME}`, '--chrome-mode=chrome-for-testing'] : [];
for (const {id} of all) {
  if (ids.length && !ids.includes(id)) continue;
  execFileSync('npx', ['remotion', 'render', id, `out/${id}.mp4`, '--codec=h264', ...browser], {stdio: 'inherit'});
}
