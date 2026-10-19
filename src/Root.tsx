import React from 'react';
import {Composition} from 'remotion';
import {DURATION, FPS, Feature} from './Feature';
import {MEME_H, MEME_W, Meme} from './Meme';
import {VIDEOS} from './data';
import memes from './memes.json';

/** Un vídeo por entrada de guiones/ (id = nombre del MP4) y un meme por entrada de memes/ (id = meme-<nombre>). */
export const RemotionRoot: React.FC = () => (
  <>
    {VIDEOS.map((v) => (
      <Composition key={v.id} id={v.id} component={Feature} durationInFrames={DURATION} fps={FPS} width={1080} height={1920} defaultProps={v} />
    ))}
    {(memes as {id: string; beforeLabel: string; before: string; afterLabel: string; after: string}[]).map((m) => (
      <Composition key={m.id} id={`meme-${m.id}`} component={Meme} durationInFrames={1} fps={FPS} width={MEME_W} height={MEME_H} defaultProps={m} />
    ))}
  </>
);
