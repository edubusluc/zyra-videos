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
if (args.includes('--voces-azure')) { // lista las voces de España que ofrece tu región de Azure (las «DragonHD» son las más naturales)
  const k = process.env.AZURE_SPEECH_KEY, reg = process.env.AZURE_SPEECH_REGION || 'westeurope';
  if (!k) { console.error('Falta AZURE_SPEECH_KEY.'); await salir(1); }
  const r = await fetch(process.env.AZURE_SPEECH_VOICES_URL || `https://${reg}.tts.speech.microsoft.com/cognitiveservices/voices/list`, {headers: {'Ocp-Apim-Subscription-Key': k}});
  if (!r.ok) { console.error(`Azure Speech ${r.status}: ${(await r.text()).slice(0, 200)}. Revisa AZURE_SPEECH_KEY y AZURE_SPEECH_REGION.`); await salir(1); }
  const lista = (await r.json()).filter((v) => v.Locale === 'es-ES').sort((a, b) => /HD/.test(b.ShortName) - /HD/.test(a.ShortName));
  for (const v of lista) console.log(`${/HD/.test(v.ShortName) ? '★ HD ' : '     '} ${v.ShortName}  ${v.Gender}${v.StyleList?.length ? '  estilos: ' + v.StyleList.join(', ') : ''}`);
  console.log(`\n${lista.length} voces es-ES en ${reg}. Pon la elegida en AZURE_SPEECH_VOICE (.env y variable del CI).`);
  await salir(0);
}
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
// Por defecto es-ES-AlvaroNeural (hombre, voz con cuerpo de anuncio deportivo). Voces de España (es-ES), la más natural: es-ES-Ximena:DragonHDLatestNeural (mujer) o es-ES-Tristan:DragonHDLatestNeural (hombre); lista con --voces-azure. Estándar: ElviraNeural (mujer), AlvaroNeural (hombre), XimenaNeural, AbrilNeural, DarioNeural, EliasNeural, LaiaNeural…
const voice = opt('--voz') || (azure ? process.env.AZURE_SPEECH_VOICE || 'es-ES-AlvaroNeural' : process.env.ELEVENLABS_VOICE_ID);
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
const narracion = args.includes('--narracion'); // solo la locución única y sus tiempos (antes de renderizar el vídeo)
for (const f of narracion ? [guion] : [video, guion]) if (!existsSync(f)) { console.error(`No existe ${f}. Genera el vídeo con "subtitulos": false o "voz": true en su JSON.`); await salir(1); }
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
  t = t.replace(/\p{Extended_Pictographic}|\uFE0F/gu, '').replace(/\.{3,}/g, '…'); // sin emojis (algunas voces los leen) ni puntos suspensivos sueltos
  t = t.replace(/(^|\s)[.,;:·•\-–—]+(?=\s|$)/g, '$1').replace(/\s+/g, ' ').trim(); // signos sueltos: una voz puede deletrearlos («punto»)
  t = t.replace(/\b([a-z0-9-]+)\.(com|es|org|net)\b/gi, (_, a, b) => `${a.replace(/(zyra)(padel)/i, '$1 pádel')} punto ${b}`); // la web se dice, no se deletrea
  t = t.replace(/(^|[.!?]\s+|[¿¡])([a-záéíóúüñ])/g, (_, a, b) => a + b.toUpperCase()); // mayúscula al empezar frase
  if (/[.!?…]$/.test(t)) return t;
  return /\d$/.test(t) ? `${t}!` : `${t}.`; // «…10.» se lee «diez punto»: tras un número se cierra con «!»
};

/**
 * Entonación de locutor: si todas las frases van entre «¡…!», la voz las grita todas igual y suena plana y chillona.
 * Solo el gancho conserva su exclamación; el resto se dice como afirmación (las preguntas se respetan siempre).
 */
export const entonar = (frases) => frases.map((t, i) => (i === 0 ? t : t.replace(/¡/g, '').replace(/!(?=\s|$)/g, '.').replace(/(\d)\.$/, '$1!')));

