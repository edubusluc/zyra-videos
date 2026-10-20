// App local de Zyra Videos: describes el vídeo, Claude escribe el guion, se sube al repo y el CI lo renderiza.
// Uso: npm run app  ->  http://localhost:4173   (ver README para las variables de entorno)
import '../scripts/env.mjs';
import {createServer} from 'node:http';
import {execFile, execFileSync, spawn} from 'node:child_process';
import {readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, copyFileSync, rmSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {tmpdir} from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 4173);
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
const catalogo = () => JSON.parse(readFileSync(join(ROOT, 'capturas.json'), 'utf8'));
const jobs = new Map();

const sh = (cmd, args) => new Promise((res, rej) => execFile(cmd, args, {cwd: ROOT}, (e, out, err) => (e ? rej(new Error((err || e.message).trim())) : res(out.trim()))));
/** Como sh, pero emite cada línea de salida (render.mjs / Remotion / voz.mjs) para poder mostrar el progreso. */
const shLineas = (cmd, args, onLinea) => new Promise((res, rej) => {
  const p = spawn(cmd, args, {cwd: ROOT});
  let resto = '', cola = '';
  const alimentar = (d) => {
    resto += d.toString();
    const partes = resto.split(/\r|\n/);
    resto = partes.pop();
    for (const l of partes) if (l.trim()) { onLinea(l.trim()); cola = (cola + '\n' + l.trim()).slice(-600); }
  };
  p.stdout.on('data', alimentar);
  p.stderr.on('data', alimentar);
  p.on('error', rej);
  p.on('close', (code) => (code === 0 ? res() : rej(new Error(cola.trim() || `${cmd} terminó con código ${code}`))));
});
const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'video';

/** Ancho en px de un PNG, leído de su cabecera. */
const pngWidth = (rel) => readFileSync(join(ROOT, 'public', rel)).readUInt32BE(16);

const LIMITES = {hook: 16, title: 23, sub: 42, cta: 28};

/** Valida el guion que devuelve el modelo; devuelve la lista de problemas (vacía si está bien). */
export function validar(g, cat) {
  const e = [];
  const txt = (v, max, n) => (typeof v === 'string' && v.trim() && v.length <= max ? null : `${n}: obligatorio y de máx. ${max} caracteres`);
  if (!Array.isArray(g.hook) || g.hook.length !== 2) e.push('hook: dos líneas');
  else g.hook.forEach((h, i) => { const m = txt(h, LIMITES.hook, `hook[${i}]`); if (m) e.push(m); });
  [txt(g.title, LIMITES.title, 'title'), txt(g.cta, LIMITES.cta, 'cta')].forEach((m) => m && e.push(m));
  if (!Array.isArray(g.subs) || g.subs.length < 3 || g.subs.length > 5) e.push(`subs: de 3 a 5 subtítulos (traía ${Array.isArray(g.subs) ? g.subs.length : 'ninguno'})`);
  else g.subs.forEach((s, i) => { const m = txt(String(s).replace(/\*/g, ''), LIMITES.sub, `subs[${i}]`); if (m) e.push(m); });
  if (g.locucion !== undefined) { // opcional: lo que se DICE en voz alta, uno por subtítulo
    if (!Array.isArray(g.locucion) || g.locucion.length !== (g.subs || []).length) e.push('locucion: una frase por cada subtítulo');
    else g.locucion.forEach((l, i) => { const m = txt(l, 45, `locucion[${i}]`); if (m) e.push(m); });
  }
  if (!cat.some((c) => c.src === g.src)) e.push(`src: debe ser una de ${cat.map((c) => c.src).join(', ')}`);
  return e;
}

