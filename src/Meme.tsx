import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Logo} from './components/Logo';
import {useBrandFonts} from './components/fonts';
import {C, FONT} from './styles/brand';

export type MemeData = {id: string; beforeLabel: string; before: string; afterLabel: string; after: string};
export const MEME_W = 1080;
export const MEME_H = 1350;

const Panel: React.FC<{label: string; text: string; bg: string; accent: string; ink: string}> = ({label, text, bg, accent, ink}) => (
  <div style={{flex: 1, background: bg, padding: '64px 72px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 28}}>
    <div style={{fontFamily: FONT.display, fontWeight: 700, fontSize: 40, letterSpacing: 6, color: accent}}>{label}</div>
    <div style={{fontFamily: FONT.body, fontWeight: 800, fontSize: 70, lineHeight: 1.1, color: ink}}>{text}</div>
  </div>
);

/** Meme «antes / después» con la marca de Zyra: imagen fija 1080×1350 (publicación o carrusel). */
export const Meme: React.FC<MemeData> = ({beforeLabel, before, afterLabel, after}) => {
  useBrandFonts();
  return (
    <AbsoluteFill style={{background: C.bg, display: 'flex', flexDirection: 'column'}}>
      <Panel label={beforeLabel} text={before} bg="#2A1313" accent="#FF7B7B" ink={C.text} />
      <div style={{height: 10, background: C.lime}} />
      <Panel label={afterLabel} text={after} bg={C.forest} accent={C.lime} ink={C.text} />
      <div style={{height: 110, background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 22}}>
        <Logo height={52} />
        <div style={{fontFamily: FONT.body, fontWeight: 700, fontSize: 36, color: C.text}}>zyrapadel.com</div>
      </div>
    </AbsoluteFill>
  );
};
