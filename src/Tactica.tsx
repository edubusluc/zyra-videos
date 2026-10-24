import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';
import {Logo} from './components/Logo';
import {prog} from './components/Reveal';
import {useBrandFonts} from './components/fonts';
import {C, FONT, GLOW, HERO_FILL, PAGE_BG, SAFE, TYPE, limeA} from './styles/brand';

export const TACTICA_FPS = 30;

type P = [number, number];
export type TacticaData = {
  id: string;
  eyebrow: string;
  titulo: string;
  hook: [string, string];
  cta: string;
  fichas: {id: string; equipo: 'n' | 'r'; etq: string; pos: P; mov?: {t0: number; t1: number; a: P}[]}[];
  pelota: {pos: P; tramos: {t0: number; t1: number; a: P; altura?: number}[]; fin?: number};
  flechas: {de: P; a: P; t0: number; hasta: number; tipo: 'mov' | 'bola'; curva?: number}[];
  zonas?: {rect: [number, number, number, number]; etq: string; t0: number; t1: number}[];
  /** Rótulos sobre la pista (en metros), p. ej. «BOTE». */
  etiquetas?: {pos: P; texto: string; t0: number; t1: number; lado?: 'izq' | 'der'}[];
  /** Anillo que late alrededor de una ficha mientras se habla de ella. */
  resalta?: {id: string; t0: number; t1: number}[];
  /** Cámara: centro (en metros) y zoom por instante; se interpola. */
  foco?: {t: number; p: P; z: number}[];
  juntos?: {t0: number; t1: number; y: number; x: P};
  pasos: {t: number; texto: string; clave?: boolean}[];
  ctaDesde: number;
  seg: number;
  /** Con voz grabada: segundos reales de entrada de cada paso y del cierre, y fotogramas totales (los pone render.mjs a partir de la voz). */
  tiempos?: {pasos: number[]; cta: number; frames: number};
  /** Un audio por frase (gancho, cada paso y cierre) en public/. */
  audios?: string[];
};

// Pista de pádel 10×20 m en vertical: x de 0 a 10 (izquierda→derecha), y de 0 (fondo rival) a 20 (nuestro fondo); la red está en y = 10.
const M = 52;
const CX = 540;
const TOP = 360;
const px = ([x, y]: P): P => [CX + (x - 5) * M, TOP + y * M];
const SAQUE = 6.95; // línea de saque, a 6,95 m de la red
const ease = Easing.inOut(Easing.cubic);
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const pulso = (t: number, t0: number, t1: number, fade = 0.4) => interpolate(t, [t0, t0 + fade, t1 - fade, t1], [0, 1, 1, 0], clamp);

/** Posición de una ficha en el segundo t: reposo en pos y cada movimiento interpolado desde donde estaba. */
const posFicha = (f: TacticaData['fichas'][number], t: number): P => {
  let p = f.pos;
  for (const m of f.mov ?? []) {
    const k = interpolate(t, [m.t0, m.t1], [0, 1], {easing: ease, ...clamp});
    if (t <= m.t0) return p;
    if (t < m.t1) return [p[0] + (m.a[0] - p[0]) * k, p[1] + (m.a[1] - p[1]) * k];
    p = m.a;
  }
  return p;
};

/** Pelota: [x, y, altura 0–1]. La altura se dibuja como tamaño y sombra (vista cenital). */
const posPelota = (b: TacticaData['pelota'], t: number): [number, number, number] | null => {
  let p: P = b.pos;
  for (const s of b.tramos) {
    if (t < s.t0) return [p[0], p[1], 0];
    if (t <= s.t1) {
      const k = (t - s.t0) / (s.t1 - s.t0);
      const z = (s.altura ?? 0) * 4 * k * (1 - k);
      return [p[0] + (s.a[0] - p[0]) * k, p[1] + (s.a[1] - p[1]) * k, z];
    }
    p = s.a;
  }
  return b.fin !== undefined && t > b.fin ? null : [p[0], p[1], 0];
};

/** Cámara en el segundo t: [centro x, centro y, zoom]. */
const camara = (foco: TacticaData['foco'], t: number): [number, number, number] => {
  if (!foco?.length) return [5, 10, 1];
  const ts = foco.map((k) => k.t);
  const f = (v: number[]) => interpolate(t, ts, v, {easing: ease, ...clamp});
  return [f(foco.map((k) => k.p[0])), f(foco.map((k) => k.p[1])), f(foco.map((k) => k.z))];
};

