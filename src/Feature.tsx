import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {Logo} from './components/Logo';
import {PhoneFrame, Screen} from './components/Phone';
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
export const Feature: React.FC<VideoData> = ({hook, title, src, imgW, scroll, box, subs, cta}) => {
  useBrandFonts();
  const f = useCurrentFrame();
  const hookOut = prog(f, HOOK_END, 14);
  const main = prog(f, HOOK_END - 6, 26);
  const ctaIn = prog(f, CTA_FROM, 18);
  const sc = interpolate(f, [HOOK_END, CTA_FROM], scroll, {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const pulse = 0.55 + 0.45 * Math.sin(f / 5);
  const subStart = [86, 166, 246];
  const subIdx = f < subStart[1] ? 0 : f < subStart[2] ? 1 : 2;
  const subAt = subStart[subIdx];
  return (
    <AbsoluteFill style={{background: `radial-gradient(110% 60% at 50% 55%, ${C.forest} 0%, ${C.bg} 72%)`}}>
      {/* Gancho */}
      <div style={{position: 'absolute', left: SAFE.side, right: SAFE.side, top: 700, opacity: 1 - hookOut}}>
        <Line text={hook[0]} at={2} out={HOOK_END} size={64} from="left" />
        <div style={{height: 10, width: `${prog(f, 20, 22) * 100}%`, background: C.lime, margin: '14px 0 22px'}} />
        <Line text={hook[1]} at={26} out={HOOK_END} size={64} color={C.lime} italic from="right" />
      </div>
      {/* Cuerpo */}
      <div style={{position: 'absolute', inset: 0, opacity: f < CTA_FROM ? main : 1 - ctaIn}}>
        <div style={{position: 'absolute', left: SAFE.side, right: SAFE.side, top: SAFE.top}}>
          <Line text={title} at={HOOK_END} size={44} />
          <div style={{height: 8, width: `${prog(f, HOOK_END + 8, 20) * 38}%`, background: C.lime, marginTop: 14}} />
        </div>
        <div style={{position: 'absolute', left: (1080 - PH_W - 28) / 2, top: 400 + (1 - main) * 160}}>
          <PhoneFrame width={PH_W} height={PH_H}>
            <Screen src={src} imgW={imgW} width={PH_W} scroll={sc} reveal={prog(f, HOOK_END, 22)}>
              {box ? (
                <div style={{position: 'absolute', left: box[0], top: box[1], width: box[2], height: box[3], border: `5px solid ${C.lime}`, borderRadius: 18, boxShadow: `0 0 ${40 * pulse}px ${C.lime}`, opacity: prog(f, HOOK_END + 30, 12)}} />
              ) : null}
            </Screen>
          </PhoneFrame>
        </div>
        <div style={{position: 'absolute', left: SAFE.side, right: SAFE.side, top: 1370, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center'}}>
          <div key={subIdx} style={{fontFamily: FONT.body, fontWeight: 800, fontSize: 46, lineHeight: 1.15, color: C.text, opacity: prog(f, subAt, 10), transform: `translateY(${(1 - prog(f, subAt, 12)) * 30}px)`}}>
            {subs[subIdx]}
          </div>
        </div>
      </div>
      {/* Cierre */}
      <AbsoluteFill style={{opacity: ctaIn, alignItems: 'center', justifyContent: 'center'}}>
        <div style={{transform: `translateY(${(1 - ctaIn) * 40}px)`, textAlign: 'center'}}>
          <Logo height={200} />
          <div style={{fontFamily: FONT.display, fontWeight: 700, fontSize: 70, color: C.text, marginTop: 40, letterSpacing: 6}}>ZYRA</div>
          <div style={{fontFamily: FONT.body, fontWeight: 800, fontSize: 52, color: C.lime, marginTop: 36}}>{cta}</div>
          <div style={{fontFamily: FONT.body, fontWeight: 700, fontSize: 46, color: C.text, marginTop: 20}}>zyrapadel.com</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
