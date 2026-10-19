// Pone voz en off (ElevenLabs o Azure Speech) y música de fondo a un vídeo ya renderizado: out/<id>.mp4 + out/<id>.voz.json -> out/<id>.final.mp4
// Uso: node scripts/voz.mjs <id> [--musica ruta.mp3] [--voz <voice_id>] [--sin-musica]
// Variables Azure: AZURE_SPEECH_KEY, AZURE_SPEECH_REGION (westeurope), AZURE_SPEECH_VOICE (es-ES-ElviraNeural), AZURE_SPEECH_RATE/PITCH/STYLE.
// Variables: ELEVENLABS_API_KEY (obligatoria), ELEVENLABS_VOICE_ID, ELEVENLABS_MODEL (por defecto eleven_multilingual_v2), ELEVENLABS_BASE_URL (para pruebas).
import './env.mjs';
import {execFileSync, spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';

const args = process.argv.slice(2);
const opt = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
const salir = async (c) => { await new Promise((r) => setTimeout(r, 300)); process.exit(c); }; // deja cerrar las conexiones: en Windows, salir de golpe tras fetch provoca «Assertion failed … async.c»
const avisoPermisos = (estado, cuerpo) => (/missing_permissions/.test(cuerpo)
  ? `ElevenLabs ${estado}: tu clave API no tiene todos los permisos. En elevenlabs.io → Developers → API Keys, edita la clave y activa «Text to Speech» y «Voices: Read» (o crea una clave nueva sin restricciones).`
  : `ElevenLabs ${estado}: ${cuerpo.slice(0, 300)}`);
if (args.includes('--voces')) { // lista las voces de tu cuenta (las «premade» valen en el plan gratuito por API)
  const k = process.env.ELEVENLABS_API_KEY;
  if (!k) { console.error('Falta ELEVENLABS_API_KEY.'); await salir(1); }
  const r = await fetch((process.env.ELEVENLABS_BASE_URL || 'https://api.elevenlabs.io') + '/v1/voices', {headers: {'xi-api-key': k}});
  if (!r.ok) { console.error(avisoPermisos(r.status, await r.text())); await salir(1); }
  for (const v of (await r.json()).voices) console.log(`${v.category === 'premade' ? '★ premade ' : '          '} ${v.voice_id}  ${v.name}${v.labels?.language ? ' · ' + v.labels.language : ''}${v.labels?.accent ? ' · ' + v.labels.accent : ''}${v.labels?.gender ? ' · ' + v.labels.gender : ''}`);
  console.log('\nCopia el ID de una voz premade en ELEVENLABS_VOICE_ID (.env).');
  await salir(0);
}
if (args.includes('--disenar') || args.includes('--guardar-voz')) {
  // Diseño de voz (puede requerir un plan de pago): crea candidatas desde una descripción y guarda la que te guste.
  const k = process.env.ELEVENLABS_API_KEY;
  if (!k) { console.error('Falta ELEVENLABS_API_KEY.'); await salir(1); }
  const base = process.env.ELEVENLABS_BASE_URL || 'https://api.elevenlabs.io';
  const llamar = async (ruta, cuerpo) => {
    const r = await fetch(base + ruta, {method: 'POST', headers: {'xi-api-key': k, 'content-type': 'application/json'}, body: JSON.stringify(cuerpo)});
    const t = await r.text();
    if (!r.ok) { console.error(avisoPermisos(r.status, t)); await salir(1); }
    return JSON.parse(t);
  };
  if (args.includes('--disenar')) {
    const descripcion = opt('--disenar');
    if (!descripcion || descripcion.length < 20) { console.error('Describe la voz (mínimo 20 caracteres): --disenar "mujer joven, español neutro latinoamericano, cercana, expresiva, ritmo ágil"'); await salir(1); }
    const j = await llamar('/v1/text-to-voice/design', {voice_description: descripcion, text: 'Hola, soy tu capitán de pádel. Con Zyra organizas la convocatoria, las parejas y la alineación en un momento. ¿Quién juega con quién? Los datos hablan, y tú decides. Pruébalo gratis.', model_id: 'eleven_multilingual_ttv_v2'});
    mkdirSync('out/voces-diseno', {recursive: true});
    (j.previews || []).forEach((p, n) => {
      const f = `out/voces-diseno/candidata-${n + 1}.mp3`;
      writeFileSync(f, Buffer.from(p.audio_base_64, 'base64'));
      console.log(`Candidata ${n + 1}: ${f}   id: ${p.generated_voice_id}`);
    });
    console.log('\nEscúchalas y guarda la que te guste con: node scripts/voz.mjs --guardar-voz <id> --nombre "Voz Zyra"');
  } else {
    const generated_voice_id = opt('--guardar-voz'), nombre = opt('--nombre') || 'Voz Zyra';
    const j = await llamar('/v1/text-to-voice', {voice_name: nombre, voice_description: opt('--descripcion') || 'Voz neutra en español para vídeos de Zyra', generated_voice_id});
    console.log(`Voz guardada. Ponla en el .env:\nELEVENLABS_VOICE_ID=${j.voice_id}`);
  }
  await new Promise((r) => setTimeout(r, 300));
  await salir(0);
}
const id = args.find((a, i) => !a.startsWith('--') && !(i && ['--musica', '--voz'].includes(args[i - 1])));
if (!id) { console.error('Uso: node scripts/voz.mjs <id> [--musica ruta.mp3] [--voz <voice_id>] [--sin-musica]'); await salir(1); }
// Proveedor de voz: VOZ_PROVEEDOR=azure | elevenlabs. Sin indicarlo, Azure si hay AZURE_SPEECH_KEY (aunque también haya clave de ElevenLabs).
const proveedor = process.env.VOZ_PROVEEDOR || (process.env.AZURE_SPEECH_KEY ? 'azure' : 'elevenlabs');
const azure = proveedor === 'azure';
const key = azure ? process.env.AZURE_SPEECH_KEY : process.env.ELEVENLABS_API_KEY;
if (!key) { console.error(azure ? 'Falta AZURE_SPEECH_KEY (portal.azure.com → tu recurso Speech → Claves y punto de conexión).' : 'Falta ELEVENLABS_API_KEY (tu clave de elevenlabs.io → Profile → API Keys).'); await salir(1); }
const region = process.env.AZURE_SPEECH_REGION || 'westeurope';
if (azure && !process.env.AZURE_SPEECH_REGION) console.warn('⚠ AZURE_SPEECH_REGION sin definir: se usa westeurope. Pon la región de tu recurso (p. ej. francecentral) o dará 401/403.');
// Voces de España (es-ES): ElviraNeural (mujer), AlvaroNeural (hombre), XimenaNeural, AbrilNeural, DarioNeural, EliasNeural, LaiaNeural…
const voice = opt('--voz') || (azure ? process.env.AZURE_SPEECH_VOICE || 'es-ES-ElviraNeural' : process.env.ELEVENLABS_VOICE_ID);
if (!voice) { console.error('Falta el id de la voz: ELEVENLABS_VOICE_ID o --voz <id> (en elevenlabs.io → Voices → copiar ID).'); await salir(1); }
const base = process.env.ELEVENLABS_BASE_URL || 'https://api.elevenlabs.io';
// Ajustes de la voz. Perfil por defecto «expresivo» (entonación marcada, poco plana); cualquier ELEVENLABS_* explícito manda sobre el perfil.
// ELEVENLABS_PERFIL=expresivo | natural | neutro (neutro = sin tocar los ajustes de la voz).
const PERFILES = {
  expresivo: {stability: 0.3, similarity_boost: 0.75, style: 0.55, speed: 1.0, use_speaker_boost: true},
  natural: {stability: 0.45, similarity_boost: 0.75, style: 0.2, speed: 1.0, use_speaker_boost: true},
  neutro: {},
};
const num = (n) => (process.env[n] !== undefined && process.env[n] !== '' ? Number(process.env[n]) : undefined);
const perfil = PERFILES[process.env.ELEVENLABS_PERFIL || 'expresivo'] ?? PERFILES.expresivo;
const ajustes = Object.fromEntries(Object.entries({...perfil, ...Object.fromEntries(Object.entries({stability: num('ELEVENLABS_STABILITY'), similarity_boost: num('ELEVENLABS_SIMILARITY'), style: num('ELEVENLABS_STYLE'), speed: num('ELEVENLABS_SPEED'), use_speaker_boost: process.env.ELEVENLABS_SPEAKER_BOOST ? process.env.ELEVENLABS_SPEAKER_BOOST !== 'false' : undefined}).filter(([, v]) => v !== undefined && v === v))}));
const modelo = process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2';

const video = `out/${id}.mp4`;
const guion = `out/${id}.voz.json`;
for (const f of [video, guion]) if (!existsSync(f)) { console.error(`No existe ${f}. Genera el vídeo con "subtitulos": false o "voz": true en su JSON.`); await salir(1); }
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

/**
 * Prepara el texto para hablarlo: los titulares en MAYÚSCULAS suenan planos y deletreados, así que se pasan a
 * frase normal (conservando siglas como SNP); y se asegura un cierre con puntuación, que da entonación.
 */
export const paraVoz = (txt) => {
  const SIGLAS = new Set(['SNP', 'PDF', 'URL', 'QR', 'IA', 'TV', 'FAQ']);
  let t = txt.replace(/\s+/g, ' ').trim();
  const letras = t.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, '');
  if (letras.length > 3 && letras === letras.toUpperCase()) {
    t = t.toLowerCase().replace(/[a-záéíóúüñ]+/gi, (w) => (SIGLAS.has(w.toUpperCase()) ? w.toUpperCase() : w));
  }
  t = t.replace(/(^|[.!?]\s+|[¿¡])([a-záéíóúüñ])/g, (_, a, b) => a + b.toUpperCase()); // mayúscula al empezar frase
  return /[.!?…]$/.test(t) ? t : `${t}.`;
};

