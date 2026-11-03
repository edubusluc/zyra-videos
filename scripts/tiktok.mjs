// Ganchos del experimento y texto de publicación de TikTok (descripción, hashtags y comentario fijado).
// Lo usan app/server.mjs (para pedir y validar el guion) y render.mjs (para dejar out/<id>.tiktok.txt).

/** Tipos de gancho para la línea 2 (la 1.ª la escribe el guionista a su manera). Se prueba uno por vídeo y se compara en TikTok Analytics. */
export const GANCHOS = {
  pregunta: 'una PREGUNTA directa al capitán (con ¿?) que el vídeo responde, p. ej. «¿QUIÉN JUEGA / CON QUIÉN?» o «¿QUIÉN HA / CONFIRMADO?»',
  resultado: 'el RESULTADO que ya se ve en la captura, dicho en concreto y sin cifras inventadas, p. ej. «TU EQUIPO / YA CONVOCADO» o «LAS MEJORES / PAREJAS, A LA VISTA»',
  problema: 'un PROBLEMA o situación reconocible de capitán, al estilo de los POV que mejor han funcionado, p. ej. «NADIE CONTESTA / EN EL GRUPO» o «CERRAR LA / CONVOCATORIA»',
};
export const TIPOS_GANCHO = ['auto', ...Object.keys(GANCHOS)];

export const LIMITES_TIKTOK = {descripcion: 150, comentario: 150, busqueda: 60};
const PROHIBIDOS = /^#(fyp|foryou|foryoupage|parati|paratii|viral|trending)$/i;
const plano = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

/** Valida el bloque de publicación; devuelve la lista de problemas (vacía si está bien). */
export function validarTiktok(t) {
  const e = [];
  if (!t || typeof t !== 'object') return ['tiktok: obligatorio (busqueda, descripcion, hashtags y comentario)'];
  const txt = (v, max, n) => (typeof v === 'string' && v.trim() && v.length <= max ? null : `tiktok.${n}: obligatorio y de máx. ${max} caracteres`);
  [txt(t.busqueda, LIMITES_TIKTOK.busqueda, 'busqueda'), txt(t.descripcion, LIMITES_TIKTOK.descripcion, 'descripcion'), txt(t.comentario, LIMITES_TIKTOK.comentario, 'comentario')].forEach((m) => m && e.push(m));
  if (typeof t.busqueda === 'string' && typeof t.descripcion === 'string' && !plano(t.descripcion).startsWith(plano(t.busqueda))) e.push('tiktok.descripcion: debe empezar por la frase de búsqueda');
  if (typeof t.descripcion === 'string' && /#/.test(t.descripcion)) e.push('tiktok.descripcion: sin hashtags dentro (van en tiktok.hashtags)');
  if (!Array.isArray(t.hashtags) || t.hashtags.length !== 2) e.push('tiktok.hashtags: exactamente 2');
  else t.hashtags.forEach((h, i) => { if (!/^#[\p{L}\p{N}_]{3,30}$/u.test(h) || PROHIBIDOS.test(h)) e.push(`tiktok.hashtags[${i}]: hashtag específico, sin #fyp ni #viral`); });
  if (typeof t.comentario === 'string' && !/zyrapadel\.com/i.test(t.comentario)) e.push('tiktok.comentario: debe incluir zyrapadel.com');
  return e;
}

/** Texto listo para copiar al subir el vídeo a TikTok. */
export const textoTiktok = (id, t, gancho) => `PUBLICACIÓN DE TIKTOK · ${id}${gancho ? `\nTipo de gancho (para comparar en Analytics): ${gancho}` : ''}

DESCRIPCIÓN (pégala al subir el vídeo):
${t.descripcion.trim()} ${t.hashtags.join(' ')}

COMENTARIO (publícalo tú justo después y fíjalo):
${t.comentario.trim()}
`;