/** Llama a Claude: con la API si hay ANTHROPIC_API_KEY (de pago por uso) o, si no, con el CLI `claude -p` de tu suscripción. */
async function llamar(sistema, mensajes, {web = false, max = 800} = {}) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (key) {
    const r = await fetch((process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com') + '/v1/messages', {
      method: 'POST',
      headers: {'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json'},
      body: JSON.stringify({model: MODEL, max_tokens: max, system: sistema, messages: mensajes, ...(web ? {tools: [{type: 'web_search_20250305', name: 'web_search', max_uses: 3}]} : {})}),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(`API de Claude: ${j.error?.message || r.status}`);
    return j.content.map((b) => b.text || '').join('');
  }
  const prompt = `${sistema}\n\n` + mensajes.map((m) => `${m.role === 'user' ? 'Petición' : 'Tu respuesta anterior'}:\n${m.content}`).join('\n\n');
  const cli = (extra) => new Promise((res, rej) => {
    const p = execFile('claude', ['-p', '--output-format', 'text', ...extra], {cwd: tmpdir(), timeout: 240000, maxBuffer: 1 << 20, shell: process.platform === 'win32'}, (e, out, err) => {
      if (!e) return res(out);
      if (e.code === 'ENOENT') return rej(new Error('No hay ANTHROPIC_API_KEY ni el CLI `claude` instalado y con sesión iniciada (ver README).'));
      // El CLI a veces escribe el motivo en stdout; lo incluimos para ver la causa real.
      const motivo = (err || out || e.message).toString().trim().slice(0, 600);
      const pista = /authenticat|OAuth|log ?in|expired/i.test(motivo) ? ' → Tu sesión de Claude Code ha caducado: abre una terminal, ejecuta `claude` y usa /login; luego reintenta.' : '';
      rej(new Error(`claude -p falló (código ${e.code}): ${motivo}${pista}`));
    });
    p.stdin.end(prompt);
  });
  if (!web) return cli([]);
  try { return await cli(['--allowedTools=WebSearch,WebFetch']); } catch (e) {
    // Si la búsqueda web falla (permisos, versión del CLI…), responde sin ella y avisa.
    return `(No pude usar la búsqueda web: ${e.message.slice(0, 200)}. Respondo sin ella.)\n\n` + (await cli([]));
  }
}

const LIM_MEME = {label: 14, texto: 70};
/** Valida un meme «antes / después»; devuelve los problemas. */
export function validarMeme(g) {
  const e = [];
  for (const [k, max] of [['beforeLabel', LIM_MEME.label], ['afterLabel', LIM_MEME.label], ['before', LIM_MEME.texto], ['after', LIM_MEME.texto]]) {
    if (typeof g[k] !== 'string' || !g[k].trim() || g[k].length > max) e.push(`${k}: obligatorio y de máx. ${max} caracteres`);
  }
  return e;
}

const medios = () => (existsSync(join(ROOT, 'public/medios')) ? readdirSync(join(ROOT, 'public/medios')).filter((f) => /\.(png|jpe?g|mp4|webm|mov)$/i.test(f)).map((f) => `medios/${f}`) : []);
/** Plantillas propias (plantillas/<id>.json): fondo, recorte, duración y posición del texto reutilizables. */
const plantillas = () => (existsSync(join(ROOT, 'plantillas')) ? readdirSync(join(ROOT, 'plantillas')).filter((f) => f.endsWith('.json')) : []).map((f) => ({id: f.replace(/\.json$/, ''), ...JSON.parse(readFileSync(join(ROOT, 'plantillas', f), 'utf8'))}));

/** Combina una reacción con su plantilla (los campos de la reacción mandan sobre los de la plantilla). */
function resolverReaccion(g) {
  const t = g.plantilla ? plantillas().find((x) => x.id === g.plantilla) : null;
  return {caption: g.caption, emojis: g.emojis ?? t?.emojis ?? '', fondo: g.fondo ?? t?.fondo ?? null, recorte: g.recorte ?? t?.recorte ?? null, seg: g.seg ?? t?.seg ?? 7, pos: g.pos ?? t?.pos ?? 'arriba', sonido: g.sonido ?? t?.sonido ?? true};
}

/** Valida una reacción: texto con el gancho del meme y, opcionalmente, plantilla y fondo/recorte que existan. */
export function validarReaccion(g, disponibles = medios()) {
  const e = [];
  if (typeof g.caption !== 'string' || !g.caption.trim() || g.caption.length > 90) e.push('caption: obligatorio y de máx. 90 caracteres');
  if (g.emojis != null && (typeof g.emojis !== 'string' || g.emojis.length > 12)) e.push('emojis: máx. 12 caracteres');
  if (g.plantilla && !plantillas().some((x) => x.id === g.plantilla)) e.push(`plantilla: debe ser una de ${plantillas().map((x) => x.id).join(', ') || '(no hay plantillas)'}`);
  for (const k of ['fondo', 'recorte']) if (g[k] != null && !disponibles.includes(g[k])) e.push(`${k}: debe ser null o uno de ${disponibles.join(', ') || '(no hay medios)'}`);
  return e;
}

const listar = (dir) => (existsSync(join(ROOT, dir)) ? readdirSync(join(ROOT, dir)).filter((f) => f.endsWith('.json')) : []).map((f) => JSON.parse(readFileSync(join(ROOT, dir, f), 'utf8')));

/** Fichas de referencias/*.md: formatos de memes que funcionan, analizados con scripts/analizar-referencia.mjs. */
const referencias = () => (existsSync(join(ROOT, 'referencias')) ? readdirSync(join(ROOT, 'referencias')).filter((f) => f.endsWith('.md')).slice(0, 8) : []).map((f) => readFileSync(join(ROOT, 'referencias', f), 'utf8').slice(0, 1800)).join('\n---\n');

/** Respuesta del chat de ideas: conoce lo ya creado y las capturas disponibles. */
async function chatear(mensajes, web) {
  const cat = catalogo();
  const hechos = listar('guiones').map((g) => `- vídeo «${g.title}»: ${g.hook.join(' ')}`).concat(listar('memes').map((m) => `- meme: ${m.before} / ${m.after}`));
  const sistema = `Eres el estratega de contenido de TikTok de Zyra (zyrapadel.com), una web gratuita para que capitanes de equipos de pádel organicen convocatorias en PDF, parejas, alineación sugerida, puntos SNP y estadísticas. Público: capitanes y jugadores de ligas por equipos en España. Tono: cercano, de pádel, con humor sano. Responde en español, breve y concreto.
Lo que ya está creado (no lo repitas, propón cosas distintas):
${hechos.join('\n') || '(nada todavía)'}
Capturas de la app disponibles para vídeos:
${cat.map((c) => `- ${c.src}: ${c.descripcion}`).join('\n')}
Cuando propongas una pieza concreta lista para producir, añade AL FINAL de tu respuesta un único bloque \`\`\`json con uno de estos formatos (el usuario lo convertirá con un botón):
vídeo: {"tipo":"video","hook":["MÁX 16 CARACTERES","MÁX 16 CARACTERES"],"title":"MÁX 23, MAYÚSCULAS","src":"<una captura>","subs":["máx 30","máx 30","máx 30 (de 3 a 5 en total; mejor 3 o 4 si el vídeo lleva voz, porque cada uno dura 2 o 3 s)"],"locucion":["lo que se DIRÍA en voz alta para cada subtítulo, en el mismo orden y cantidad: frase hablada en tono de locutor deportivo seguro y pausado, sin prisas (verbos de acción, frases cortas), con coma o ¿? donde dé entonación y la palabra clave entre *asteriscos* para que la voz la acentúe, sin puntos ni signos sueltos y sin terminar en número, MÁX 28 caracteres (la voz dice unos 8 caracteres por segundo y cada subtítulo dura unos 3 s con pausa antes y después: si es más larga el vídeo se alarga), sin MAYÚSCULAS ni emojis"],"cta":"máx 28"}
meme antes/después: {"tipo":"meme","beforeLabel":"ANTES","before":"máx 70 caracteres","afterLabel":"CON ZYRA","after":"máx 70 caracteres"}
meme de reacción (texto tipo «Tu compañero cuando…» sobre fondo y recorte): {"tipo":"reaccion","plantilla":"<id de plantilla o null>","caption":"máx 90 caracteres","emojis":"🎾😂"}  (sin plantilla, fondo y recorte: null usa la pista de Zyra sin personaje, o uno de los medios disponibles)
varios memes con la misma plantilla de una vez: {"tipo":"lote","plantilla":"<id>","captions":["máx 90","máx 90", … hasta 8]}
Plantillas disponibles (elígelas por su id según cuándo encajan): ${plantillas().map((t) => `${t.id}: ${t.descripcion || t.nombre}${t.etiquetas?.length ? ` [${t.etiquetas.join(', ')}]` : ''}`).join(' | ') || 'ninguna'}. Regla: elige la plantilla cuya descripción y etiquetas encajen con la emoción y la situación del chiste; si ninguna encaja claramente, usa «pista-zyra». No inventes ids.
Medios disponibles en public/medios: ${medios().join(', ') || 'ninguno (usa null)'}.
Formatos de referencia que funcionan en redes (fichas analizadas; inspírate en el formato, nunca copies el material de terceros):\n${referencias() || '(ninguno todavía)'}\nPara ideas sueltas no hace falta bloque. No inventes funciones que Zyra no tenga. Los memes son originales con la marca de Zyra; no uses plantillas ni imágenes con derechos de terceros. ${web ? 'Puedes buscar en la web tendencias o ideas si ayuda; cita de dónde sale lo que encuentres.' : ''}`;
  return llamar(sistema, mensajes, {web, max: 1500});
}

async function pedirGuion(peticion, log) {
  const cat = catalogo();
  const sistema = `Eres el guionista de vídeos de TikTok de Zyra, una app web para que capitanes de equipos de pádel organicen convocatorias, parejas, alineaciones y estadísticas. Escribes en español de España, directo y sin exagerar. Devuelve SOLO un objeto JSON (sin texto alrededor) con: hook (array de 2 textos EN MAYÚSCULAS, máx. ${LIMITES.hook} caracteres cada uno, que formen una pregunta o frase gancho), title (MAYÚSCULAS, máx. ${LIMITES.title}), src (una de las capturas), subs (array de 3 a 5 subtítulos; en cada uno envuelve entre asteriscos la palabra clave que más importa, p. ej. «Convoca en *10 segundos*»; máx. ${LIMITES.sub} caracteres, que cuenten la función en orden), cta (máx. ${LIMITES.cta}, p. ej. «Pruébalo gratis»). Ritmo pausado, sin prisas: el vídeo se lee con calma, así que cuenta UNA sola idea por subtítulo, con frases cortas (6 a 8 palabras) y como mucho 3 subtítulos salvo que la función exija más; si dudas entre añadir contenido o dejar aire, deja aire. No inventes funciones que no aparezcan en la descripción de la captura. Capturas disponibles:\n${cat.map((c) => `- ${c.src}: ${c.descripcion}`).join('\n')}`;
  let mensajes = [{role: 'user', content: peticion}];
  for (let intento = 1; intento <= 2; intento++) {
    log(`Pidiendo el guion a Claude (intento ${intento})…`);
    const texto = await llamar(sistema, mensajes);
    let g;
    try { g = JSON.parse(texto.slice(texto.indexOf('{'), texto.lastIndexOf('}') + 1)); } catch { g = null; }
    const errores = g ? validar(g, cat) : ['la respuesta no es JSON'];
    if (!errores.length) return g;
    log(`Guion no válido (${errores.join('; ')}); reintento.`);
    mensajes = [...mensajes, {role: 'assistant', content: texto}, {role: 'user', content: `Corrige estos problemas y devuelve solo el JSON: ${errores.join('; ')}`}];
  }
  throw new Error('Claude no devolvió un guion válido tras 2 intentos.');
}

const repoSlug = async () => (await sh('git', ['remote', 'get-url', 'origin'])).replace(/\.git$/, '').split(/github\.com[/:]/)[1];

async function esperarCI(ids, log) {
  // GITHUB_TOKEN, o el de la sesión del CLI de GitHub (`gh auth login`) si está instalado.
  const token = process.env.GITHUB_TOKEN || (await sh('gh', ['auth', 'token']).catch(() => ''));
  if (!token) throw new Error('Falta un token de GitHub para lanzar el CI y descargar el vídeo: define GITHUB_TOKEN o ejecuta `gh auth login` (ver README). El guion ya está subido: lánzalo a mano en Actions → Generar vídeos → Run workflow.');
  const repo = await repoSlug();
  const gh = (p, o = {}) => fetch(`https://api.github.com/repos/${repo}${p}`, {...o, headers: {authorization: `Bearer ${token}`, accept: 'application/vnd.github+json'}});
  const rama = await sh('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
  // Los pushes no renderizan solos: la app lanza el workflow a mano (workflow_dispatch) con los ids recién subidos.
  const antes = new Date(Date.now() - 60000).toISOString();
  log('Lanzando el workflow «Generar vídeos» en GitHub…');
  const d = await gh('/actions/workflows/render.yml/dispatches', {method: 'POST', body: JSON.stringify({ref: rama, inputs: {ids: ids.join(' ')}})});
  if (!d.ok) {
    const msg = (await d.json().catch(() => ({}))).message || '';
    const pista = d.status === 403 || d.status === 404 || d.status === 401
      ? 'El token no tiene permiso para lanzar workflows: necesita «Actions: Read and write» (fine-grained) o el scope «workflow» (clásico); con `gh auth login` ejecuta `gh auth refresh -s workflow`.'
      : '';
    throw new Error(`No se pudo lanzar el workflow (${d.status}${msg ? `: ${msg}` : ''}). ${pista} El guion ya está subido: lánzalo a mano en Actions → Generar vídeos → Run workflow.`.replace(/\s+/g, ' '));
  }
  log('Workflow lanzado; esperando al CI de GitHub…');
  let runId = null;
  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 10000));
    if (i === 12 && !runId) throw new Error('GitHub no ha creado el run tras lanzar el workflow (2 min). Míralo en la pestaña Actions del repo.');
    const runs = (await (await gh(`/actions/workflows/render.yml/runs?event=workflow_dispatch&branch=${encodeURIComponent(rama)}&created=%3E${antes}`)).json()).workflow_runs || [];
    // GitHub no devuelve el id del run al lanzar: tomamos el más antiguo creado tras `antes` y lo fijamos.
    const run = runId ? runs.find((r) => r.id === runId) : runs[runs.length - 1];
    if (run) runId = run.id;
    if (run && run.status === 'completed') {
      if (run.conclusion !== 'success') throw new Error(`El CI terminó con «${run.conclusion}»: ${run.html_url}`);
      const arts = (await (await gh(`/actions/runs/${run.id}/artifacts`)).json()).artifacts || [];
      if (!arts.length) throw new Error(`El CI no dejó artefactos: ${run.html_url}`);
      log('Descargando el vídeo…');
      const z = await gh(`/actions/artifacts/${arts[0].id}/zip`);
      if (!z.ok) throw new Error(`No se pudo descargar el artefacto (${z.status}). Descárgalo desde ${run.html_url}`);
      mkdirSync(join(ROOT, 'out'), {recursive: true});
      const zip = join(ROOT, 'out', `ci-${run.id}.zip`);
      writeFileSync(zip, Buffer.from(await z.arrayBuffer()));
      // unzip en Linux/Mac; en Windows 10+ `tar` (bsdtar) también lee ZIP.
      const extraer = [['unzip', ['-o', '-q', zip, '-d', join(ROOT, 'out')]], ['tar', ['-xf', zip, '-C', join(ROOT, 'out')]]];
      let ok = false;
      for (const [cmd, a] of extraer) { try { execFileSync(cmd, a); ok = true; break; } catch { /* prueba el siguiente */ } }
      log(ok ? 'Vídeos extraídos en out/.' : `No pude descomprimir el ZIP: está en ${zip}; descomprímelo a mano en out/.`);
      return run.html_url;
    }
  }
  throw new Error(`El CI tardó más de 20 minutos; mira la pestaña Actions${runId ? `: https://github.com/${repo}/actions/runs/${runId}` : ''}.`);
}

