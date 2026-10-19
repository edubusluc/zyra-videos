import React from 'react';
import {AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {LiveBg, Ping, Wipe} from './components/Fx';
import {Logo} from './components/Logo';
import {Phone3D, Screen} from './components/Phone';
import {Line, prog} from './components/Reveal';
import {useBrandFonts} from './components/fonts';
import type {VideoData} from './data';
import {C, FONT, SAFE} from './styles/brand';

export const FPS = 30;
export const DURATION = 450; // 15 s
const HOOK_END = 70;
const CTA_FROM = 360;
const PH_W = 680;
const PH_H = 900;

/** Plantilla «función en 15 s»: gancho → móvil con captura real y subtítulos → cierre con logo y URL. */
export const Feature: React.FC<VideoData> = ({hook, title, src, imgW, scroll, box, subs, cta, subtitulos = true}) => {
  useBrandFonts();
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const hookOut = prog(f, HOOK_END, 14);
  const main = prog(f, HOOK_END - 6, 30);
  const ctaIn = prog(f, CTA_FROM, 18);
  const sc = interpolate(f, [HOOK_END, CTA_FROM], scroll, {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const pulse = 0.55 + 0.45 * Math.sin(f / 5);
  const subStart = [86, 166, 246];
  const subIdx = f < subStart[1] ? 0 : f < subStart[2] ? 1 : 2;
  const subAt = subStart[subIdx];
  // Cámara 3D suave: entra girando y, en cada beat, el móvil pasa a otro ángulo (interpolación continua, sin golpes).
  const camT = [HOOK_END, subStart[0], subStart[1], subStart[2], CTA_FROM];
  const yaw = interpolate(f, camT, [-58, -16, 14, -10, 8], {easing: Easing.inOut(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const pitch = interpolate(f, camT, [20, 8, 3, 9, 4], {easing: Easing.inOut(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) + Math.sin(f / 34) * 1.5;
  const drift = interpolate(f, [HOOK_END, CTA_FROM], [0.96, 1.08], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const float = Math.sin(f / 26) * 12;
  const hookPop = spring({frame: f, fps, config: {damping: 11, stiffness: 140, mass: 0.7}, durationInFrames: 24});
  const words = subs[subIdx].split(' ');
  const ctaTxt = cta.replace(/(https?:\/\/)?(www\.)?zyrapadel\.com\/?/gi, '').replace(/(\s+(en|y|a|en la web|en nuestra web))?[\s·:–-]*$/i, '').trim() || 'Pruébalo gratis';
  const logoPop = spring({frame: f - CTA_FROM - 4, fps, config: {damping: 8, stiffness: 120, mass: 0.8}, durationInFrames: 30});
  return (
    <AbsoluteFill>
      <LiveBg />
      {/* Barra de progreso */}
      <div style={{position: 'absolute', left: 0, top: 0, height: 8, width: `${(f / DURATION) * 100}%`, background: C.lime, boxShadow: `0 0 20px ${C.lime}`, zIndex: 5}} />
      {/* Gancho */}
      <div style={{position: 'absolute', left: SAFE.side, right: SAFE.side, top: 700, opacity: 1 - hookOut, transform: `scale(${0.85 + 0.15 * hookPop})`, transformOrigin: '0 50%'}}>
        <Line text={hook[0]} at={2} out={HOOK_END} size={64} from="left" />
        <div style={{height: 10, width: `${prog(f, 20, 22) * 100}%`, background: C.lime, margin: '14px 0 22px', boxShadow: `0 0 30px ${C.lime}`}} />
        <Line text={hook[1]} at={26} out={HOOK_END} size={64} color={C.lime} italic from="right" />
      </div>
      {/* Cuerpo */}
      <div style={{position: 'absolute', inset: 0, opacity: f < CTA_FROM ? main : 1 - ctaIn}}>
        <div style={{position: 'absolute', left: SAFE.side, right: SAFE.side, top: SAFE.top}}>
          <Line text={title} at={HOOK_END + 4} size={44} />
          <div style={{height: 8, width: `${prog(f, HOOK_END + 12, 20) * 38}%`, background: C.lime, marginTop: 14, boxShadow: `0 0 24px ${C.lime}`}} />
        </div>
        <div style={{position: 'absolute', left: (1080 - PH_W - 28) / 2, top: 400 + (1 - main) * 120 + float}}>
          <div style={{position: 'absolute', left: 60, right: 60, bottom: -70, height: 70, borderRadius: '50%', background: 'radial-gradient(rgba(0,0,0,.55), transparent 70%)', filter: 'blur(14px)'}} />
          <Phone3D width={PH_W} height={PH_H} yaw={yaw} pitch={pitch} roll={(1 - main) * 3} scale={drift} sheen={prog(f, HOOK_END + 10, 150)}>
            <Screen src={src} imgW={imgW} width={PH_W} scroll={sc} reveal={prog(f, HOOK_END + 4, 24)}>
              {box ? (
                <div style={{position: 'absolute', left: box[0], top: box[1], width: box[2], height: box[3], border: `5px solid ${C.lime}`, borderRadius: 18, boxShadow: `0 0 ${40 * pulse}px ${C.lime}`, opacity: prog(f, HOOK_END + 30, 12)}} />
              ) : null}
            </Screen>
          </Phone3D>
        </div>
        {subtitulos ? (
          <div style={{position: 'absolute', left: SAFE.side, right: SAFE.side, top: 1370, height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <div key={subIdx} style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0 14px', padding: '14px 30px', borderRadius: 28, background: 'rgba(10,11,9,.72)', border: `2px solid ${C.border}`, borderLeft: `8px solid ${C.lime}`, boxShadow: '0 20px 50px rgba(0,0,0,.5)', opacity: prog(f, subAt, 6), transform: `scale(${0.9 + 0.1 * prog(f, subAt, 10)})`}}>
              {words.map((w, i) => (
                <span key={i} style={{fontFamily: FONT.body, fontWeight: 800, fontSize: 46, lineHeight: 1.15, color: i === words.length - 1 ? C.lime : C.text, opacity: prog(f, subAt + i * 3, 8), transform: `translateY(${(1 - prog(f, subAt + i * 3, 10)) * 26}px)`, display: 'inline-block'}}>
                  {w}
                </span>
              ))}
            </div>
          </div>
        ) : null}
        {/* Puntos de avance */}
        <div style={{position: 'absolute', left: 0, right: 0, top: 1545, display: 'flex', justifyContent: 'center', gap: 16}}>
          {subStart.map((_, i) => (
            <div key={i} style={{width: i === subIdx ? 56 : 16, height: 16, borderRadius: 8, background: i === subIdx ? C.lime : C.border, boxShadow: i === subIdx ? `0 0 18px ${C.lime}` : 'none'}} />
          ))}
        </div>
      </div>
      {/* Transiciones entre escenas y beats */}
      <Wipe at={HOOK_END + 2} />
      <Wipe at={CTA_FROM + 4} />
      {/* Cierre */}
      <AbsoluteFill style={{opacity: ctaIn, alignItems: 'center', justifyContent: 'center'}}>
        <div style={{textAlign: 'center'}}>
          <div style={{position: 'relative', display: 'inline-block', transform: `scale(${logoPop})`}}>
            <div style={{position: 'absolute', inset: -90, borderRadius: '50%', background: `radial-gradient(${C.lime}44, transparent 65%)`}} />
            <Logo height={220} />
          </div>
          <div style={{fontFamily: FONT.display, fontWeight: 700, fontSize: 70, color: C.text, marginTop: 40, letterSpacing: 6 + (1 - prog(f, CTA_FROM + 8, 30)) * 30, opacity: prog(f, CTA_FROM + 8, 14)}}>ZYRA</div>
          <div style={{display: 'inline-block', marginTop: 40, padding: '20px 56px', borderRadius: 60, background: C.lime, color: C.ink, fontFamily: FONT.body, fontWeight: 800, fontSize: 52, boxShadow: `0 0 ${30 + 30 * pulse}px ${C.lime}88`, transform: `scale(${(0.7 + 0.3 * prog(f, CTA_FROM + 18, 14)) * (1 + 0.03 * Math.sin(f / 4))})`, opacity: prog(f, CTA_FROM + 18, 10)}}>{ctaTxt}</div>
          <div style={{fontFamily: FONT.body, fontWeight: 700, fontSize: 46, color: C.text, marginTop: 36, opacity: prog(f, CTA_FROM + 30, 14)}}>zyrapadel.com</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
