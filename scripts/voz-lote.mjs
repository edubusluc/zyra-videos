// Añade voz y música a todos los vídeos de out/ cuyo guion o reacción tenga "voz": true (lo usa el CI).
// Sin ELEVENLABS_API_KEY / ELEVENLABS_VOICE_ID avisa y deja esos vídeos sin voz.
import './env.mjs';
import {execFileSync} from 'node:child_process';
import {existsSync, readFileSync, readdirSync} from 'node:fs';

const ids = existsSync('out') ? readdirSync('out').filter((f) => f.endsWith('.voz.json')).map((f) => f.replace(/\.voz\.json$/, '')) : [];
let fallos = 0;
for (const id of ids) {
  const json = id.startsWith('reaccion-') ? `reacciones/${id.slice(9)}.json` : `guiones/${id}.json`;
  if (!existsSync(json) || !JSON.parse(readFileSync(json, 'utf8')).voz) continue;
  if (!process.env.ELEVENLABS_API_KEY || !process.env.ELEVENLABS_VOICE_ID) {
    console.log(`::warning::Faltan los secretos ELEVENLABS_API_KEY / ELEVENLABS_VOICE_ID: ${id} queda sin voz`);
    continue;
  }
  try { execFileSync(process.execPath, ['scripts/voz.mjs', id], {stdio: 'inherit'}); } catch { fallos++; console.log(`::error::Falló la voz de ${id}`); }
}
process.exit(fallos ? 1 : 0);