const TIPOS = {
  guion: {dir: 'guiones', prefijo: '', ext: 'mp4', titulo: (g) => g.title},
  reaccion: {dir: 'reacciones', prefijo: 'reaccion-', ext: 'mp4', titulo: (g) => g.caption},
  meme: {dir: 'memes', prefijo: 'meme-', ext: 'png', titulo: (g) => `${g.before} → ${g.after}`},
};
const ID_OK = /^[a-z0-9-]{2,80}$/;
const contenido = () => Object.entries(TIPOS).flatMap(([tipo, {dir, prefijo, ext, titulo}]) =>
  (existsSync(join(ROOT, dir)) ? readdirSync(join(ROOT, dir)).filter((f) => f.endsWith('.json')).sort() : []).map((f) => {
    const id = f.replace(/\.json$/, '');
    const g = JSON.parse(readFileSync(join(ROOT, dir, f), 'utf8'));
    return {tipo, id, titulo: titulo(g) || id, voz: Boolean(g.voz), renderizado: existsSync(join(ROOT, 'out', `${prefijo}${id}.${ext}`)), con_voz: existsSync(join(ROOT, 'out', `${prefijo}${id}.final.mp4`))};
  }));

/** Elimina un guion, reacción, meme o plantilla (y, si se pide, sus archivos generados y su copia en el repo). */
async function borrar({de, id, repo = false, archivos = true, medios = false}) {
  if (!ID_OK.test(id || '')) throw new Error('Id no válido.');
  const hechos = [];
  const quitar = (rel) => { if (existsSync(join(ROOT, rel))) { rmSync(join(ROOT, rel), {force: true}); hechos.push(rel); } };
  const rutas = [];
  if (de === 'plantilla') {
    const rel = `plantillas/${id}.json`;
    if (!existsSync(join(ROOT, rel))) throw new Error('Esa plantilla no existe.');
    const t = JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
    quitar(rel); rutas.push(rel);
    if (medios) {
      // Solo se borran fondo y recorte si ninguna otra plantilla ni reacción los usa.
      const usados = new Set([...plantillas().flatMap((x) => [x.fondo, x.recorte]), ...listarJson('reacciones').flatMap((x) => [x.fondo, x.recorte])].filter(Boolean));
      for (const m of [t.fondo, t.recorte].filter(Boolean)) if (!usados.has(m)) { quitar(`public/${m}`); rutas.push(`public/${m}`); }
    }
  } else {
    const def = TIPOS[de];
    if (!def) throw new Error('Tipo no válido.');
    const rel = `${def.dir}/${id}.json`;
    if (!existsSync(join(ROOT, rel))) throw new Error('Ese contenido no existe.');
    quitar(rel); rutas.push(rel);
    if (archivos) for (const sufijo of [`.${def.ext}`, '.final.mp4', '.voz.txt', '.voz.json']) quitar(`out/${def.prefijo}${id}${sufijo}`);
    if (archivos) quitar(`out/sin-audio/${id}.mp4`);
  }
  if (repo) {
    try {
      await sh('git', ['add', '-A', '--', ...rutas]);
      await sh('git', ['commit', '-m', `Eliminar ${de}: ${id}`.slice(0, 120)]);
      try { await sh('git', ['push']); } catch { await sh('git', ['pull', '--rebase', '--autostash']); await sh('git', ['push']); }
      hechos.push('(quitado también del repo)');
    } catch (e) { hechos.push(`(no se pudo quitar del repo: ${e.message.split('\n')[0]})`); }
  }
  return hechos;
}
const listarJson = (dir) => (existsSync(join(ROOT, dir)) ? readdirSync(join(ROOT, dir)).filter((f) => f.endsWith('.json')) : []).map((f) => JSON.parse(readFileSync(join(ROOT, dir, f), 'utf8')));

