import React from 'react';
import {C} from '../styles/brand';

/** Logotipo oficial de Zyra (static/zyra/logo.svg), con trazado inline para poder animarlo. */
export const LOGO_PATHS = [
  'M247.4 742 L475.5 685.5 L541.5 541.6 L90.4 616.1Z',
  'M0 251.1 L0 543.5 L40.1 575.7 L419.7 181.8Z',
  'M553 491 L553 197.7 L513.9 166.3 L134.3 560.2Z',
  'M306.6 0 L78.5 56.5 L12.5 200.4 L463.6 125.9Z',
];

export const Logo: React.FC<{height: number; fill?: string; progress?: number[]}> = ({height, fill = C.lime, progress = [1, 1, 1, 1]}) => (
  <svg height={height} viewBox="0 0 553 742" style={{overflow: 'visible'}}>
    {LOGO_PATHS.map((d, i) => (
      <path
        key={i}
        d={d}
        fill={fill}
        style={{
          opacity: progress[i],
          transform: `translate(${(1 - progress[i]) * (i % 2 === 0 ? 60 : -60)}px, ${(1 - progress[i]) * (i < 2 ? 40 : -40)}px)`,
        }}
      />
    ))}
  </svg>
);
