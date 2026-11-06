import React from 'react';
import {Freeze, Img, OffthreadVideo, Sequence, staticFile} from 'remotion';
import {C} from '../styles/brand';

/** Marco de móvil con sombra y resplandor sutil. */
export const PhoneFrame: React.FC<{width: number; height: number; children: React.ReactNode}> = ({width, height, children}) => (
  <div
    style={{
      width: width + 28,
      height: height + 28,
      borderRadius: 64,
      background: '#050605',
      border: `2px solid ${C.border}`,
      padding: 14,
      boxShadow: '0 60px 120px rgba(0,0,0,.65), 0 0 0 1px rgba(180,241,0,.08), 0 0 140px rgba(180,241,0,.10)',
      position: 'relative',
    }}
  >
    <div style={{width, height, borderRadius: 50, overflow: 'hidden', position: 'relative', background: C.bg}}>{children}</div>
  </div>
);

/**
 * Captura real de la aplicación dentro de la pantalla. `scroll` va en píxeles de la imagen original;
 * los `children` se colocan en coordenadas de la imagen original (para anclar destacados).
 * `reveal` 0→1 descubre la pantalla con un barrido horizontal.
 */
export const esVideo = (src: string) => /\.(mp4|webm|mov)$/i.test(src);

/**
 * Grabación de pantalla dentro del móvil. `freeze` la deja en su 1.er fotograma (el gancho); si no, empieza en `from` y va a `rate`
 * (p. ej. 0.8 la alarga un 25 %, para que dure lo que la escena).
 */
const Clip: React.FC<{src: string; w: number; rate: number; freeze: boolean; from: number}> = ({src, w, rate, freeze, from}) => {
  const v = <OffthreadVideo src={staticFile(src)} muted playbackRate={rate} style={{width: w, display: 'block'}} />;
  return freeze ? <Freeze frame={0}>{v}</Freeze> : <Sequence from={from} layout="none">{v}</Sequence>;
};

export const Screen: React.FC<{src: string; imgW: number; width: number; scroll?: number; reveal?: number; video?: {rate: number; freeze: boolean; from: number}; children?: React.ReactNode}> = ({src, imgW, width, scroll = 0, reveal = 1, video, children}) => {
  const k = width / imgW;
  return (
    <div style={{position: 'absolute', inset: 0, clipPath: `inset(0 ${(1 - reveal) * 100}% 0 0)`}}>
      <div style={{position: 'absolute', left: 0, top: 0, width: imgW, transformOrigin: '0 0', transform: `scale(${k}) translateY(${-scroll}px)`}}>
        {esVideo(src) ? <Clip src={src} w={imgW} rate={video?.rate ?? 1} freeze={video?.freeze ?? false} from={video?.from ?? 0} /> : <Img src={staticFile(src)} style={{width: imgW, display: 'block'}} />}
        {children}
      </div>
      {reveal > 0 && reveal < 1 ? <div style={{position: 'absolute', top: 0, bottom: 0, left: `${reveal * 100}%`, width: 6, background: C.lime, boxShadow: `0 0 40px ${C.lime}`}} /> : null}
    </div>
  );
};

/**
 * Móvil con volumen real (CSS 3D): el frontal con la captura y un canto de varias capas detrás.
 * `yaw`/`pitch`/`roll` en grados; un reflejo recorre el cristal según `sheen` (0→1).
 */
export const Phone3D: React.FC<{width: number; height: number; yaw: number; pitch: number; roll?: number; scale?: number; sheen?: number; children: React.ReactNode}> = ({width, height, yaw, pitch, roll = 0, scale = 1, sheen = 0, children}) => {
  const W = width + 28;
  const H = height + 28;
  const layers = Array.from({length: 12}, (_, i) => i + 1);
  return (
    <div style={{perspective: 2200, perspectiveOrigin: '50% 45%', width: W, height: H}}>
      <div style={{position: 'relative', width: W, height: H, transformStyle: 'preserve-3d', transform: `rotateX(${pitch}deg) rotateY(${yaw}deg) rotateZ(${roll}deg) scale(${scale})`}}>
        {layers.map((i) => (
          <div key={i} style={{position: 'absolute', inset: 0, borderRadius: 64, background: i % 3 === 0 ? '#2a2d27' : '#171815', border: '2px solid #3a3d36', transform: `translateZ(${-i * 2.2}px)`}} />
        ))}
        <div style={{position: 'absolute', inset: 0, transform: 'translateZ(1px)'}}>
          <PhoneFrame width={width} height={height}>{children}</PhoneFrame>
          <div style={{position: 'absolute', inset: 14, borderRadius: 50, overflow: 'hidden', pointerEvents: 'none'}}>
            <div style={{position: 'absolute', top: -200, bottom: -200, width: 220, left: `${-30 + sheen * 150}%`, transform: 'skewX(-18deg)', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.10), transparent)'}} />
          </div>
        </div>
      </div>
    </div>
  );
};
