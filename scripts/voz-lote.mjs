// Añade voz y música a todos los vídeos de out/ cuyo guion o reacción tenga "voz": true (lo usa el CI).
// Proveedor: Azure Speech (AZURE_SPEECH_KEY) o ElevenLabs (ELEVENLABS_API_KEY + ELEVENLABS_VOICE_ID). Sin credenciales avisa y deja esos vídeos sin voz.
import './env.mjs';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, readdirSync, renameSync} from 'node:fs';

const ids = existsSync('out') ? readdirSync('out').filter((f) => f.endsWith('.voz.json')).map((f) => f.replace(/\.voz\.json$/, '')) : [];
let fallos = 0;
for (const id of ids) {
  const json = id.startsWith('reaccion-') ? `reacciones/${id.slice(9)}.json` : `guiones/${id}.json`;
  if (!existsSync(json) || !JSON.parse(readFileSync(json, 'utf8')).voz) continue;
  const azure = (process.env.VOZ_PROVEEDOR || (process.env.AZURE_SPEECH_KEY ? 'azure' : 'elevenlabs')) === 'azure';
  if (azure ? !process.env.AZURE_SPEECH_KEY : !process.env.ELEVENLABS_API_KEY || !process.env.ELEVENLABS_VOICE_ID) {
    console.log(`::warning::Faltan los secretos ${azure ? 'AZURE_SPEECH_KEY / AZURE_SPEECH_REGION' : 'ELEVENLABS_API_KEY / ELEVENLABS_VOICE_ID'}: ${id} queda sin voz`);
    continue;
  }
  try {
    execFileSync(process.execPath, ['scripts/voz.mjs', id], {stdio: 'inherit'});
    if (process.argv.includes('--limpiar') && existsSync(`out/${id}.final.mp4`)) {
      // El artefacto deja solo el vídeo con voz como <id>.mp4; el mudo va aparte en sin-audio/ para no confundirlos.
      mkdirSync('out/sin-audio', {recursive: true});
      renameSync(`out/${id}.mp4`, `out/sin-audio/${id}.mp4`);
      renameSync(`out/${id}.final.mp4`, `out/${id}.mp4`);
    }
  } catch { fallos++; console.log(`::error::Falló la voz de ${id}`); }
}
process.exit(fallos ? 1 : 0);
