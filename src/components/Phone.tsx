import React from 'react';
import {Img, staticFile} from 'remotion';
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
export const Screen: React.FC<{src: string; imgW: number; width: number; scroll?: number; reveal?: number; children?: React.ReactNode}> = ({src, imgW, width, scroll = 0, reveal = 1, children}) => {
  const k = width / imgW;
  return (
    <div style={{position: 'absolute', inset: 0, clipPath: `inset(0 ${(1 - reveal) * 100}% 0 0)`}}>
      <div style={{position: 'absolute', left: 0, top: 0, width: imgW, transformOrigin: '0 0', transform: `scale(${k}) translateY(${-scroll}px)`}}>
        <Img src={staticFile(src)} style={{width: imgW, display: 'block'}} />
        {children}
      </div>
      {reveal > 0 && reveal < 1 ? <div style={{position: 'absolute', top: 0, bottom: 0, left: `${reveal * 100}%`, width: 6, background: C.lime, boxShadow: `0 0 40px ${C.lime}`}} /> : null}
    </div>
  );
};