async function trabajo(job, {peticion, modo, borrador, subtitulos = true, voz = false, estilo = 'creador'}) {
  const log = (m) => job.log.push(m);
  try {
    const cat = catalogo();
    const tipo = borrador?.tipo || 'video';
    const items = []; // {archivo, id, resultado}
    const sin = voz ? {voz: true, ...(subtitulos === false ? {subtitulos: false} : {})} : subtitulos === false || borrador?.subtitulos === false ? {subtitulos: false} : {}; // sin subtítulos → render.mjs deja out/<id>.voz.txt
    const guardar = (dir, base, obj, prefijo, ext) => {
      const id = slug(base) + '-' + Date.now().toString(36).slice(-4) + (items.length || '');
      mkdirSync(join(ROOT, dir), {recursive: true});
      const archivo = `${dir}/${id}.json`;
      writeFileSync(join(ROOT, archivo), JSON.stringify(obj, null, 2) + '\n');
      items.push({archivo, id: `${prefijo}${id}`, resultado: `out/${prefijo}${id}.${ext}` + (obj.subtitulos === false || obj.voz ? `, out/${prefijo}${id}.voz.txt` : '') + (obj.voz ? `, out/${prefijo}${id}.final.mp4` : '')});
    };
    if (tipo === 'regenerar') {
      // Vuelve a renderizar un contenido ya guardado (p. ej. uno que salió mal), sin crear otro archivo.
      if (!TIPOS[borrador.de] || !ID_OK.test(borrador.id || '')) throw new Error('Qué regenerar: indica el tipo y el id.');
      const {dir, prefijo, ext} = TIPOS[borrador.de];
      const archivo = `${dir}/${borrador.id}.json`;
      if (!existsSync(join(ROOT, archivo))) throw new Error(`No existe ${archivo}.`);
      const obj = JSON.parse(readFileSync(join(ROOT, archivo), 'utf8'));
      if (voz) obj.voz = true; else if (obj.voz) voz = true;
      if (subtitulos === false) obj.subtitulos = false;
      writeFileSync(join(ROOT, archivo), JSON.stringify(obj, null, 2) + '\n');
      job.guion = obj;
      items.push({archivo, id: `${prefijo}${borrador.id}`, resultado: `out/${prefijo}${borrador.id}.${ext}`});
      peticion = `regenerar ${borrador.id}`;
    } else if (tipo === 'lote') {
      const caps = Array.isArray(borrador.captions) ? borrador.captions.slice(0, 8) : [];
      if (!caps.length) throw new Error('Lote sin textos.');
      for (const c of caps) {
        const g = {...borrador, tipo: 'reaccion', caption: c};
        const errores = validarReaccion(g);
        if (errores.length) throw new Error(`Reacción no válida («${c}»): ${errores.join('; ')}`);
        guardar('reacciones', c, {...resolverReaccion(g), ...sin}, 'reaccion-', 'mp4');
      }
      job.guion = {lote: caps.length, plantilla: borrador.plantilla || null};
    } else if (tipo === 'reaccion') {
      const errores = validarReaccion(borrador);
      if (errores.length) throw new Error(`Reacción no válida: ${errores.join('; ')}`);
      job.guion = {...resolverReaccion(borrador), ...sin};
      guardar('reacciones', borrador.caption, job.guion, 'reaccion-', 'mp4');
    } else if (tipo === 'meme') {
      const errores = validarMeme(borrador);
      if (errores.length) throw new Error(`Meme no válido: ${errores.join('; ')}`);
      job.guion = Object.fromEntries(['beforeLabel', 'before', 'afterLabel', 'after'].map((k) => [k, borrador[k]]));
      guardar('memes', borrador.before, job.guion, 'meme-', 'png');
    } else {
      const g = borrador || (await pedirGuion(peticion, log));
      const errores = validar(g, cat);
      if (errores.length) throw new Error(`Guion no válido: ${errores.join('; ')}`);
      const c = cat.find((x) => x.src === g.src);
      // Voz grabada: un audio por frase (gancho, cada subtítulo y cierre); con ellos el vídeo lleva voz sin proveedor.
      const audios = Array.isArray(g.audios) ? g.audios : null;
      if (audios) {
        if (audios.length !== g.subs.length + 2) throw new Error(`Faltan audios: hacen falta ${g.subs.length + 2} (gancho, ${g.subs.length} frases y cierre) y hay ${audios.length}.`);
        for (const a of audios) if (!/^voz\/[a-z0-9-]+\/\d\.mp3$/.test(a) || !existsSync(join(ROOT, 'public', a))) throw new Error(`No encuentro el audio ${a}; vuelve a subirlo.`);
        voz = true;
      }
      job.guion = {hook: g.hook, title: g.title, src: g.src, imgW: pngWidth(g.src), scroll: c.scroll, ...(c.box ? {box: c.box} : {}), subs: g.subs, ...(estilo === 'base' ? {estilo} : {}), ...(g.locucion ? {locucion: g.locucion} : {}), cta: g.cta, ...sin, ...(audios ? {audios, voz: true} : {})};
      guardar('guiones', g.title, job.guion, '', 'mp4');
    }
    log(tipo === 'regenerar' ? `Regenerando: ${items[0].archivo}` : `Guardado: ${items.map((i) => i.archivo).join(', ')}`);
    if (tipo === 'regenerar' && modo !== 'local') throw new Error('Regenerar se hace en local: elige «Render: En local».');
    // Una carpeta por prompt: salidas/<fecha>-<texto>/ con el vídeo final, el vídeo sin audio, el guion de voz y el JSON.
    const organizar = (ci = false) => {
      const d = new Date(), z = (x) => String(x).padStart(2, '0');
      const base = slug(String(peticion || borrador?.caption || borrador?.title || borrador?.before || items[0].id)).slice(0, 40);
      const carpeta = `salidas/${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}_${z(d.getHours())}${z(d.getMinutes())}-${base}`;
      mkdirSync(join(ROOT, carpeta), {recursive: true});
      const copiados = [];
      for (const i of items) {
        const nom = i.id;
        for (const [origen, destino] of [[ci && voz ? `out/${nom}.mp4` : `out/${nom}.final.mp4`, `${nom}.FINAL-con-voz.mp4`], [ci && voz ? `out/sin-audio/${nom}.mp4` : `out/${nom}.mp4`, voz ? `${nom}.sin-audio.mp4` : `${nom}.mp4`], [`out/${nom}.png`, `${nom}.png`], [`out/${nom}.voz.txt`, `${nom}.voz.txt`], [i.archivo, `${nom}.json`]]) {
          if (existsSync(join(ROOT, origen))) { copyFileSync(join(ROOT, origen), join(ROOT, carpeta, destino)); copiados.push(destino); }
        }
      }
      log(copiados.length ? `Carpeta: ${carpeta}/ → ${copiados.join(', ')}` : `No encontré los vídeos en out/ (si el ZIP del CI no se descomprimió, hazlo a mano en out/); carpeta vacía: ${carpeta}/`);
      job.carpeta = carpeta;
      job.resultado = `${carpeta}/` + (voz ? ' (abre el archivo «FINAL-con-voz.mp4»)' : '');
    };
    if (modo === 'local') {
      log('Renderizando en local…');
      // Progreso: el render ocupa hasta el 80 % (o el 100 % sin voz); cada vídeo con voz suma su parte del resto.
      const n = items.length, parteRender = voz ? 0.8 : 1;
      let hechos = 0, fase = 'Preparando…';
      const poner = (frac) => { job.progreso = {pct: Math.min(99, Math.round(100 * frac)), fase}; };
      poner(0);
      await shLineas(process.execPath, ['render.mjs', ...items.map((i) => i.id)], (l) => {
        const m = /(Rendered|Encoded)\s+(\d+)\/(\d+)/.exec(l);
        if (m) {
          const f = +m[2] / +m[3];
          fase = `${m[1] === 'Rendered' ? 'Renderizando fotogramas' : 'Codificando vídeo'} (${items.length > 1 ? `vídeo ${Math.min(hechos + 1, n)} de ${n}, ` : ''}${m[2]}/${m[3]}${/remaining: ([^,]+)/.exec(l) ? `, quedan ${/remaining: ([^,]+)/.exec(l)[1]}` : ''})`;
          poner(((hechos + (m[1] === 'Rendered' ? 0.7 * f : 0.7 + 0.3 * f)) / n) * parteRender);
          if (m[1] === 'Encoded' && +m[2] === +m[3]) hechos++;
        } else if (/Bundling|Webpack/i.test(l)) { fase = 'Preparando el proyecto…'; poner(0); }
      });
      if (voz) {
        let k = 0;
        for (const i of items) {
          fase = `Voz y música (${k + 1} de ${n})…`; poner(0.8 + (0.2 * k) / n); log(`Voz y música: ${i.id}…`);
          try {
            await shLineas(process.execPath, ['scripts/voz.mjs', i.id], (l) => { if (!/^Assertion failed/.test(l)) log(l); });
          } catch (e) {
            // En Windows Node puede abortar al salir aunque el vídeo ya esté hecho: si existe el final, se sigue.
            if (!existsSync(join(ROOT, 'out', `${i.id}.final.mp4`))) throw new Error(`No se pudo añadir la voz: ${e.message}`);
            log(`Aviso al cerrar voz.mjs: ${e.message.split('\n').pop()}`);
          }
          k++;
        }
      }
      job.progreso = {pct: 100, fase: 'Listo'};
      organizar();
    } else {
      await sh('git', ['add', ...items.map((i) => i.archivo), ...(job.guion?.audios || []).map((a) => `public/${a}`)]);
      await sh('git', ['commit', '-m', `${tipo}: ${items.map((i) => i.id).join(', ')}`.slice(0, 120)]);
      // Si el remoto tiene cambios nuevos (otro equipo, mis actualizaciones…), los integramos y reintentamos.
      try { await sh('git', ['push']); } catch {
        log('El remoto tiene cambios nuevos; los integro y reintento…');
        await sh('git', ['pull', '--rebase', '--autostash']);
        await sh('git', ['push']);
      }
      log('Subido; el CI empieza a renderizar.');
      await esperarCI(items.map((i) => i.id), log);
      organizar(true);
    }
    job.estado = 'hecho';
  } catch (e) {
    job.estado = 'error';
    job.error = e.message;
  }
}

