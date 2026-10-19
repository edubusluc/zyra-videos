import React from 'react';
import {Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, FONT} from '../styles/brand';

export const ease = Easing.bezier(0.16, 1, 0.3, 1);

/** Progreso 0→1 con ease-out fuerte entre dos fotogramas locales. */
export const prog = (frame: number, start: number, dur: number) =>
  interpolate(frame, [start, start + dur], [0, 1], {easing: ease, extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

type Props = {
  text: string;
  at: number; // fotograma local de entrada
  out?: number; // fotograma local de salida (opcional)
  size: number;
  color?: string;
  italic?: boolean;
  align?: 'left' | 'center';
  from?: 'up' | 'down' | 'left' | 'right';
  font?: 'display' | 'body';
  weight?: number;
  letterSpacing?: number;
};

/** Línea tipográfica con máscara: sube (o entra de lado) desde detrás de un recorte. */
export const Line: React.FC<Props> = ({text, at, out, size, color = C.text, italic, align = 'left', from = 'up', font = 'display', weight = 700, letterSpacing = 0}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const inP = spring({frame: f - at, fps, config: {damping: 200, mass: 0.7}, durationInFrames: 18});
  const outP = out === undefined ? 0 : prog(f, out, 12);
  const dist = 115;
  const sign = from === 'down' ? -1 : 1;
  const p = inP - outP; // 1 visible, 0 oculto
  const hidden = 1 - p;
  const ty = from === 'up' || from === 'down' ? sign * hidden * dist : 0;
  const tx = from === 'left' ? -hidden * 100 : from === 'right' ? hidden * 100 : 0;
  return (
    <div style={{overflow: 'hidden', paddingBottom: size * 0.12, paddingTop: size * 0.22, marginTop: -size * 0.17, textAlign: align}}>
      <div
        style={{
          fontFamily: font === 'display' ? FONT.display : FONT.body,
          fontWeight: weight,
          fontStyle: italic ? 'italic' : 'normal',
          fontSize: size,
          lineHeight: 1.05,
          letterSpacing,
          color,
          whiteSpace: 'nowrap',
          transform: `translate(${tx}%, ${ty}%)`,
        }}
      >
        {text}
      </div>
    </div>
  );
};
