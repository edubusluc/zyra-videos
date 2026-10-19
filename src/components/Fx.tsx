import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
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

/** Barrido diagonal de color que tapa la pantalla (para cambiar de escena). `at` = fotograma en que cruza el centro. */
export const Wipe: React.FC<{at: number; dur?: number; color?: string}> = ({at, dur = 16, color = C.lime}) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [at - dur / 2, at + dur / 2], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  if (p <= 0 || p >= 1) return null;
  const x = interpolate(p, [0, 1], [-1500, 1500]);
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{position: 'absolute', top: -200, bottom: -200, left: 0, width: 1500, transform: `translateX(${x}px) skewX(-14deg)`, background: color}} />
      <div style={{position: 'absolute', top: -200, bottom: -200, left: 0, width: 160, transform: `translateX(${x - 260}px) skewX(-14deg)`, background: `${color}66`}} />
    </AbsoluteFill>
  );
};

/** Destello breve de pantalla completa. */
export const Flash: React.FC<{at: number}> = ({at}) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [at, at + 2, at + 9], [0, 0.5, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return o > 0 ? <AbsoluteFill style={{background: '#fff', opacity: o, pointerEvents: 'none'}} /> : null;
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
