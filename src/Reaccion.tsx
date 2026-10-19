import React from 'react';
import {AbsoluteFill, Img, OffthreadVideo, staticFile} from 'remotion';
import {Court} from './components/Court';
import {useBrandFonts} from './components/fonts';
import {C, FONT} from './styles/brand';

export type ReaccionData = {id: string; caption: string; emojis?: string; fondo?: string | null; recorte?: string | null; seg?: number; sonido?: boolean; pos?: 'arriba' | 'abajo'};
export const REACCION_FPS = 30;

const esVideo = (s: string) => /\.(mp4|mov|webm)$/i.test(s);

/**
 * Meme de reacción: fondo (foto o vídeo propio / libre de derechos, o la pista de Zyra si no hay), un recorte opcional
 * (vídeo con transparencia en .webm, o un vídeo normal) y texto con borde al estilo TikTok. Archivos en public/medios/.
 */
export const Reaccion: React.FC<ReaccionData> = ({caption, emojis, fondo, recorte, sonido = true, pos = 'arriba'}) => {
  useBrandFonts();
  return (
    <AbsoluteFill style={{background: `radial-gradient(120% 70% at 50% 0%, ${C.forest} 0%, ${C.bg} 70%)`}}>
      {fondo ? (
        esVideo(fondo) ? (
          <OffthreadVideo src={staticFile(fondo)} muted style={{width: '100%', height: '100%', objectFit: 'cover'}} />
        ) : (
          <Img src={staticFile(fondo)} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
        )
      ) : (
        <Court start={-10} dur={20} scale={1.5} opacity={0.55} />
      )}
      {recorte ? (
        esVideo(recorte) ? (
          <OffthreadVideo
            src={staticFile(recorte)}
            transparent={/\.webm$/i.test(recorte)}
            volume={sonido ? 1 : 0}
            style={{position: 'absolute', left: 0, bottom: 150, width: '100%', height: 1100, objectFit: 'contain', objectPosition: '50% 100%'}}
          />
        ) : (
          <Img src={staticFile(recorte)} style={{position: 'absolute', left: 0, bottom: 150, width: '100%', height: 1100, objectFit: 'contain', objectPosition: '50% 100%'}} />
        )
      ) : null}
      <div style={{position: 'absolute', left: 64, right: 64, textAlign: 'center', ...(pos === 'abajo' ? {bottom: 300} : {top: 330})}}>
        <div
          style={{
            fontFamily: FONT.body,
            fontWeight: 800,
            fontSize: 78,
            lineHeight: 1.12,
            color: '#fff',
            WebkitTextStroke: '10px #000',
            paintOrder: 'stroke fill',
            textShadow: '0 6px 24px rgba(0,0,0,.45)',
          }}
        >
          {caption}
        </div>
        {emojis ? <div style={{fontSize: 84, marginTop: 18}}>{emojis}</div> : null}
      </div>
      <div style={{position: 'absolute', bottom: 120, left: 0, right: 0, textAlign: 'center', fontFamily: FONT.body, fontWeight: 800, fontSize: 38, color: C.lime, opacity: 0.9, textShadow: '0 2px 12px #000'}}>zyrapadel.com</div>
    </AbsoluteFill>
  );
};