const PAGINA = readFileSync(join(ROOT, 'app', 'index.html'), 'utf8');
const json = (res, code, obj) => { res.writeHead(code, {'content-type': 'application/json'}); res.end(JSON.stringify(obj)); };

const EXT_OK = /\.(png|webp|jpe?g|mp4|webm)$/i;
const MAX_SUBIDA = 60 * 1024 * 1024;

/** Sube archivos al repo (commit + push, integrando cambios remotos si hace falta). */
async function subirArchivos(archivos, mensaje) {
  await sh('git', ['add', ...archivos]);
  await sh('git', ['commit', '-m', mensaje.slice(0, 120)]);
  try { await sh('git', ['push']); } catch {
    await sh('git', ['pull', '--rebase', '--autostash']);
    await sh('git', ['push']);
  }
}

export const server = createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/') { res.writeHead(200, {'content-type': 'text/html; charset=utf-8'}); return res.end(PAGINA); }
  if (req.method === 'GET' && req.url.startsWith('/api/job/')) { const j = jobs.get(req.url.split('/').pop()); return j ? json(res, 200, j) : json(res, 404, {error: 'no existe'}); }
  if (req.method === 'GET' && req.url === '/api/contenido') return json(res, 200, {contenido: contenido(), plantillas: plantillas().map((p) => ({id: p.id, descripcion: p.descripcion, fondo: p.fondo, recorte: p.recorte}))});
  if (req.method === 'POST' && req.url === '/api/borrar') {
    let body = '';
    for await (const c of req) body += c;
    try { return json(res, 200, {ok: true, hechos: await borrar(JSON.parse(body || '{}'))}); } catch (e) { return json(res, 400, {error: e.message}); }
  }
  if (req.method === 'GET' && req.url === '/api/plantillas') return json(res, 200, {plantillas: plantillas(), medios: medios()});
  if (req.method === 'POST' && req.url.startsWith('/api/subir?')) {
    // Cuerpo = el archivo en bruto; el nombre va en ?nombre=
    const nombre = (new URL(req.url, 'http://x').searchParams.get('nombre') || '').replace(/[^\w.-]+/g, '-').slice(-80);
    if (!EXT_OK.test(nombre)) return json(res, 400, {error: 'Formato no admitido: usa png, webp, jpg, mp4 o webm.'});
    const trozos = []; let n = 0;
    for await (const c of req) { n += c.length; if (n > MAX_SUBIDA) return json(res, 413, {error: 'El archivo pesa más de 60 MB.'}); trozos.push(c); }
    mkdirSync(join(ROOT, 'public/medios'), {recursive: true});
    writeFileSync(join(ROOT, 'public/medios', nombre), Buffer.concat(trozos));
    return json(res, 200, {ruta: `medios/${nombre}`});
  }
  if (req.method === 'POST' && req.url.startsWith('/api/subir-voz?')) {
    // Una frase grabada por el usuario (cuerpo = el .mp3 en bruto). ?grupo=<carpeta del vídeo>&n=<orden de la frase: 0 = gancho>
    const q = new URL(req.url, 'http://x').searchParams;
    const grupo = (q.get('grupo') || '').replace(/[^a-z0-9-]+/g, '').slice(0, 40), n = Number(q.get('n'));
    if (!grupo || !Number.isInteger(n) || n < 0 || n > 9) return json(res, 400, {error: 'Falta el grupo o el número de frase.'});
    const ext = (/\.(mp3|wav|m4a|ogg)$/i.exec(q.get('nombre') || '') || [, 'mp3'])[1].toLowerCase();
    const trozos = []; let tam = 0;
    for await (const c of req) { tam += c.length; if (tam > 15 * 1024 * 1024) return json(res, 413, {error: 'El audio pesa más de 15 MB.'}); trozos.push(c); }
    const dir = join(ROOT, 'public/voz', grupo);
    mkdirSync(dir, {recursive: true});
    // Se guarda siempre como .mp3 (mono, 48 kHz): el CI y la mezcla leen un único formato, venga de donde venga la grabación.
    const origen = join(dir, `${n}.origen.${ext}`), destino = join(dir, `${n}.mp3`);
    writeFileSync(origen, Buffer.concat(trozos));
    try { execFileSync(process.env.FFMPEG || 'ffmpeg', ['-y', '-v', 'error', '-i', origen, '-vn', '-ac', '1', '-ar', '48000', '-b:a', '192k', destino]); } catch {
      if (ext !== 'mp3') { rmSync(origen, {force: true}); return json(res, 400, {error: 'No pude convertir el audio: instala ffmpeg o súbelo en .mp3.'}); }
      copyFileSync(origen, destino);
    }
    rmSync(origen, {force: true});
    return json(res, 200, {ruta: `voz/${grupo}/${n}.mp3`});
  }
  if (req.method === 'POST' && req.url === '/api/plantilla') {
    let body = '';
    for await (const c of req) body += c;
    try {
      const {id, descripcion, fondo = null, recorte = null, seg = 7, pos = 'arriba', sonido = true, subir = false} = JSON.parse(body || '{}');
      if (!/^[a-z0-9-]{2,40}$/.test(id || '')) return json(res, 400, {error: 'Nombre: 2-40 caracteres en minúsculas, números y guiones.'});
      for (const k of [fondo, recorte]) if (k && !medios().includes(k)) return json(res, 400, {error: `No existe ${k}; sube el archivo primero.`});
      if (!fondo && !recorte && !descripcion) return json(res, 400, {error: 'Sube un recorte o un fondo, o describe la plantilla.'});
      mkdirSync(join(ROOT, 'plantillas'), {recursive: true});
      const t = {descripcion: descripcion || id, fondo, recorte, seg: Number(seg) || 7, pos: pos === 'abajo' ? 'abajo' : 'arriba', sonido: Boolean(sonido)};
      writeFileSync(join(ROOT, 'plantillas', `${id}.json`), JSON.stringify(t, null, 2) + '\n');
      if (subir) await subirArchivos([`plantillas/${id}.json`, ...[fondo, recorte].filter(Boolean).map((m) => `public/${m}`)], `Plantilla: ${id}`);
      return json(res, 200, {ok: true, subida: Boolean(subir)});
    } catch (e) { return json(res, 500, {error: e.message}); }
  }
  if (req.method === 'POST' && req.url === '/api/frases') {
    // Las frases que hay que grabar, en orden, tal como las dirá la voz (gancho en una sola frase, locución si la hay, cierre).
    let body = '';
    for await (const c of req) body += c;
    try {
      const g = JSON.parse(body || '{}');
      if (!Array.isArray(g.hook) || !Array.isArray(g.subs)) return json(res, 400, {error: 'Guion sin gancho o sin subtítulos.'});
      const gancho = g.hook.reduce((acc, h) => (!acc ? h : /[.!?…,:;]$/.test(acc) || !/^[¿¡]/.test(h) ? `${acc} ${h}` : `${acc}, ${h}`), '');
      return json(res, 200, {frases: [gancho, ...g.subs.map((x, i) => String(g.locucion?.[i] || x).replace(/\*/g, '')), g.cta]});
    } catch (e) { return json(res, 400, {error: e.message}); }
  }
  if (req.method === 'POST' && req.url === '/api/chat') {
    let body = '';
    for await (const c of req) body += c;
    try {
      const {mensajes, web} = JSON.parse(body || '{}');
      if (!Array.isArray(mensajes) || !mensajes.length) return json(res, 400, {error: 'Escribe un mensaje.'});
      return json(res, 200, {respuesta: await chatear(mensajes, Boolean(web))});
    } catch (e) { return json(res, 500, {error: e.message}); }
  }
  if (req.method === 'POST' && req.url === '/api/generar') {
    let body = '';
    for await (const c of req) body += c;
    const {peticion, modo = 'ci', borrador, subtitulos, voz, estilo} = JSON.parse(body || '{}');
    if (!borrador && !String(peticion || '').trim()) return json(res, 400, {error: 'Escribe qué vídeo quieres.'});
    const id = Math.random().toString(36).slice(2, 10);
    const job = {estado: 'en curso', log: []};
    jobs.set(id, job);
    trabajo(job, {peticion, modo, borrador, subtitulos, voz, estilo});
    return json(res, 200, {id});
  }
  json(res, 404, {error: 'no encontrado'});
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!existsSync(join(ROOT, '.git'))) console.warn('Aviso: esto no es un clon de git; el modo CI no funcionará.');
  server.listen(PORT, '127.0.0.1', () => console.log(`Zyra Videos: http://localhost:${PORT}`));
}