console.log(`Voz: ${azure ? `Azure Speech · ${voice} · ${region}` : `ElevenLabs · ${voice}`}`);
mkdirSync('out/.voz-cache', {recursive: true});
const escXml = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Azure Speech (REST): SSML con velocidad y tono (AZURE_SPEECH_RATE p. ej. +5%, AZURE_SPEECH_PITCH p. ej. +2st) y estilo opcional (AZURE_SPEECH_STYLE, solo si la voz lo admite).
const ssmlAzure = (texto) => {
  const estilo = process.env.AZURE_SPEECH_STYLE;
  const cuerpo = `<prosody rate="${process.env.AZURE_SPEECH_RATE || '+0%'}" pitch="${process.env.AZURE_SPEECH_PITCH || '+0st'}">${escXml(texto)}</prosody>`;
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="es-ES"><voice name="${voice}">${estilo ? `<mstts:express-as style="${escXml(estilo)}" styledegree="${process.env.AZURE_SPEECH_STYLE_DEGREE || '1.5'}">${cuerpo}</mstts:express-as>` : cuerpo}</voice></speak>`;
};
const sintetizarAzure = async (texto) => {
  const r = await fetch(process.env.AZURE_SPEECH_URL || `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {method: 'POST', headers: {'Ocp-Apim-Subscription-Key': key, 'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': 'audio-24khz-96kbitrate-mono-mp3', 'User-Agent': 'zyra-videos'}, body: ssmlAzure(texto)});
  if (!r.ok) {
    const cuerpo = await r.text();
    if (r.status === 401 || r.status === 403) throw new Error(`Azure Speech ${r.status}: clave o región incorrectas. Revisa AZURE_SPEECH_KEY y AZURE_SPEECH_REGION (la región de tu recurso, p. ej. westeurope).`);
    throw new Error(`Azure Speech ${r.status}: ${cuerpo.slice(0, 300)}`);
  }
  return Buffer.from(await r.arrayBuffer());
};
const sintetizar = async (texto) => {
  const hash = createHash('sha1').update(azure ? `azure|${voice}|${process.env.AZURE_SPEECH_RATE}|${process.env.AZURE_SPEECH_PITCH}|${process.env.AZURE_SPEECH_STYLE}|${process.env.AZURE_SPEECH_STYLE_DEGREE}|${texto}` : `${voice}|${modelo}|${JSON.stringify(ajustes)}|${texto}`).digest('hex').slice(0, 16);
  const f = `out/.voz-cache/${hash}.mp3`; // misma frase + misma voz = sin gastar caracteres otra vez
  if (existsSync(f)) return f;
  if (azure) { writeFileSync(f, await sintetizarAzure(texto)); return f; }
  const r = await fetch(`${base}/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {method: 'POST', headers: {'xi-api-key': key, 'content-type': 'application/json'}, body: JSON.stringify({text: texto, model_id: modelo, ...(/turbo|flash|v3/.test(modelo) ? {language_code: 'es'} : {}), ...(Object.keys(ajustes).length ? {voice_settings: ajustes} : {})})});
  if (!r.ok) {
    const cuerpo = await r.text();
    if (r.status === 402) throw new Error('ElevenLabs 402: tu plan gratuito no puede usar voces de la biblioteca por API. Usa una voz «premade» (node scripts/voz.mjs --voces) o pasa a un plan de pago.');
    if (r.status === 401) throw new Error(avisoPermisos(401, cuerpo).replace(/^ElevenLabs 401: /, 'ElevenLabs 401: ') + (/missing_permissions/.test(cuerpo) ? '' : ' Revisa ELEVENLABS_API_KEY.'));
    throw new Error(`ElevenLabs ${r.status}: ${cuerpo.slice(0, 300)}`);
  }
  writeFileSync(f, Buffer.from(await r.arrayBuffer()));
  return f;
};

const MARGEN = 0.15; // aire al final de cada tramo
const MAX_ATEMPO = 1.35; // más rápido suena a ardilla; si no cabe, se avisa
const clips = [];
const total = duracion(video);
for (const [k, x] of tramos.entries()) {
  const mp3 = await sintetizar(paraVoz(x.txt)).catch(async (e) => { console.error(`✖ ${e.message}`); await salir(1); });
  const d = duracion(mp3);
  // La frase puede ocupar hasta donde empieza la siguiente que se lee (los tramos «solo en pantalla» no cuentan).
  const hasta = k + 1 < tramos.length ? tramos[k + 1].a : total - 0.3;
  const hueco = Math.max(0.8, Math.max(x.b, hasta) - x.a - MARGEN);
  const factor = d > hueco ? d / hueco : 1;
  const recorta = factor > MAX_ATEMPO;
  if (recorta) console.warn(`⚠ «${x.txt}» dura ${d.toFixed(1)} s y el hueco es de ${hueco.toFixed(1)} s: se acelera ×${MAX_ATEMPO} y se corta el final; acorta el texto.`);
  clips.push({mp3, ini: x.a, atempo: Math.min(Math.max(factor, 1), MAX_ATEMPO), dur: hueco, recorta});
  console.log(`✓ ${x.a.toFixed(1)} s · ${d.toFixed(1)} s${factor > 1 ? ` (×${Math.min(factor, MAX_ATEMPO).toFixed(2)})` : ''} · ${x.txt}`);
}

// Música: --musica, o la primera de public/musica/. Sin música si no hay o con --sin-musica.
const dirMus = 'public/musica';
const musica = args.includes('--sin-musica') ? null : opt('--musica') || (existsSync(dirMus) ? readdirSync(dirMus).filter((f) => /\.(mp3|wav|m4a|ogg)$/i.test(f)).map((f) => join(dirMus, f))[0] : null) || null;
if (!musica) console.log('Sin música de fondo (pon un mp3 en public/musica/ o usa --musica).');

const entradas = ['-i', video, ...clips.flatMap((c) => ['-i', c.mp3]), ...(musica ? ['-stream_loop', '-1', '-i', musica] : [])];
const filtros = clips.map((c, i) => `[${i + 1}:a]${c.atempo > 1.001 ? `atempo=${c.atempo.toFixed(4)},` : ''}atrim=0:${c.dur.toFixed(3)},${c.recorta ? `volume='clip((${c.dur.toFixed(3)}-t)/0.15,0,1)':eval=frame,` : ''}adelay=${Math.round(c.ini * 1000)}|${Math.round(c.ini * 1000)}[v${i}]`);
const vozs = clips.map((_, i) => `[v${i}]`).join('');
filtros.push(`${vozs}amix=inputs=${clips.length}:normalize=0[voz]`);
if (musica) {
  const m = clips.length + 1;
  // Sin filtros avanzados (sidechain, afade, asplit), que faltan en el ffmpeg mínimo de Remotion:
  // el volumen de la música es una expresión del tiempo. Baja cuando habla la voz (rampas suaves) y tiene fundido de entrada y salida.
  const rampa = (c) => `clip((t-${(c.ini - 0.25).toFixed(2)})/0.25,0,1)*clip((${(c.ini + c.dur + 0.35).toFixed(2)}-t)/0.35,0,1)`;
  const duck = clips.map(rampa).reduce((acc, e) => (acc ? `max(${acc},${e})` : e), '');
  const base = 0.3, bajo = 0.08;
  const ganancia = `(${base}-${(base - bajo).toFixed(3)}*(${duck || '0'}))*clip(t/1,0,1)*clip((${total.toFixed(2)}-t)/1.5,0,1)`;
  filtros.push(`[${m}:a]volume='${ganancia}':eval=frame[mus]`, `[voz][mus]amix=inputs=2:normalize=0:duration=first[a]`);
} else filtros.push('[voz]anull[a]');
execFileSync(FF, ['-y', '-loglevel', 'error', ...entradas, '-filter_complex', filtros.join(';'), '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', total.toFixed(3), `out/${id}.final.mp4`], {stdio: 'inherit'});
const tieneAudio = /Audio:/.test(spawnSync(FF, ['-i', `out/${id}.final.mp4`], {encoding: 'utf8'}).stderr || '');
if (!tieneAudio) { console.error('✖ El vídeo final no tiene pista de audio: algo falló al mezclar.'); await salir(1); }
console.log(`Listo: out/${id}.final.mp4 (con voz${musica ? ' y música' : ''})`);
await new Promise((r) => setTimeout(r, 300)); // deja cerrar las conexiones: en Windows, salir de golpe tras fetch provoca «Assertion failed … async.c»
