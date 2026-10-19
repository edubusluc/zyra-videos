import React from 'react';
import {Composition} from 'remotion';
import {DURATION, FPS, Feature} from './Feature';
import {VIDEOS} from './data';

/** Una composición por entrada de data.ts (id = nombre del MP4). */
export const RemotionRoot: React.FC = () => (
  <>
    {VIDEOS.map((v) => (
      <Composition key={v.id} id={v.id} component={Feature} durationInFrames={DURATION} fps={FPS} width={1080} height={1920} defaultProps={v} />
    ))}
  </>
);
