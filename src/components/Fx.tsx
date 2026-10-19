import React from 'react';
import {AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {Img, staticFile} from 'remotion';
import {C} from '../styles/brand';

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
    <AbsoluteFill style={{background: `radial-gradient(110% 60% at 50% 55%, ${C.forest} 0%, ${C.bg} 72%)`}}>
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
export const Wipe: React.FC<{at: number; dur?: number}> = ({at, dur = 26}) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [at - dur / 2, at + dur / 2], [0, 1], {easing: Easing.inOut(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  if (p <= 0 || p >= 1) return null;
  const x = interpolate(p, [0, 1], [-1700, 1500]);
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{position: 'absolute', top: -200, bottom: -200, left: 0, width: 1500, transform: `translateX(${x}px) skewX(-12deg)`, background: `linear-gradient(90deg, ${C.forestDeep}, ${C.forest} 85%, #1d4a22)`, borderRight: `10px solid ${C.lime}`, boxShadow: `30px 0 80px ${C.lime}44`}} />
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

/** Tarjeta a pantalla completa con una palabra clave enorme: entra y sale con un círculo que se abre y se cierra. `dur` en fotogramas. */
export const KeywordCard: React.FC<{at: number; word: string; variant: number; dur?: number}> = ({at, word, variant, dur = 28}) => {
  const f = useCurrentFrame() - at;
  if (f < 0 || f > dur) return null;
  const open = interpolate(f, [0, 8], [0, 1], {easing: Easing.out(Easing.cubic), extrapolateRight: 'clamp'});
  const close = interpolate(f, [dur - 8, dur], [1, 0], {easing: Easing.in(Easing.cubic), extrapolateLeft: 'clamp'});
  const r = Math.min(open, close) * 1500;
  const lime = variant % 2 === 0;
  const size = word.length <= 6 ? 190 : word.length <= 9 ? 140 : 100;
  const pop = interpolate(f, [4, 14], [0.7, 1], {easing: Easing.out(Easing.back(1.6)), extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{clipPath: `circle(${r}px at 50% 52%)`, background: lime ? `linear-gradient(160deg, ${C.limeHover}, ${C.lime} 55%, #7fae00)` : `linear-gradient(160deg, #1d4a22, ${C.forest} 55%, ${C.forestDeep})`, alignItems: 'center', justifyContent: 'center', zIndex: 6}}>
      <div style={{position: 'absolute', inset: 0, opacity: 0.22}}>
        <svg width="1080" height="1920" viewBox="-540 -960 1080 1920"><g transform={`rotate(${f * 0.6 - 8}) scale(1.35)`} fill="none" stroke={lime ? C.ink : C.lime} strokeWidth={6}><rect x={-300} y={-600} width={600} height={1200} /><line x1={-300} y1={0} x2={300} y2={0} /><line x1={-300} y1={-370} x2={300} y2={-370} /><line x1={-300} y1={370} x2={300} y2={370} /><line x1={0} y1={-370} x2={0} y2={370} /></g></svg>
      </div>
      <div style={{fontFamily: "'Syncopate', 'Archivo', sans-serif", fontWeight: 700, fontStyle: 'italic', fontSize: size, lineHeight: 1, color: lime ? C.ink : C.lime, textTransform: 'uppercase', textAlign: 'center', padding: '0 60px', transform: `scale(${pop}) rotate(${(variant % 2 ? 1 : -1) * 3}deg)`, textShadow: lime ? 'none' : `0 0 60px ${C.lime}66`}}>{word}</div>
    </AbsoluteFill>
  );
};
