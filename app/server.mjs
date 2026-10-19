// App local de Zyra Videos: describes el vídeo, Claude escribe el guion, se sube al repo y el CI lo renderiza.
// Uso: npm run app  ->  http://localhost:4173   (ver README para las variables de entorno)
import {createServer} from 'node:http';
import {execFile, execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 4173);
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
const catalogo = () => JSON.parse(readFileSync(join(ROOT, 'capturas.json'), 'utf8'));
const jobs = new Map();

const sh = (cmd, args) => new Promise((res, rej) => execFile(cmd, args, {cwd: ROOT}, (e, out, err) => (e ? rej(new Error((err || e.message).trim())) : res(out.trim()))));
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

async function pedirGuion(peticion, log) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('Falta ANTHROPIC_API_KEY (ver README).');
  const cat = catalogo();
  const sistema = `Eres el guionista de vídeos de TikTok de Zyra, una app web para que capitanes de equipos de pádel organicen convocatorias, parejas, alineaciones y estadísticas. Escribes en español de España, directo y sin exagerar. Devuelve SOLO un objeto JSON (sin texto alrededor) con: hook (array de 2 textos EN MAYÚSCULAS, máx. ${LIMITES.hook} caracteres cada uno, que formen una pregunta o frase gancho), title (MAYÚSCULAS, máx. ${LIMITES.title}), src (una de las capturas), subs (array de 3 subtítulos, máx. ${LIMITES.sub} caracteres, que cuenten la función en orden), cta (máx. ${LIMITES.cta}, p. ej. «Pruébalo gratis»). No inventes funciones que no aparezcan en la descripción de la captura. Capturas disponibles:\n${cat.map((c) => `- ${c.src}: ${c.descripcion}`).join('\n')}`;
  let mensajes = [{role: 'user', content: peticion}];
  for (let intento = 1; intento <= 2; intento++) {
    log(`Pidiendo el guion a Claude (intento ${intento})…`);
    const r = await fetch((process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com') + '/v1/messages', {
      method: 'POST',
      headers: {'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json'},
      body: JSON.stringify({model: MODEL, max_tokens: 800, system: sistema, messages: mensajes}),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(`API de Claude: ${j.error?.message || r.status}`);
    const texto = j.content.map((b) => b.text || '').join('');
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
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('Falta GITHUB_TOKEN para seguir el CI y descargar el vídeo (ver README). El guion ya está subido: míralo en la pestaña Actions.');
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

async function trabajo(job, {peticion, modo, borrador}) {
  const log = (m) => job.log.push(m);
  try {
    const cat = catalogo();
    const g = borrador || (await pedirGuion(peticion, log));
    const errores = validar(g, cat);
    if (errores.length) throw new Error(`Guion no válido: ${errores.join('; ')}`);
    const c = cat.find((x) => x.src === g.src);
    const id = slug(job.id_hint || g.title) + '-' + Date.now().toString(36).slice(-4);
    const guion = {hook: g.hook, title: g.title, src: g.src, imgW: pngWidth(g.src), scroll: c.scroll, ...(c.box ? {box: c.box} : {}), subs: g.subs, cta: g.cta};
    job.guion = guion;
    writeFileSync(join(ROOT, 'guiones', `${id}.json`), JSON.stringify(guion, null, 2) + '\n');
    log(`Guion guardado en guiones/${id}.json`);
    if (modo === 'local') {
      log('Renderizando en local…');
      await sh('node', ['render.mjs', id]);
      job.resultado = `out/${id}.mp4`;
    } else {
      await sh('git', ['add', `guiones/${id}.json`]);
      await sh('git', ['commit', '-m', `Guion: ${g.title}`]);
      await sh('git', ['push']);
      log('Guion subido; el CI empieza a renderizar.');
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

export const server = createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/') { res.writeHead(200, {'content-type': 'text/html; charset=utf-8'}); return res.end(PAGINA); }
  if (req.method === 'GET' && req.url.startsWith('/api/job/')) { const j = jobs.get(req.url.split('/').pop()); return j ? json(res, 200, j) : json(res, 404, {error: 'no existe'}); }
  if (req.method === 'POST' && req.url === '/api/generar') {
    let body = '';
    for await (const c of req) body += c;
    const {peticion, modo = 'ci', borrador} = JSON.parse(body || '{}');
    if (!borrador && !String(peticion || '').trim()) return json(res, 400, {error: 'Escribe qué vídeo quieres.'});
    const id = Math.random().toString(36).slice(2, 10);
    const job = {estado: 'en curso', log: []};
    jobs.set(id, job);
    trabajo(job, {peticion, modo, borrador});
    return json(res, 200, {id});
  }
  json(res, 404, {error: 'no encontrado'});
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!existsSync(join(ROOT, '.git'))) console.warn('Aviso: esto no es un clon de git; el modo CI no funcionará.');
  server.listen(PORT, '127.0.0.1', () => console.log(`Zyra Videos: http://localhost:${PORT}`));
}
