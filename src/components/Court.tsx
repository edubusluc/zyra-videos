import React from 'react';
import {useCurrentFrame} from 'remotion';
import {C} from '../styles/brand';
import {prog} from './Reveal';

/**
 * Líneas de pista de pádel (10×20 m): perímetro, red, líneas de saque y línea central.
 * `draw` 0→1 dibuja los trazos; `rot`/`scale`/`tx`/`ty` permiten moverla como cámara.
 */
export const Court: React.FC<{start?: number; dur?: number; opacity?: number; scale?: number; tx?: number; ty?: number; rot?: number; stroke?: string}> = ({
  start = 0,
  dur = 40,
  opacity = 0.5,
  scale = 1,
  tx = 0,
  ty = 0,
  rot = 0,
  stroke = C.lime,
}) => {
  const f = useCurrentFrame();
  const d = prog(f, start, dur);
  const L = 4000;
  const common = {fill: 'none', stroke, strokeWidth: 5, strokeDasharray: L, strokeDashoffset: L * (1 - d)} as const;
  // Pista vertical: 600×1200 centrada en 0,0
  return (
    <svg width="1080" height="1920" viewBox="-540 -960 1080 1920" style={{position: 'absolute', inset: 0, opacity}}>
      <g transform={`translate(${tx} ${ty}) rotate(${rot}) scale(${scale})`}>
        <rect x={-300} y={-600} width={600} height={1200} {...common} />
        <line x1={-300} y1={0} x2={300} y2={0} {...common} strokeWidth={8} />
        <line x1={-300} y1={-370} x2={300} y2={-370} {...common} />
        <line x1={-300} y1={370} x2={300} y2={370} {...common} />
        <line x1={0} y1={-370} x2={0} y2={370} {...common} />
      </g>
    </svg>
  );
};