console.log(`Voz: ${azure ? `Azure Speech · ${voice} · ${region}` : `ElevenLabs · ${voice}`}`);
mkdirSync('out/.voz-cache', {recursive: true});
const escXml = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Azure Speech (REST): SSML con velocidad y tono (AZURE_SPEECH_RATE p. ej. +5%, AZURE_SPEECH_PITCH p. ej. +2st) y estilo opcional (AZURE_SPEECH_STYLE, solo si la voz lo admite).
// Perfil de entrega de Azure: «natural» (por defecto: la voz tal cual, que es como mejor entona) o «deportivo» (+4 % de velocidad, sin tocar el tono).
// Subir el tono (+1st) y la velocidad (+10 %) a la vez sonaba a chillido sin entonación: no se hace por defecto. Las voces HD deciden solas el tono:
// con ellas solo se aplica lo que pidas tú. AZURE_SPEECH_RATE / PITCH / STYLE mandan sobre el perfil.
const hd = /DragonHD/i.test(voice);
const perfilAz = process.env.AZURE_SPEECH_PERFIL || 'natural';
const rate = process.env.AZURE_SPEECH_RATE || (!hd && perfilAz === 'deportivo' ? '+4%' : '');
const pitch = process.env.AZURE_SPEECH_PITCH || '';
const estiloAz = hd ? '' : process.env.AZURE_SPEECH_STYLE || '';
// nivel 0: estilo + velocidad/tono; 1: solo velocidad/tono; 2: texto plano (por si la voz rechaza el SSML)
// Pronunciación: AlvaroNeural articula mal la «r» inicial y la «g» suave («reventar de gente» → «geventar de yiente»). Se reescriben solo en el audio
// (los subtítulos no cambian): «rr» fuerza la vibrante y «j» la fricativa velar. Se amplía con AZURE_SPEECH_PRONUNCIACION='palabra=como suena;otra=…'.
const PRONUNCIACION = {reventar: 'rreventar', reventón: 'rreventón', gente: 'jente', gentes: 'jentes', rápido: 'rrápido', rápida: 'rrápida', rápidos: 'rrápidos', rápidas: 'rrápidas', resultado: 'rresultado', resultados: 'rresultados', rival: 'rrival', rivales: 'rrivales', ranking: 'ránkin', ...Object.fromEntries((process.env.AZURE_SPEECH_PRONUNCIACION || '').split(';').map((p) => p.split('=').map((x) => x.trim())).filter(([a, b]) => a && b))};
const pronunciar = (t) => t.replace(/[\p{L}]+/gu, (w) => { const r = PRONUNCIACION[w.toLowerCase()]; return r ? (w[0] === w[0].toUpperCase() ? r[0].toUpperCase() + r.slice(1) : r) : w; });
const ssmlAzure = (texto, nivel = 0, xml = false) => { // xml: el texto ya es XML (varias frases con <break/>)
  const cuerpoTxt = pronunciar(xml ? texto : escXml(texto));
  const prosodia = nivel < 2 && (rate || pitch);
  const cuerpo = prosodia ? `<prosody${rate ? ` rate="${escXml(rate)}"` : ''}${pitch ? ` pitch="${escXml(pitch)}"` : ''}>${cuerpoTxt}</prosody>` : cuerpoTxt;
  const estilo = nivel === 0 && estiloAz;
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="es-ES"><voice name="${voice}">${estilo ? `<mstts:express-as style="${escXml(estiloAz)}"${process.env.AZURE_SPEECH_STYLE_DEGREE ? ` styledegree="${escXml(process.env.AZURE_SPEECH_STYLE_DEGREE)}"` : ''}>${cuerpo}</mstts:express-as>` : cuerpo}</voice></speak>`;
};
let nivelAz = 0; // baja una vez si Azure rechaza el SSML y se mantiene para el resto de frases
const sintetizarAzure = async (texto, xml = false) => {
  for (;;) {
    const r = await fetch(process.env.AZURE_SPEECH_URL || `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {method: 'POST', headers: {'Ocp-Apim-Subscription-Key': key, 'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': 'audio-48khz-192kbitrate-mono-mp3', 'User-Agent': 'zyra-videos'}, body: ssmlAzure(texto, nivelAz, xml)});
    if (r.ok) return Buffer.from(await r.arrayBuffer());
    const cuerpo = await r.text();
    if (r.status === 401 || r.status === 403) throw new Error(`Azure Speech ${r.status}: clave o región incorrectas. Revisa AZURE_SPEECH_KEY y AZURE_SPEECH_REGION (la región de tu recurso, p. ej. westeurope).`);
    if (r.status === 400 && nivelAz < 2 && (nivelAz === 0 ? (estiloAz || rate || pitch) : (rate || pitch))) {
      nivelAz = nivelAz === 0 && estiloAz ? 1 : 2;
      console.warn(`⚠ Azure rechazó el SSML de la voz ${voice} (${cuerpo.slice(0, 120)}): se prueba ${nivelAz === 1 ? 'sin estilo' : 'sin estilo ni ajustes de velocidad/tono'}.`);
      continue;
    }
    throw new Error(`Azure Speech ${r.status}: ${cuerpo.slice(0, 300)}`);
  }
};
const sintetizar = async (texto, xml = false) => {
  const hash = createHash('sha1').update(azure ? `azure48|${xml}|${JSON.stringify(PRONUNCIACION)}|${voice}|${rate}|${pitch}|${estiloAz}|${process.env.AZURE_SPEECH_STYLE_DEGREE}|${nivelAz}|${texto}` : `${voice}|${modelo}|${JSON.stringify(ajustes)}|${texto}`).digest('hex').slice(0, 16);
  const f = `out/.voz-cache/${hash}.mp3`; // misma frase + misma voz = sin gastar caracteres otra vez
  if (existsSync(f)) return f;
  if (azure) { writeFileSync(f, await sintetizarAzure(texto, xml)); return f; }
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

// ---- Locución única (--narracion) ----
// Todo el guion hablado se pide de una sola vez (la entonación fluye de una frase a otra, como un locutor), con pausas marcadas entre frases;
// luego se localizan las frases en ese audio y se colocan en la línea de tiempo con huecos cortos y un único ajuste de velocidad para todas.
// Los tiempos resultantes (out/<id>.tiempos.json) los usa render.mjs para que subtítulos y cortes sigan a la voz, y este script para mezclar.
const PAUSA_AZ = 650; // ms entre frases dentro de la locución única (se recortan después)
const pcmMono = (f) => {
  const b = spawnSync(FF, ['-v', 'error', '-i', f, '-vn', '-ac', '1', '-ar', '16000', '-f', 'wav', '-'], {maxBuffer: 1 << 28}).stdout;
  const i = b && b.length ? b.indexOf('data') + 8 : 0;
  const n = i >= 8 ? Math.floor((b.length - i) / 2) : 0;
  const x = new Float32Array(n);
  for (let k = 0; k < n; k++) x[k] = b.readInt16LE(i + k * 2) / 32768;
  return x;
};
/** De las pausas candidatas (ordenadas en el tiempo) elige k que reparten el habla en tramos proporcionales al texto de cada frase; null si el reparto es inverosímil. */
const elegirPausas = (cand, k, frases, ini, fin) => {
  if (cand.length < k) return null;
  if (!frases) return cand.slice().sort((p, q) => (q[1] - q[0]) - (p[1] - p[0])).slice(0, k).sort((p, q) => p[0] - q[0]);
  const w = frases.map((f) => f.replace(/[^\p{L}\p{N}]/gu, '').length || 1), W = w.reduce((a, b) => a + b, 0);
  const objetivo = []; let c = 0;
  for (let i = 0; i < k; i++) { c += w[i]; objetivo.push(ini + (c / W) * (fin - ini)); }
  // programación dinámica: coste = desviación cuadrática de cada corte (punto medio de la pausa) respecto a su posición esperada
  const memo = new Map();
  const mejor = (i, desde) => {
    if (i === k) return {coste: 0, ruta: []};
    const clave = i * 1000 + desde;
    if (memo.has(clave)) return memo.get(clave);
    let r = {coste: Infinity, ruta: null};
    for (let j = desde; j <= cand.length - (k - i); j++) {
      const m = (cand[j][0] + cand[j][1]) / 2, sub = mejor(i + 1, j + 1);
      const coste = (m - objetivo[i]) ** 2 - (cand[j][1] - cand[j][0]) * 0.5 + sub.coste;
      if (sub.ruta && coste < r.coste) r = {coste, ruta: [j, ...sub.ruta]};
    }
    memo.set(clave, r);
    return r;
  };
  const r = mejor(0, 0);
  if (!r.ruta) return null;
  const sel = r.ruta.map((j) => cand[j]);
  // validación: ninguna frase puede durar mucho más (ni mucho menos) de lo que pide su texto
  const cortes = [ini, ...sel.flat(), fin];
  const ritmo = (fin - ini - sel.reduce((a, [s, e]) => a + (e - s), 0)) / W;
  for (let i = 0; i < frases.length; i++) {
    const d = cortes[2 * i + 1] - cortes[2 * i], esp = w[i] * ritmo;
    if (d > esp * 1.8 + 0.5 || d < esp * 0.45 - 0.2) return null;
  }
  return sel;
};
/** Busca en el audio las n-1 pausas entre frases (las que mejor encajan con el reparto de texto)  y devuelve {s, e} de cada una de las n frases, en segundos. */
const limitesPorSilencio = (mp3, n, frases) => {
  const x = pcmMono(mp3), V = 160; // ventanas de 10 ms a 16 kHz
  const nv = Math.floor(x.length / V), env = new Float32Array(nv);
  let pico = 0;
  for (let v = 0; v < nv; v++) { let q = 0; for (let k = 0; k < V; k++) q += x[v * V + k] ** 2; env[v] = Math.sqrt(q / V); pico = Math.max(pico, env[v]); }
  if (!nv || pico < 0.003) return null;
  for (const [rel, min] of [[0.02, 0.3], [0.05, 0.25], [0.1, 0.2]]) {
    const thr = pico * rel, runs = [];
    let a = -1;
    for (let v = 0; v <= nv; v++) {
      const callado = v < nv && env[v] < thr;
      if (callado && a < 0) a = v;
      if (!callado && a >= 0) { if ((v - a) / 100 >= min) runs.push([a / 100, v / 100]); a = -1; }
    }
    const ini = env.findIndex((e) => e >= thr) / 100;
    let fin = nv - 1; while (fin > 0 && env[fin] < thr) fin--;
    fin = (fin + 1) / 100;
    const dentro = runs.filter(([s, e]) => s > ini + 0.05 && e < fin - 0.05);
    if (dentro.length < n - 1) continue;
    // Las pausas no son siempre las n-1 más largas (una coma o un respiro dentro de una frase puede ser más largo que el hueco): se eligen las que dejan
    // cada frase con una duración proporcional a su texto, y si ni así encaja se descarta (se usará una voz por frase) en vez de cortar a media frase.
    const pausas = elegirPausas(dentro.sort((p, q) => p[0] - q[0]), n - 1, frases, ini, fin);
    if (!pausas) continue;
    const cortes = [ini, ...pausas.flat(), fin];
    return Array.from({length: n}, (_, i) => ({s: Math.max(0, cortes[2 * i] - 0.03), e: cortes[2 * i + 1] + 0.05}));
  }
  return null;
};
/** ElevenLabs con marcas de tiempo por carácter: las frases se localizan exactamente, sin buscar silencios. */
const sintetizarElevenUnico = async (frases) => {
  const texto = frases.join(modelo.includes('v3') ? '\n\n' : ' <break time="0.6s" /> ');
  const hash = createHash('sha1').update(`eleven-unico|${voice}|${modelo}|${JSON.stringify(ajustes)}|${texto}`).digest('hex').slice(0, 16);
  const f = `out/.voz-cache/${hash}.mp3`, fj = `${f}.json`;
  if (!existsSync(fj) || !existsSync(f)) {
    const r = await fetch(`${base}/v1/text-to-speech/${voice}/with-timestamps?output_format=mp3_44100_128`, {method: 'POST', headers: {'xi-api-key': key, 'content-type': 'application/json'}, body: JSON.stringify({text: texto, model_id: modelo, ...(/turbo|flash|v3/.test(modelo) ? {language_code: 'es'} : {}), ...(Object.keys(ajustes).length ? {voice_settings: ajustes} : {})})});
    if (!r.ok) throw new Error(`ElevenLabs ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const j = await r.json();
    writeFileSync(f, Buffer.from(j.audio_base64, 'base64'));
    writeFileSync(fj, JSON.stringify(j.alignment || j.normalized_alignment || null));
  }
  const al = JSON.parse(readFileSync(fj, 'utf8'));
  if (!al?.characters) return {mp3: f, seg: null};
  const txt = al.characters.join('');
  let pos = 0;
  const seg = [];
  for (const fr of frases) {
    const i = txt.indexOf(fr, pos);
    if (i < 0) return {mp3: f, seg: null};
    const j = i + fr.length - 1;
    seg.push({s: Math.max(0, al.character_start_times_seconds[i] - 0.03), e: al.character_end_times_seconds[j] + 0.05});
    pos = j + 1;
  }
  return {mp3: f, seg};
};
if (narracion) {
  const frases = entonar(tramos.map((x) => paraVoz(x.txt)));
  let mp3, seg;
  try {
    if (azure) { mp3 = await sintetizar(frases.map(escXml).join(`<break time="${PAUSA_AZ}ms"/>`), true); seg = limitesPorSilencio(mp3, frases.length, frases); }
    else ({mp3, seg} = await sintetizarElevenUnico(frases));
  } catch (e) { console.error(`✖ ${e.message}`); await salir(2); }
  if (!seg) { console.warn('⚠ No pude localizar las frases en la locución única: se usará una voz por frase con los tiempos fijos.'); await salir(2); }
  seg.forEach((x, i) => { x.dur = x.e - x.s; x.txt = frases[i]; });
  const GAPS = seg.map((_, i) => (i === 0 ? 0.55 : i === seg.length - 2 ? 0.35 : 0.28)); // tras el gancho cabe el título; antes del cierre, un respiro
  const FIN = 14.7; // objetivo: 15 s. Si las frases no caben ni acelerando algo (máx. ×1,12), el vídeo se alarga hasta 18 s
  const MAX_FACTOR = 1.05, MAX_SEG = 18; // acelerar más deforma la voz: mejor alargar el vídeo
  const colocar = (fct) => { let c = 0.1; return seg.map((x, i) => { const ini = c; c += x.dur / fct + GAPS[i]; return ini; }); };
  let factor = 1;
  for (let k = 0; k < 4; k++) {
    const ini = colocar(factor), fin = ini.at(-1) + seg.at(-1).dur / factor;
    if (fin <= FIN || factor >= MAX_FACTOR) break;
    factor = Math.min(MAX_FACTOR, factor * (fin / FIN));
  }
  const ini = colocar(factor);
  const fin = ini.at(-1) + seg.at(-1).dur / factor;
  const frames = Math.min(MAX_SEG * 30, Math.max(450, Math.ceil((fin + 0.8) * 30))); // duración del vídeo: 15 s o lo que pida la voz (con 0,8 s de cierre)
  if (fin + 0.8 > MAX_SEG) console.warn(`⚠ La locución acaba a los ${fin.toFixed(1)} s y no cabe en ${MAX_SEG} s: acorta los textos (locucion).`);
  // Fotogramas (30 fps) para src/Feature.tsx: fin del gancho, entrada de cada subtítulo (3 fotogramas antes de la voz) y entrada del cierre.
  const f30 = (t) => Math.round(t * 30);
  const hookEnd = Math.max(62, Math.ceil((ini[0] + seg[0].dur / factor + 0.12) * 30));
  const subs = [];
  for (let i = 1; i < seg.length - 1; i++) subs.push(Math.max(i === 1 ? hookEnd + 16 : subs[i - 2] + 20, f30(ini[i]) - 3));
  const cta = Math.min(frames - 45, Math.max(subs.at(-1) + 20, f30(ini.at(-1)) - 4));
  seg.forEach((x, i) => { x.ini = +ini[i].toFixed(3); });
  writeFileSync(`out/${id}.tiempos.json`, JSON.stringify({mp3, factor: +factor.toFixed(4), frases: seg, hookEnd, subs, cta, frames, fin: +fin.toFixed(2)}, null, 2));
  seg.forEach((x) => console.log(`✓ ${x.ini.toFixed(1)} s · ${(x.dur / factor).toFixed(1)} s · ${x.txt}`));
  console.log(`Locución única: ${fin.toFixed(1)} s${factor > 1.001 ? ` (×${factor.toFixed(2)} en todas las frases)` : ''} → gancho ${hookEnd}, subtítulos ${subs.join('/')}, cierre ${cta}, vídeo de ${frames} (fotogramas)`);
  await salir(0);
}

const MARGEN = 0.15; // aire al final de cada tramo
const HUECO_MIN = 0.8;
const MAX_ATEMPO = 1.3; // más rápido suena a ardilla
const MAX_ATEMPO_FINAL = 1.5; // solo el último tramo, que no puede pasar del final del vídeo
const clips = [];
const total = duracion(video);
const tiempos = existsSync(`out/${id}.tiempos.json`) ? JSON.parse(readFileSync(`out/${id}.tiempos.json`, 'utf8')) : null;
if (tiempos && existsSync(tiempos.mp3)) {
  // Locución única ya generada: cada frase se recorta de la misma toma y se coloca donde marcan los tiempos (con una sola velocidad común).
  for (const x of tiempos.frases) clips.push({mp3: tiempos.mp3, ss: x.s, ee: x.e, ini: x.ini, atempo: tiempos.factor, dur: x.dur / tiempos.factor + 0.05, recorta: false});
  console.log(`Voz: locución única (${tiempos.frases.length} frases${tiempos.factor > 1.001 ? `, ×${tiempos.factor}` : ''}), tiempos de out/${id}.tiempos.json`);
} else {
let libre = 0; // hasta cuándo está ocupada la voz: una frase nunca se corta, la siguiente espera a que acabe
for (const [k, x] of tramos.entries()) {
  const mp3 = await sintetizar(paraVoz(x.txt)).catch(async (e) => { console.error(`✖ ${e.message}`); await salir(1); });
  const d = duracion(mp3);
  const ini = Math.max(x.a, libre);
  const ultimo = k + 1 >= tramos.length;
  // La frase puede ocupar hasta donde empieza la siguiente que se lee (los tramos «solo en pantalla» no cuentan).
  const tope = ultimo ? total - 0.1 : tramos[k + 1].a;
  const hueco = Math.max(HUECO_MIN, tope - ini - (ultimo ? 0 : MARGEN));
  const atempo = Math.min(Math.max(d / hueco, 1), ultimo ? MAX_ATEMPO_FINAL : MAX_ATEMPO);
  const dur = d / atempo;
  const recorta = ini + dur > total - 0.05; // solo si ni así cabe en el vídeo
  if (recorta) console.warn(`⚠ «${x.txt}» no cabe antes del final del vídeo: se corta con un fundido; acorta el texto.`);
  if (ini - x.a > 0.8) console.warn(`⚠ «${x.txt}» entra ${(ini - x.a).toFixed(1)} s más tarde que su subtítulo porque la frase anterior es larga; acórtala (locución).`);
  clips.push({mp3, ini, atempo, dur: recorta ? Math.max(0.3, total - 0.05 - ini) : dur + 0.05, recorta});
  libre = ini + dur + 0.12;
  console.log(`✓ ${ini.toFixed(1)} s · ${d.toFixed(1)} s${atempo > 1.001 ? ` (×${atempo.toFixed(2)})` : ''} · ${x.txt}`);
}
}

// Música: --musica, o la primera de public/musica/. Sin música si no hay o con --sin-musica.
const dirMus = 'public/musica';
const musica = args.includes('--sin-musica') ? null : opt('--musica') || (existsSync(dirMus) ? readdirSync(dirMus).filter((f) => /\.(mp3|wav|m4a|ogg)$/i.test(f)).map((f) => join(dirMus, f))[0] : null) || null;
if (!musica) console.log('Sin música de fondo (pon un mp3 en public/musica/ o usa --musica).');

// Efectos de sonido del estilo «creador» (public/sfx, generados con scripts/sfx.mjs): whoosh al salir del gancho y antes del cierre,
// impacto en cada tarjeta de palabra clave y pop en los demás cambios de subtítulo. Mismos instantes que src/Feature.tsx.
const sfx = [];
{
  const v = existsSync('src/scripts.json') ? JSON.parse(readFileSync('src/scripts.json', 'utf8')).find((x) => x.id === id) : null;
  if (v && v.estilo !== 'base' && v.subtitulos !== false && !args.includes('--sin-sfx') && existsSync('public/sfx/whoosh.wav')) {
    const ini = tiempos ? tiempos.subs.map((f) => f / 30) : v.subs.map((_, i) => Math.round(86 + (i * 274) / v.subs.length) / 30);
    sfx.push({f: 'whoosh', t: (tiempos ? tiempos.hookEnd : 70) / 30 - 0.12, vol: 0.5});
    ini.forEach((t, i) => {
      if (i % 2 === 1) sfx.push({f: 'impacto', t, vol: 0.55}, {f: 'whoosh', t: t - 0.1, vol: 0.4});
      else if (i > 0) sfx.push({f: 'pop', t, vol: 0.5});
    });
    sfx.push({f: 'whoosh', t: (tiempos ? tiempos.cta : 360) / 30 - 0.12, vol: 0.5});
    console.log(`Efectos de sonido (estilo creador): ${sfx.length}`);
  }
}
// Cadena de voz de anuncio (VOZ_MEZCLA=anuncio, por defecto): quita retumbe, algo de presencia y compresión suave para que la voz
// vaya por delante de la música sin aplastar la entonación (la anterior, +3,5 dB a 3,2 kHz y compresión 4:1 con +5 dB, sonaba a grito). Necesita un ffmpeg completo (el del sistema; en el CI se instala): el mínimo de Remotion no trae
// esos filtros y entonces solo se normaliza el volumen. VOZ_MEZCLA=natural: solo volumen; VOZ_MEZCLA=no: como sale del proveedor.
const mezcla = process.env.VOZ_MEZCLA || 'anuncio';
const filtrosFF = new Set((spawnSync(FF, ['-hide_banner', '-filters'], {encoding: 'utf8'}).stdout || '').split('\n').map((l) => l.trim().split(/\s+/)[1]).filter(Boolean));
const CADENA_ANUNCIO = ['highpass', 'equalizer', 'acompressor', 'alimiter'];
const cadenaVoz = mezcla === 'anuncio' && CADENA_ANUNCIO.every((x) => filtrosFF.has(x))
  ? 'highpass=f=75,equalizer=f=250:t=q:w=1.2:g=-1.5,equalizer=f=2800:t=q:w=1.2:g=1.5,acompressor=threshold=-18dB:ratio=2:attack=12:release=180:makeup=1.5dB,alimiter=limit=0.89:level=false'
  : 'anull';
if (mezcla === 'anuncio' && cadenaVoz === 'anull') console.warn('⚠ Este ffmpeg no trae los filtros de la voz de anuncio (ecualizador y compresor): instala ffmpeg en el sistema. Solo se normaliza el volumen.');
// Volumen final de anuncio: −14 LUFS integrados y pico real de −1,5 dB, la referencia de TikTok, Reels y Shorts.
const normaliza = mezcla !== 'no' && filtrosFF.has('loudnorm') ? 'loudnorm=I=-14:TP=-1.5:LRA=11,' : '';
console.log(`Mezcla de voz: ${cadenaVoz !== 'anull' ? 'anuncio (EQ + compresor)' : 'sin procesar'}${normaliza ? ' · −14 LUFS' : ''}`);
const entradas = ['-i', video, ...clips.flatMap((c) => ['-i', c.mp3]), ...(musica ? ['-stream_loop', '-1', '-i', musica] : []), ...sfx.flatMap((e) => ['-i', `public/sfx/${e.f}.wav`])];
const filtros = clips.map((c, i) => `[${i + 1}:a]${c.ss !== undefined ? `atrim=${c.ss.toFixed(3)}:${c.ee.toFixed(3)},asetpts=PTS-STARTPTS,` : ''}${c.atempo > 1.001 ? `atempo=${c.atempo.toFixed(4)},` : ''}atrim=0:${c.dur.toFixed(3)},${c.recorta ? `volume='clip((${c.dur.toFixed(3)}-t)/0.15,0,1)':eval=frame,` : ''}adelay=${Math.round(c.ini * 1000)}|${Math.round(c.ini * 1000)}[v${i}]`);
const vozs = clips.map((_, i) => `[v${i}]`).join('');
const base0 = clips.length + 1 + (musica ? 1 : 0);
sfx.forEach((e, i) => { const ms = Math.max(0, Math.round(e.t * 1000)); filtros.push(`[${base0 + i}:a]volume=${e.vol},adelay=${ms}|${ms}[s${i}]`); });
filtros.push(`${vozs}amix=inputs=${clips.length}:normalize=0,${cadenaVoz}[vozp]`);
filtros.push(sfx.length ? `[vozp]${sfx.map((_, i) => `[s${i}]`).join('')}amix=inputs=${1 + sfx.length}:normalize=0[voz]` : '[vozp]anull[voz]');
if (musica) {
  const m = clips.length + 1;
  // Sin filtros avanzados (sidechain, afade, asplit), que faltan en el ffmpeg mínimo de Remotion:
  // el volumen de la música es una expresión del tiempo. Baja cuando habla la voz (rampas suaves) y tiene fundido de entrada y salida.
  const rampa = (c) => `clip((t-${(c.ini - 0.25).toFixed(2)})/0.25,0,1)*clip((${(c.ini + c.dur + 0.35).toFixed(2)}-t)/0.35,0,1)`;
  const duck = clips.map(rampa).reduce((acc, e) => (acc ? `max(${acc},${e})` : e), '');
  const base = 0.3, bajo = 0.08;
  const ganancia = `(${base}-${(base - bajo).toFixed(3)}*(${duck || '0'}))*clip(t/1,0,1)*clip((${total.toFixed(2)}-t)/1.5,0,1)`;
  filtros.push(`[${m}:a]volume='${ganancia}':eval=frame[mus]`, `[voz][mus]amix=inputs=2:normalize=0:duration=longest[mix]`);
} else filtros.push('[voz]anull[mix]');
// Sellos de tiempo limpios: el ffmpeg de Remotion deja la pista de audio con un inicio absurdo (años luz) y los reproductores pierden el sincronismo o van a tirones.
// aresample fija el inicio en 0; apad+atrim dejan el audio con la duración exacta del vídeo (apad sin límite no termina en ese ffmpeg).
filtros.push(`[mix]${normaliza}aresample=48000:async=1:first_pts=0,apad=whole_dur=${total.toFixed(3)},atrim=0:${total.toFixed(3)},asetpts=PTS-STARTPTS[a]`);
execFileSync(FF, ['-y', '-loglevel', 'error', ...entradas, '-filter_complex', filtros.join(';'), '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', `out/${id}.final.mp4`], {stdio: 'inherit'});
const tieneAudio = /Audio:/.test(spawnSync(FF, ['-i', `out/${id}.final.mp4`], {encoding: 'utf8'}).stderr || '');
if (!tieneAudio) { console.error('✖ El vídeo final no tiene pista de audio: algo falló al mezclar.'); await salir(1); }
// Mide el nivel real del audio (PCM decodificado, sin filtros que falten en el ffmpeg de Remotion): una pista muda también cuenta como fallo.
{
  const pcm = spawnSync(FF, ['-v', 'error', '-i', `out/${id}.final.mp4`, '-vn', '-ac', '1', '-ar', '8000', '-f', 'wav', '-'], {maxBuffer: 1 << 28}).stdout; // wav: es el único formato PCM que trae el ffmpeg de Remotion
  const ini = pcm ? pcm.indexOf('data') + 8 : 0; // tras la cabecera del WAV
  let suma = 0, pico = 0;
  const n = ini >= 8 ? Math.floor((pcm.length - ini) / 2) : 0;
  for (let i = 0; i < n; i++) { const v = pcm.readInt16LE(ini + i * 2) / 32768; suma += v * v; pico = Math.max(pico, Math.abs(v)); }
  const db = (x) => (x > 0 ? (20 * Math.log10(x)).toFixed(1) : '-inf');
  console.log(`Nivel del audio final: medio ${db(Math.sqrt(suma / (n || 1)))} dBFS, pico ${db(pico)} dBFS`);
  if (!n || pico < 0.003) { console.error('✖ El audio del vídeo final está en silencio: algo falló al mezclar.'); await salir(1); }
}
console.log(`Listo: out/${id}.final.mp4 (con voz${musica ? ' y música' : ''})`);
await new Promise((r) => setTimeout(r, 300)); // deja cerrar las conexiones: en Windows, salir de golpe tras fetch provoca «Assertion failed … async.c»
