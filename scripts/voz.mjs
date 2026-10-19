// Pone voz en off (ElevenLabs) y música de fondo a un vídeo ya renderizado: out/<id>.mp4 + out/<id>.voz.json -> out/<id>.final.mp4
// Uso: node scripts/voz.mjs <id> [--musica ruta.mp3] [--voz <voice_id>] [--sin-musica]
// Variables: ELEVENLABS_API_KEY (obligatoria), ELEVENLABS_VOICE_ID, ELEVENLABS_MODEL (por defecto eleven_multilingual_v2), ELEVENLABS_BASE_URL (para pruebas).
import './env.mjs';
import {execFileSync, spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';

const args = process.argv.slice(2);
const opt = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
const id = args.find((a, i) => !a.startsWith('--') && !(i && ['--musica', '--voz'].includes(args[i - 1])));
if (!id) { console.error('Uso: node scripts/voz.mjs <id> [--musica ruta.mp3] [--voz <voice_id>] [--sin-musica]'); process.exit(1); }
const key = process.env.ELEVENLABS_API_KEY;
if (!key) { console.error('Falta ELEVENLABS_API_KEY (tu clave de elevenlabs.io → Profile → API Keys).'); process.exit(1); }
const voice = opt('--voz') || process.env.ELEVENLABS_VOICE_ID;
if (!voice) { console.error('Falta el id de la voz: ELEVENLABS_VOICE_ID o --voz <id> (en elevenlabs.io → Voices → copiar ID).'); process.exit(1); }
const base = process.env.ELEVENLABS_BASE_URL || 'https://api.elevenlabs.io';
// Ajustes de la voz (opcionales; si no se definen, ElevenLabs usa los de la voz).
const num = (n) => (process.env[n] !== undefined && process.env[n] !== '' ? Number(process.env[n]) : undefined);
const ajustes = Object.fromEntries(Object.entries({stability: num('ELEVENLABS_STABILITY'), similarity_boost: num('ELEVENLABS_SIMILARITY'), style: num('ELEVENLABS_STYLE'), speed: num('ELEVENLABS_SPEED'), use_speaker_boost: process.env.ELEVENLABS_SPEAKER_BOOST ? process.env.ELEVENLABS_SPEAKER_BOOST !== 'false' : undefined}).filter(([, v]) => v !== undefined && v === v));
const modelo = process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2';

const video = `out/${id}.mp4`;
const guion = `out/${id}.voz.json`;
for (const f of [video, guion]) if (!existsSync(f)) { console.error(`No existe ${f}. Genera el vídeo con "subtitulos": false o "voz": true en su JSON.`); process.exit(1); }
const tramos = JSON.parse(readFileSync(guion, 'utf8')).filter((x) => x.leer !== false);

// ffmpeg del sistema; si no hay, el que trae Remotion (sin ffprobe: la duración se lee de la salida de ffmpeg -i).
const ffmpegPath = () => {
  if (spawnSync('ffmpeg', ['-version']).status === 0) return 'ffmpeg';
  const dir = 'node_modules/@remotion';
  const c = existsSync(dir) ? readdirSync(dir).filter((d) => d.startsWith('compositor-')).map((d) => join(dir, d, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg')).find(existsSync) : null;
  if (c) return c;
  console.error('No encuentro ffmpeg: instálalo (https://ffmpeg.org) o ejecuta npm install.'); process.exit(1);
};
const FF = ffmpegPath();
const duracion = (f) => {
  const r = spawnSync(FF, ['-i', f], {encoding: 'utf8'});
  const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(r.stderr || '');
  if (!m) throw new Error(`No pude leer la duración de ${f}`);
  return +m[1] * 3600 + +m[2] * 60 + +m[3];
};

mkdirSync('out/.voz-cache', {recursive: true});
const sintetizar = async (texto) => {
  const hash = createHash('sha1').update(`${voice}|${modelo}|${JSON.stringify(ajustes)}|${texto}`).digest('hex').slice(0, 16);
  const f = `out/.voz-cache/${hash}.mp3`; // misma frase + misma voz = sin gastar caracteres otra vez
  if (existsSync(f)) return f;
  const r = await fetch(`${base}/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {method: 'POST', headers: {'xi-api-key': key, 'content-type': 'application/json'}, body: JSON.stringify({text: texto, model_id: modelo, language_code: 'es', ...(Object.keys(ajustes).length ? {voice_settings: ajustes} : {})})});
  if (!r.ok) throw new Error(`ElevenLabs ${r.status}: ${(await r.text()).slice(0, 300)}`);
  writeFileSync(f, Buffer.from(await r.arrayBuffer()));
  return f;
};

const MARGEN = 0.15; // aire al final de cada tramo
const MAX_ATEMPO = 1.3; // más rápido suena a ardilla; si no cabe, se avisa
const clips = [];
for (const x of tramos) {
  const mp3 = await sintetizar(x.txt);
  const d = duracion(mp3);
  const hueco = x.b - x.a - MARGEN;
  const factor = d > hueco ? d / hueco : 1;
  if (factor > MAX_ATEMPO) console.warn(`⚠ «${x.txt}» dura ${d.toFixed(1)} s y el hueco es de ${hueco.toFixed(1)} s: se acelera ×${MAX_ATEMPO} y se corta; acorta el texto.`);
  clips.push({mp3, ini: x.a, atempo: Math.min(Math.max(factor, 1), MAX_ATEMPO), dur: hueco});
  console.log(`✓ ${x.a.toFixed(1)} s · ${d.toFixed(1)} s${factor > 1 ? ` (×${Math.min(factor, MAX_ATEMPO).toFixed(2)})` : ''} · ${x.txt}`);
}

// Música: --musica, o la primera de public/musica/. Sin música si no hay o con --sin-musica.
const dirMus = 'public/musica';
const musica = args.includes('--sin-musica') ? null : opt('--musica') || (existsSync(dirMus) ? readdirSync(dirMus).filter((f) => /\.(mp3|wav|m4a|ogg)$/i.test(f)).map((f) => join(dirMus, f))[0] : null) || null;
if (!musica) console.log('Sin música de fondo (pon un mp3 en public/musica/ o usa --musica).');

const total = duracion(video);
const entradas = ['-i', video, ...clips.flatMap((c) => ['-i', c.mp3]), ...(musica ? ['-stream_loop', '-1', '-i', musica] : [])];
const filtros = clips.map((c, i) => `[${i + 1}:a]${c.atempo > 1.001 ? `atempo=${c.atempo.toFixed(4)},` : ''}atrim=0:${c.dur.toFixed(3)},adelay=${Math.round(c.ini * 1000)}|${Math.round(c.ini * 1000)}[v${i}]`);
const vozs = clips.map((_, i) => `[v${i}]`).join('');
filtros.push(`${vozs}amix=inputs=${clips.length}:normalize=0[voz]`);
if (musica) {
  const m = clips.length + 1;
  // La música sube y baja con fundidos y se agacha cuando habla la voz (sidechain).
  filtros.push(`[${m}:a]volume=0.35,afade=t=in:d=1,afade=t=out:st=${(total - 1.5).toFixed(2)}:d=1.5[mus]`, `[voz]asplit[voz1][voz2]`, `[mus][voz2]sidechaincompress=threshold=0.02:ratio=8:attack=30:release=500[duck]`, `[voz1][duck]amix=inputs=2:normalize=0[a]`);
} else filtros.push('[voz]anull[a]');
execFileSync(FF, ['-y', '-loglevel', 'error', ...entradas, '-filter_complex', filtros.join(';'), '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', total.toFixed(3), `out/${id}.final.mp4`], {stdio: 'inherit'});
console.log(`Listo: out/${id}.final.mp4`);
