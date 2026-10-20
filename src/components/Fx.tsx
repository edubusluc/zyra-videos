import React from 'react';
import {AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {Img, OffthreadVideo, staticFile} from 'remotion';
import {C, FONT, limeA, PAGE_BG} from '../styles/brand';

/** Fondo vivo: degradado, rejilla de pista en movimiento, luces que flotan y partículas que suben. */
export const LiveBg: React.FC = () => {
  const f = useCurrentFrame();
  const dots = Array.from({length: 16}, (_, i) => {
    const seed = (i * 97) % 100;
    const x = (seed * 10.8 + i * 61) % 1080;
    const y = 1920 - ((f * (1.2 + (i % 5) * 0.5) + i * 170) % 2100);
    return <div key={i} style={{position: 'absolute', left: x, top: y, width: 6 + (i % 3) * 4, height: 6 + (i % 3) * 4, borderRadius: '50%', background: C.lime, opacity: 0.12 + (i % 4) * 0.06, filter: 'blur(1px)'}} />;
  });
  return (
    <AbsoluteFill style={{background: PAGE_BG}}>
      <AbsoluteFill
        style={{
          opacity: 0.35,
          backgroundImage: `linear-gradient(${C.border} 2px, transparent 2px), linear-gradient(90deg, ${C.border} 2px, transparent 2px)`,
          backgroundSize: '120px 120px',
          backgroundPosition: `${f * 0.8}px ${f * 1.6}px`,
          transform: 'perspective(900px) rotateX(58deg) scale(2.2) translateY(-10%)',
          transformOrigin: '50% 100%',
          maskImage: 'linear-gradient(to top, #000 0%, transparent 70%)',
          WebkitMaskImage: 'linear-gradient(to top, #000 0%, transparent 70%)',
        }}
      />
      <div style={{position: 'absolute', left: 540 + Math.sin(f / 40) * 260 - 350, top: 380 + Math.cos(f / 55) * 160, width: 700, height: 700, borderRadius: '50%', background: `radial-gradient(${C.lime}33, transparent 65%)`}} />
      <div style={{position: 'absolute', left: 540 + Math.cos(f / 47) * 300 - 300, top: 1250 + Math.sin(f / 35) * 180, width: 600, height: 600, borderRadius: '50%', background: `radial-gradient(${C.lime}22, transparent 65%)`}} />
      {dots}
    </AbsoluteFill>
  );
};

/** Cortinilla elegante: panel oscuro que cruza la pantalla con un filo de color. `at` = fotograma en que cubre el centro. */
export const Wipe: React.FC<{at: number; dur?: number; dir?: 1 | -1}> = ({at, dur = 26, dir = 1}) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [at - dur / 2, at + dur / 2], [0, 1], {easing: Easing.inOut(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  if (p <= 0 || p >= 1) return null;
  const x = interpolate(p, [0, 1], [-1700, 1500]);
  // dir = -1: cruza de derecha a izquierda (el mismo panel, reflejado)
  return (
    <AbsoluteFill style={{pointerEvents: 'none', transform: dir === -1 ? 'scaleX(-1)' : undefined}}>
      <div style={{position: 'absolute', top: -200, bottom: -200, left: 0, width: 1500, transform: `translateX(${x}px) skewX(-12deg)`, background: `linear-gradient(90deg, ${C.bg}, ${C.surface2} 80%, ${C.surface3})`, borderRight: `12px solid ${C.lime}`, boxShadow: `24px 0 60px -10px ${limeA(0.45)}`}} />
      <div style={{position: 'absolute', top: -200, bottom: -200, left: 0, width: 40, transform: `translateX(${x + 1500 + 34}px) skewX(-12deg)`, background: limeA(0.35)}} />
    </AbsoluteFill>
  );
};

/** Pulso de escala (1.0x→`amp` y vuelta) con muelle al inicio de cada beat. */
export const usePunch = (at: number, amp = 0.05) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({frame: f - at, fps, config: {damping: 9, stiffness: 160, mass: 0.6}, durationInFrames: 22});
  return f < at ? 1 : 1 + amp * (1 - s);
};

/** Anillos que se expanden desde un punto (ping). */
export const Ping: React.FC<{x: number; y: number; at: number; color?: string}> = ({x, y, at, color = C.lime}) => {
  const f = useCurrentFrame();
  return (
    <>
      {[0, 8, 16].map((d) => {
        const p = interpolate(f, [at + d, at + d + 28], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
        if (p <= 0 || p >= 1) return null;
        return <div key={d} style={{position: 'absolute', left: x - 120 * p - 20, top: y - 120 * p - 20, width: 240 * p + 40, height: 240 * p + 40, borderRadius: '50%', border: `4px solid ${color}`, opacity: 1 - p}} />;
      })}
    </>
  );
};

/** Fondo del estilo «creador»: la propia captura ampliada, desenfocada y oscurecida, con viñeta y un respiro lento. */
export const BlurBg: React.FC<{src: string}> = ({src}) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{background: C.bg, overflow: 'hidden'}}>
      <Img src={staticFile(src)} style={{position: 'absolute', left: -300, top: -200 - f * 0.4, width: 1680, filter: 'blur(46px) brightness(.42) saturate(1.3)', transform: `scale(${1.05 + f / 2400})`}} />
      <AbsoluteFill style={{background: `radial-gradient(90% 70% at 50% 50%, transparent 30%, ${C.bg} 100%)`}} />
    </AbsoluteFill>
  );
};