const Flecha: React.FC<{a: TacticaData['flechas'][number]; t: number}> = ({a, t}) => {
  const [x0, y0] = px(a.de);
  const [x1, y1] = px(a.a);
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const c = (a.curva ?? 0) * M;
  const cx = (x0 + x1) / 2 + nx * c, cy = (y0 + y1) / 2 + ny * c;
  const k = interpolate(t, [a.t0, a.t0 + 0.7], [0, 1], {easing: Easing.out(Easing.cubic), ...clamp});
  const o = interpolate(t, [a.hasta, a.hasta + 0.6], [1, 0], clamp);
  if (t < a.t0 || o <= 0) return null;
  const d = `M ${x0} ${y0} Q ${cx} ${cy} ${x1} ${y1}`;
  const ang = Math.atan2(y1 - cy, x1 - cx);
  const col = a.tipo === 'bola' ? C.limeHover : C.text;
  return (
    <g opacity={o * 0.95}>
      <path d={d} fill="none" stroke="rgba(0,0,0,.45)" strokeWidth={a.tipo === 'bola' ? 12 : 10} strokeLinecap="round" pathLength={1} strokeDasharray={`${k} 1`} />
      <path d={d} fill="none" stroke={col} strokeWidth={a.tipo === 'bola' ? 7 : 6} strokeLinecap="round" pathLength={1} strokeDasharray={`${k} 1`} />
      {k > 0.9 ? <polygon points="0,0 -26,-14 -26,14" fill={col} transform={`translate(${x1} ${y1}) rotate(${(ang * 180) / Math.PI})`} opacity={interpolate(k, [0.9, 1], [0, 1])} /> : null}
    </g>
  );
};

