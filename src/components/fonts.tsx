import {useEffect, useState} from 'react';
import {cancelRender, continueRender, delayRender, staticFile} from 'remotion';

const FACES: [string, string, string, string][] = [
  ['Archivo', 'fonts/Archivo-Regular.ttf', '400', 'normal'],
  ['Archivo', 'fonts/Archivo-Bold.ttf', '700', 'normal'],
  ['Archivo', 'fonts/Archivo-ExtraBold.ttf', '800', 'normal'],
  ['Syncopate', 'fonts/Syncopate-Bold.ttf', '700', 'normal'],
  ['Syncopate', 'fonts/Syncopate-BoldItalic.ttf', '700', 'italic'],
];

/** Carga las fuentes del producto antes de renderizar el primer fotograma. */
export const useBrandFonts = () => {
  const [handle] = useState(() => delayRender('fuentes'));
  useEffect(() => {
    Promise.all(
      FACES.map(([family, file, weight, style]) =>
        new FontFace(family, `url(${staticFile(file)})`, {weight, style}).load().then((f) => document.fonts.add(f)),
      ),
    )
      .then(() => continueRender(handle))
      .catch((e) => cancelRender(e));
  }, [handle]);
};