/** Ajusta el cuerpo de una palabra en Syncopate (muy ancha) para que quepa en `ancho` px. */
export const cabe = (word: string, max: number, ancho = 900) => Math.min(max, Math.floor(ancho / Math.max(1, word.length * 0.98)));

/** Tarjeta a pantalla completa con una palabra clave enorme: entra y sale con un círculo que se abre y se cierra. `dur` en fotogramas. */
export const KeywordCard: React.FC<{at: number; word: string; variant: number; dur?: number}> = ({at, word, variant, dur = 28}) => {
  const f = useCurrentFrame() - at;
  if (f < 0 || f > dur) return null;
  const open = interpolate(f, [0, 8], [0, 1], {easing: Easing.out(Easing.cubic), extrapolateRight: 'clamp'});
  const close = interpolate(f, [dur - 8, dur], [1, 0], {easing: Easing.in(Easing.cubic), extrapolateLeft: 'clamp'});
  const r = Math.min(open, close) * 1500;
  const lime = variant % 2 === 0;
  const size = cabe(word, 190);
  const pop = interpolate(f, [4, 14], [0.7, 1], {easing: Easing.out(Easing.back(1.6)), extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  // Lima: el botón principal de la web (hover → lima → pulsado). Oscura: el fondo de página de la web con su halo lima.
  const fondo = lime
    ? `radial-gradient(70% 45% at 50% 50%, ${C.limeHover} 0%, ${C.lime} 60%, ${C.limePress} 100%)`
    : `radial-gradient(60% 40% at 50% 50%, ${limeA(0.16)} 0%, ${limeA(0)} 100%), radial-gradient(120% 70% at 50% 0%, ${C.bgTop} 0%, ${C.bg} 75%)`;
  return (
    <AbsoluteFill style={{clipPath: `circle(${r}px at 50% 52%)`, background: fondo, alignItems: 'center', justifyContent: 'center', zIndex: 6}}>
      <div style={{position: 'absolute', inset: 0, opacity: lime ? 0.16 : 0.22}}>
        <svg width="1080" height="1920" viewBox="-540 -960 1080 1920"><g transform={`rotate(${f * 0.6 - 8}) scale(1.35)`} fill="none" stroke={lime ? C.ink : C.lime} strokeWidth={6}><rect x={-300} y={-600} width={600} height={1200} /><line x1={-300} y1={0} x2={300} y2={0} /><line x1={-300} y1={-370} x2={300} y2={-370} /><line x1={-300} y1={370} x2={300} y2={370} /><line x1={0} y1={-370} x2={0} y2={370} /></g></svg>
      </div>
      <div style={{fontFamily: FONT.display, fontWeight: 700, fontStyle: 'italic', fontSize: size, lineHeight: 1, letterSpacing: '.02em', color: lime ? C.ink : C.lime, textTransform: 'uppercase', textAlign: 'center', whiteSpace: 'nowrap', transform: `scale(${pop}) rotate(${(variant % 2 ? 1 : -1) * 3}deg)`, textShadow: lime ? 'none' : `0 10px 40px ${limeA(0.35)}`}}>{word}</div>
    </AbsoluteFill>
  );
};

/** Fondo propio (public/fondos/: vídeo o imagen de pista, material propio o con licencia), oscurecido para que el móvil y el texto manden. */
export const MediaBg: React.FC<{src: string}> = ({src}) => {
  const f = useCurrentFrame();
  const estilo: React.CSSProperties = {position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(10px) brightness(.38) saturate(1.15)', transform: `scale(${1.08 + f / 3000})`};
  return (
    <AbsoluteFill style={{background: C.bg, overflow: 'hidden'}}>
      {/\.(mp4|webm|mov)$/i.test(src) ? <OffthreadVideo src={staticFile(src)} muted style={estilo} /> : <Img src={staticFile(src)} style={estilo} />}
      <AbsoluteFill style={{background: `radial-gradient(90% 70% at 50% 50%, transparent 25%, ${C.bg} 100%)`}} />
    </AbsoluteFill>
  );
};

/**
 * Motivo de marca sobre el fondo (sin recursos externos): da a cada vídeo un ambiente distinto sin salir de la paleta.
 * 0 = nada, 1 = líneas de pista que derivan, 2 = partículas lima que suben, 3 = haces de luz diagonales.
 */
export const Motivo: React.FC<{tipo: number}> = ({tipo}) => {
  const f = useCurrentFrame();
  if (tipo === 1) {
    return (
      <AbsoluteFill style={{opacity: 0.14, pointerEvents: 'none'}}>
        <svg width="1080" height="1920" viewBox="-540 -960 1080 1920"><g transform={`rotate(${-14 + Math.sin(f / 90) * 3}) translate(0 ${(f * 0.6) % 120}) scale(1.5)`} fill="none" stroke={C.lime} strokeWidth={4}><rect x={-300} y={-600} width={600} height={1200} /><line x1={-300} y1={0} x2={300} y2={0} /><line x1={-300} y1={-370} x2={300} y2={-370} /><line x1={-300} y1={370} x2={300} y2={370} /><line x1={0} y1={-370} x2={0} y2={370} /></g></svg>
      </AbsoluteFill>
    );
  }
  if (tipo === 2) {
    return (
      <AbsoluteFill style={{pointerEvents: 'none'}}>
        {Array.from({length: 18}, (_, i) => {
          const x = ((i * 97) % 100) * 10.8;
          const y = 1920 - ((f * (1 + (i % 4) * 0.45) + i * 160) % 2100);
          const s = 5 + (i % 3) * 4;
          return <div key={i} style={{position: 'absolute', left: x, top: y, width: s, height: s, borderRadius: '50%', background: C.lime, opacity: 0.1 + (i % 4) * 0.05, filter: 'blur(1px)'}} />;
        })}
      </AbsoluteFill>
    );
  }
  if (tipo === 3) {
    return (
      <AbsoluteFill style={{pointerEvents: 'none', overflow: 'hidden'}}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{position: 'absolute', top: -400, height: 2800, width: 140 + i * 60, left: ((f * (2 + i) + i * 420) % 1700) - 400, transform: 'rotate(24deg)', background: `linear-gradient(90deg, transparent, ${limeA(0.07 - i * 0.015)}, transparent)`}} />
        ))}
      </AbsoluteFill>
    );
  }
  return null;
};