const Ficha: React.FC<{equipo: 'n' | 'r'; etq: string; x: number; y: number; halo: number; t: number}> = ({equipo, etq, x, y, halo, t}) => {
  const n = equipo === 'n';
  const col = n ? C.lime : '#FF8A8F';
  return (
    <>
      {halo > 0 ? <div style={{position: 'absolute', left: x - 56, top: y - 56, width: 112, height: 112, borderRadius: '50%', border: `4px solid ${col}`, opacity: halo * (0.55 + 0.35 * Math.sin(t * 9)), transform: `scale(${0.95 + 0.1 * Math.sin(t * 9)})`, boxShadow: `0 0 30px ${n ? limeA(0.5) : 'rgba(255,92,99,.5)'}`}} /> : null}
      <div style={{position: 'absolute', left: x - 36, top: y - 36, width: 72, height: 72, borderRadius: '50%', background: n ? 'radial-gradient(circle at 35% 30%, #FFFFFF, #D9DBD3)' : 'radial-gradient(circle at 35% 30%, #FF8A8F, #E0434B)', border: `5px solid ${n ? C.lime : '#FFB3B6'}`, boxShadow: `0 12px 22px rgba(0,0,0,.6), inset 0 -6px 10px rgba(0,0,0,${n ? 0.12 : 0.25})${n ? `, 0 0 26px ${limeA(0.35)}` : ''}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT.body, fontWeight: 800, fontSize: 32, color: n ? C.ink : '#fff'}}>
        {etq}
      </div>
    </>
  );
};

const Texto: React.FC<{t: string; size: number}> = ({t, size}) => (
  <>
    {t.split(/(\*[^*]+\*)/).filter(Boolean).map((s, i) =>
      s.startsWith('*') ? (
        <span key={i} style={{background: C.lime, color: C.ink, padding: '0 14px', borderRadius: 14, margin: '0 2px', boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone', fontSize: size}}>{s.slice(1, -1)}</span>
      ) : (
        <span key={i}>{s}</span>
      ),
    )}
  </>
);

/** Plantilla «táctica»: pista cenital con cámara, fichas redondas para jugadores, ficha pequeña para la pelota (con estela), flechas, zonas y subtítulos por paso. */
export const Tactica: React.FC<TacticaData> = ({eyebrow, titulo, hook, cta, fichas, pelota, flechas, zonas = [], etiquetas = [], resalta = [], foco, juntos, pasos, ctaDesde, seg, tiempos}) => {
  useBrandFonts();
  const f = useCurrentFrame();
  // Con voz, la animación se estira o se comprime entre los instantes de cada frase: t es siempre el tiempo «de guion» (el de pasos[].t).
  const real = f / TACTICA_FPS;
  const t = tiempos && tiempos.pasos.length === pasos.length ? interpolate(real, [0, ...tiempos.pasos, tiempos.cta, tiempos.frames / TACTICA_FPS], [0, ...pasos.map((p) => p.t), ctaDesde, seg], clamp) : real;
  const hookT = pasos[0].t;
  const hookIn = prog(f, 0, 14);
  const hookOut = interpolate(t, [hookT - 0.4, hookT], [1, 0], clamp);
  const ctaIn = prog(t * TACTICA_FPS, ctaDesde * TACTICA_FPS, 24);
  const idx = Math.max(0, pasos.filter((p) => t >= p.t).length - 1);
  const paso = pasos[idx];
  const pasoIn = prog(t * TACTICA_FPS, paso.t * TACTICA_FPS, 12);
  const base = Math.min(52, Math.floor(920 / (titulo.length * 0.92)));
  const b = posPelota(pelota, t);
  const [lx0, ly0] = px([0, 0]);
  const W = 10 * M, H = 20 * M;
  const sy = (y: number) => TOP + y * M;
  const ln = {stroke: 'rgba(244,245,241,.78)', strokeWidth: 4};
  const [fx, fy, fz] = camara(foco, t);
  const [ox, oy] = px([fx, fy]);
  const TOPV = TOP - 40, HV = H + 80; // ventana de la cámara: la pista con un respiro; el zoom nunca invade título ni subtítulo
  // Estela de la pelota: posiciones de los últimos instantes, cada vez más pequeñas y tenues.
  const estela = b ? [1, 2, 3, 4, 5, 6, 7].map((i) => ({i, p: posPelota(pelota, t - i * 0.045)})).filter((e) => e.p && Math.hypot(e.p[0] - b[0], e.p[1] - b[1]) > 0.15) : [];
  const alto = (z: number) => z * 26;
  return (
    <AbsoluteFill style={{background: PAGE_BG}}>
      {/* Cámara: ventana recortada con la pista dentro, que se acerca a la acción de cada paso */}
      <div style={{position: 'absolute', left: 0, top: TOPV, width: 1080, height: HV, overflow: 'hidden', opacity: 1 - ctaIn * 0.75}}>
        <div style={{position: 'absolute', left: 0, top: -TOPV, width: 1080, height: 1920, transformOrigin: `${ox}px ${oy}px`, transform: `scale(${fz})`}}>
          <svg width="1080" height="1920" style={{position: 'absolute', inset: 0}}>
            <defs>
              <radialGradient id="suelo" cx="50%" cy="48%" r="75%"><stop offset="0%" stopColor="#38461A" /><stop offset="100%" stopColor="#12150B" /></radialGradient>
              <linearGradient id="cristal" x1="0" x2="1"><stop offset="0%" stopColor="rgba(180,241,0,.22)" /><stop offset="100%" stopColor="rgba(180,241,0,0)" /></linearGradient>
              <pattern id="cesped" width="52" height="104" patternUnits="userSpaceOnUse"><rect width="52" height="52" fill="rgba(255,255,255,.028)" /></pattern>
            </defs>
            {/* cristales y vallas: marco con brillo en las esquinas */}
            <rect x={lx0 - 22} y={ly0 - 22} width={W + 44} height={H + 44} rx={26} fill="rgba(255,255,255,.03)" stroke={limeA(0.4)} strokeWidth={3} />
            <rect x={lx0 - 10} y={ly0 - 10} width={W + 20} height={H + 20} rx={16} fill="none" stroke="rgba(255,255,255,.14)" strokeWidth={2} />
            <rect x={lx0 - 22} y={ly0 - 22} width={W + 44} height={90} rx={26} fill="url(#cristal)" opacity={0.0} />
            <rect x={lx0} y={ly0} width={W} height={H} rx={6} fill="url(#suelo)" />
            <rect x={lx0} y={ly0} width={W} height={H} fill="url(#cesped)" />
            <rect x={lx0} y={ly0} width={W} height={H} rx={6} fill="none" stroke="rgba(244,245,241,.92)" strokeWidth={5} />
            {zonas.map((z, i) => {
              const o = pulso(t, z.t0, z.t1, 0.5);
              const [zx0, zy0] = px([z.rect[0], z.rect[1]]);
              const zw = (z.rect[2] - z.rect[0]) * M, zh = (z.rect[3] - z.rect[1]) * M;
              return (
                <g key={i} opacity={o}>
                  <rect x={zx0} y={zy0} width={zw} height={zh} rx={22} fill={limeA(0.15)} stroke={limeA(0.8)} strokeWidth={3} strokeDasharray="14 10" />
                  {z.etq ? <text x={zx0 + zw / 2} y={zy0 + zh + 36} textAnchor="middle" fill={C.lime} fontFamily={FONT.body} fontWeight={800} fontSize={26} letterSpacing="4">{z.etq}</text> : null}
                </g>
              );
            })}
            <line x1={lx0} x2={lx0 + W} y1={sy(10 - SAQUE)} y2={sy(10 - SAQUE)} {...ln} />
            <line x1={lx0} x2={lx0 + W} y1={sy(10 + SAQUE)} y2={sy(10 + SAQUE)} {...ln} />
            <line x1={CX} x2={CX} y1={sy(10 - SAQUE)} y2={sy(10 + SAQUE)} {...ln} />
            {/* red: malla y postes */}
            <rect x={lx0 - 8} y={sy(10) - 6} width={W + 16} height={12} fill="rgba(0,0,0,.35)" />
            <line x1={lx0 - 10} x2={lx0 + W + 10} y1={sy(10)} y2={sy(10)} stroke="#fff" strokeWidth={9} strokeDasharray="22 12" />
            <circle cx={lx0 - 12} cy={sy(10)} r={9} fill="#fff" />
            <circle cx={lx0 + W + 12} cy={sy(10)} r={9} fill="#fff" />
            {flechas.map((a, i) => <Flecha key={i} a={a} t={t} />)}
            {juntos ? (() => {
              const o = pulso(t, juntos.t0, juntos.t1);
              const [ax, ay] = px([juntos.x[0], juntos.y]);
              const [bx] = px([juntos.x[1], juntos.y]);
              return <g opacity={o}><line x1={ax + 44} x2={bx - 44} y1={ay} y2={ay} stroke={C.lime} strokeWidth={6} strokeDasharray="4 14" strokeLinecap="round" /><text x={CX} y={ay - 18} textAnchor="middle" fill={C.lime} fontFamily={FONT.body} fontWeight={800} fontSize={26} letterSpacing="4">JUNTOS</text></g>;
            })() : null}
            {etiquetas.map((e, i) => {
              const [ex, ey] = px(e.pos);
              const o = pulso(t, e.t0, e.t1, 0.3);
              const w = e.texto.length * 15 + 34;
              const x = e.lado === 'der' ? ex + 48 : e.lado === 'izq' ? ex - 48 - w : ex - w / 2;
              const y = e.lado ? ey - 18 : ey + 28;
              return (
                <g key={i} opacity={o}>
                  <rect x={x} y={y} width={w} height={36} rx={18} fill="rgba(10,11,9,.85)" stroke={C.lime} strokeWidth={2} />
                  <text x={x + w / 2} y={y + 25} textAnchor="middle" fill={C.lime} fontFamily={FONT.body} fontWeight={800} fontSize={20} letterSpacing="3">{e.texto}</text>
                </g>
              );
            })}
          </svg>
          {/* Pelota: sombra y estela por debajo de las fichas */}
          {b ? (() => {
            const [bx, by] = px([b[0], b[1]]);
            return <div style={{position: 'absolute', left: bx - 13, top: by - 13 + 5 + alto(b[2]), width: 26, height: 26, borderRadius: '50%', background: 'rgba(0,0,0,.5)', filter: 'blur(4px)', opacity: 1 - b[2] * 0.5}} />;
          })() : null}
          {estela.map((e) => {
            const [ex, ey] = px([e.p![0], e.p![1]]);
            const r = 11 * (1 + e.p![2] * 1.6) * (1 - e.i * 0.09);
            return <div key={e.i} style={{position: 'absolute', left: ex - r, top: ey - r - alto(e.p![2]), width: r * 2, height: r * 2, borderRadius: '50%', background: C.lime, opacity: 0.38 * (1 - e.i / 8)}} />;
          })}
          {fichas.map((fi) => {
            const [x, y] = px(posFicha(fi, t));
            const halo = resalta.filter((r) => r.id === fi.id).reduce((m, r) => Math.max(m, pulso(t, r.t0, r.t1)), 0);
            return <Ficha key={fi.id} equipo={fi.equipo} etq={fi.etq} x={x} y={y} halo={halo} t={t} />;
          })}
          {b ? (() => {
            const [bx, by] = px([b[0], b[1]]);
            const r = 13 * (1 + b[2] * 1.6);
            return <div style={{position: 'absolute', left: bx - r, top: by - r - alto(b[2]), width: r * 2, height: r * 2, borderRadius: '50%', background: `radial-gradient(circle at 35% 30%, #F2FF8A, ${C.lime})`, border: '3px solid #fff', boxShadow: `0 0 22px ${limeA(0.85)}`}} />;
          })() : null}
        </div>
      </div>
      {/* Título (zona segura) */}
      <div style={{position: 'absolute', left: SAFE.side, right: SAFE.side, top: SAFE.top, textAlign: 'center', opacity: (1 - ctaIn) * (1 - hookOut * hookIn)}}>
        <div style={{...TYPE.eyebrow, fontSize: 26}}>{eyebrow}</div>
        <div style={{...TYPE.title, ...HERO_FILL, fontSize: base, lineHeight: 1.15, marginTop: 8, whiteSpace: 'nowrap'}}>{titulo}</div>
      </div>
      {/* Gancho: una sola frase en dos líneas, sobre la pista */}
      <div style={{position: 'absolute', left: SAFE.side, right: SAFE.side, top: 700, textAlign: 'center', opacity: hookOut * hookIn, transform: `scale(${0.92 + 0.08 * hookIn})`}}>
        <div style={{position: 'absolute', inset: '-40px -30px', background: 'rgba(10,11,9,.72)', borderRadius: 36, filter: 'blur(2px)'}} />
        <div style={{position: 'relative'}}>
          <div style={{...TYPE.title, ...HERO_FILL, fontSize: Math.min(70, Math.floor(920 / (hook[0].length * 0.95))), lineHeight: 1.15}}>{hook[0]}</div>
          <div style={{...TYPE.title, display: 'inline-block', marginTop: 16, padding: '6px 28px', borderRadius: 18, background: C.lime, color: C.ink, boxShadow: GLOW, fontSize: Math.min(70, Math.floor(920 / (hook[1].length * 0.95)))}}>{hook[1]}</div>
        </div>
      </div>
      {/* Subtítulo del paso, con el número de paso */}
      {t >= hookT && ctaIn < 0.5 ? (
        <div style={{position: 'absolute', left: SAFE.side, right: SAFE.side, top: TOP + H + 42, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, opacity: pasoIn, transform: `translateY(${(1 - pasoIn) * 24}px)`}}>
          <div style={{display: 'flex', gap: 10}}>
            {pasos.map((_, i) => <div key={i} style={{width: i === idx ? 44 : 14, height: 8, borderRadius: 4, background: i <= idx ? C.lime : C.borderStrong}} />)}
          </div>
          <div style={{background: 'rgba(20,21,18,.92)', border: `${paso.clave ? 3 : 1.5}px solid ${paso.clave ? C.lime : C.borderStrong}`, borderRadius: 28, padding: paso.clave ? '10px 30px 12px' : '16px 34px', textAlign: 'center', fontFamily: FONT.body, fontWeight: 800, fontSize: 44, lineHeight: 1.22, color: C.text, boxShadow: paso.clave ? `0 18px 40px -14px rgba(0,0,0,.8), ${GLOW}` : '0 18px 40px -14px rgba(0,0,0,.8)'}}>
            {paso.clave ? <div style={{...TYPE.eyebrow, fontSize: 20, marginBottom: 0}}>IDEA CLAVE</div> : null}
            <Texto t={paso.texto} size={44} />
          </div>
        </div>
      ) : null}
      {/* Cierre */}
      <AbsoluteFill style={{opacity: ctaIn, alignItems: 'center', justifyContent: 'center'}}>
        <div style={{textAlign: 'center', transform: `scale(${0.94 + 0.06 * ctaIn})`}}>
          <Logo height={190} />
          <div style={{...TYPE.eyebrow, fontSize: 28, marginTop: 40}}>Sube el nivel de tu equipo</div>
          <div style={{...TYPE.wordmark, ...HERO_FILL, fontSize: 84, lineHeight: 1.1, marginTop: 10}}>ZYRA</div>
          <div style={{fontFamily: FONT.body, fontWeight: 700, fontSize: 32, letterSpacing: '.08em', color: C.text, marginTop: 6}}>Gestión de equipos de pádel</div>
          <div style={{...TYPE.button, display: 'inline-block', marginTop: 48, padding: '24px 64px', borderRadius: 999, background: C.lime, color: C.ink, fontSize: 40, whiteSpace: 'nowrap', boxShadow: GLOW}}>{cta.replace(/\s*(en\s+)?zyrapadel\.com/i, '')}</div>
        </div>
      </AbsoluteFill>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: SAFE.bottom, textAlign: 'center', fontFamily: FONT.body, fontWeight: 700, letterSpacing: '.04em', fontSize: 34, color: C.text, opacity: 0.75, textShadow: '0 2px 12px rgba(0,0,0,.8)'}}>zyrapadel.com</div>
    </AbsoluteFill>
  );
};
