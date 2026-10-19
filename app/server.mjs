// App local de Zyra Videos: describes el vídeo, Claude escribe el guion, se sube al repo y el CI lo renderiza.
// Uso: npm run app  ->  http://localhost:4173   (ver README para las variables de entorno)
import '../scripts/env.mjs';
import {createServer} from 'node:http';
import {execFile, execFileSync, spawn} from 'node:child_process';
import {readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync} from 'node:fs';
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
  if (!Array.isArray(g.subs) || g.subs.length !== 3) e.push('subs: tres subtítulos');
  else g.subs.forEach((s, i) => { const m = txt(s, LIMITES.sub, `subs[${i}]`); if (m) e.push(m); });
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
vídeo: {"tipo":"video","hook":["MÁX 16 CARACTERES","MÁX 16 CARACTERES"],"title":"MÁX 23, MAYÚSCULAS","src":"<una captura>","subs":["máx 42","máx 42","máx 42"],"cta":"máx 28"}
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
  const sistema = `Eres el guionista de vídeos de TikTok de Zyra, una app web para que capitanes de equipos de pádel organicen convocatorias, parejas, alineaciones y estadísticas. Escribes en español de España, directo y sin exagerar. Devuelve SOLO un objeto JSON (sin texto alrededor) con: hook (array de 2 textos EN MAYÚSCULAS, máx. ${LIMITES.hook} caracteres cada uno, que formen una pregunta o frase gancho), title (MAYÚSCULAS, máx. ${LIMITES.title}), src (una de las capturas), subs (array de 3 subtítulos, máx. ${LIMITES.sub} caracteres, que cuenten la función en orden), cta (máx. ${LIMITES.cta}, p. ej. «Pruébalo gratis»). No inventes funciones que no aparezcan en la descripción de la captura. Capturas disponibles:\n${cat.map((c) => `- ${c.src}: ${c.descripcion}`).join('\n')}`;
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

async function esperarCI(sha, log) {
  // GITHUB_TOKEN, o el de la sesión del CLI de GitHub (`gh auth login`) si está instalado.
  const token = process.env.GITHUB_TOKEN || (await sh('gh', ['auth', 'token']).catch(() => ''));
  if (!token) throw new Error('Falta un token de GitHub para seguir el CI y descargar el vídeo: define GITHUB_TOKEN o ejecuta `gh auth login` (ver README). Lo subido sigue renderizándose: míralo en la pestaña Actions del repo.');
  const repo = await repoSlug();
  const gh = (p, o = {}) => fetch(`https://api.github.com/repos/${repo}${p}`, {...o, headers: {authorization: `Bearer ${token}`, accept: 'application/vnd.github+json'}});
  log('Esperando al CI de GitHub…');
  for (let i = 0; i < 120; i++) {
    const runs = (await (await gh(`/actions/runs?head_sha=${sha}`)).json()).workflow_runs || [];
    const run = runs[0];
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
      try { execFileSync('unzip', ['-o', '-q', zip, '-d', join(ROOT, 'out')]); log('Vídeos extraídos en out/.'); } catch { log(`ZIP guardado en ${zip} (descomprímelo a mano).`); }
      return run.html_url;
    }
    await new Promise((r) => setTimeout(r, 10000));
  }
  throw new Error('El CI tardó más de 20 minutos; mira la pestaña Actions.');
}

async function trabajo(job, {peticion, modo, borrador, subtitulos = true, voz = false}) {
  const log = (m) => job.log.push(m);
  try {
    const cat = catalogo();
    const tipo = borrador?.tipo || 'video';
    const items = []; // {archivo, id, resultado}
    if (voz && modo !== 'local') throw new Error('La voz se añade en local (usa «Render: En local»): la clave de ElevenLabs no se sube al CI.');
    const sin = voz ? {voz: true, ...(subtitulos === false ? {subtitulos: false} : {})} : subtitulos === false || borrador?.subtitulos === false ? {subtitulos: false} : {}; // sin subtítulos → render.mjs deja out/<id>.voz.txt
    const guardar = (dir, base, obj, prefijo, ext) => {
      const id = slug(base) + '-' + Date.now().toString(36).slice(-4) + (items.length || '');
      mkdirSync(join(ROOT, dir), {recursive: true});
      const archivo = `${dir}/${id}.json`;
      writeFileSync(join(ROOT, archivo), JSON.stringify(obj, null, 2) + '\n');
      items.push({archivo, id: `${prefijo}${id}`, resultado: `out/${prefijo}${id}.${ext}` + (obj.subtitulos === false || obj.voz ? `, out/${prefijo}${id}.voz.txt` : '') + (obj.voz ? `, out/${prefijo}${id}.final.mp4` : '')});
    };
    if (tipo === 'lote') {
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
      job.guion = {hook: g.hook, title: g.title, src: g.src, imgW: pngWidth(g.src), scroll: c.scroll, ...(c.box ? {box: c.box} : {}), subs: g.subs, cta: g.cta, ...sin};
      guardar('guiones', g.title, job.guion, '', 'mp4');
    }
    log(`Guardado: ${items.map((i) => i.archivo).join(', ')}`);
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
          await shLineas(process.execPath, ['scripts/voz.mjs', i.id], (l) => { if (/^[✓⚠]/.test(l)) log(l); });
          k++;
        }
      }
      job.progreso = {pct: 100, fase: 'Listo'};
      job.resultado = items.map((i) => i.resultado).join(', ');
    } else {
      await sh('git', ['add', ...items.map((i) => i.archivo)]);
      await sh('git', ['commit', '-m', `${tipo}: ${items.map((i) => i.id).join(', ')}`.slice(0, 120)]);
      // Si el remoto tiene cambios nuevos (otro equipo, mis actualizaciones…), los integramos y reintentamos.
      try { await sh('git', ['push']); } catch {
        log('El remoto tiene cambios nuevos; los integro y reintento…');
        await sh('git', ['pull', '--rebase', '--autostash']);
        await sh('git', ['push']);
      }
      log('Subido; el CI empieza a renderizar.');
      job.resultado = await esperarCI(await sh('git', ['rev-parse', 'HEAD']), log);
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
    const {peticion, modo = 'ci', borrador, subtitulos, voz} = JSON.parse(body || '{}');
    if (!borrador && !String(peticion || '').trim()) return json(res, 400, {error: 'Escribe qué vídeo quieres.'});
    const id = Math.random().toString(36).slice(2, 10);
    const job = {estado: 'en curso', log: []};
    jobs.set(id, job);
    trabajo(job, {peticion, modo, borrador, subtitulos, voz});
    return json(res, 200, {id});
  }
  json(res, 404, {error: 'no encontrado'});
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!existsSync(join(ROOT, '.git'))) console.warn('Aviso: esto no es un clon de git; el modo CI no funcionará.');
  server.listen(PORT, '127.0.0.1', () => console.log(`Zyra Videos: http://localhost:${PORT}`));
}
