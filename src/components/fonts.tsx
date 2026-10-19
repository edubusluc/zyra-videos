import {useEffect, useState} from 'react';
import {cancelRender, continueRender, delayRender, staticFile} from 'remotion';

// Como en static/style.css de la web: las mayúsculas con tilde y la Ñ de Syncopate salen con el acento despegado
// (sobre todo en cursiva), así que esas letras se pintan con Archivo ExtraBold algo más grande y el resto sigue en Syncopate.
const SIN_TILDES = 'U+0000-00C0, U+00C2-00C8, U+00CA-00CC, U+00CE-00D0, U+00D2, U+00D4-00D9, U+00DB, U+00DD-10FFFF';
const TILDES = 'U+00C1, U+00C9, U+00CD, U+00D3, U+00DA, U+00DC, U+00D1';

const FACES: [string, string, FontFaceDescriptors][] = [
  ['Archivo', 'fonts/Archivo-Regular.ttf', {weight: '400'}],
  ['Archivo', 'fonts/Archivo-Bold.ttf', {weight: '700'}],
  ['Archivo', 'fonts/Archivo-ExtraBold.ttf', {weight: '800'}],
  ['Syncopate', 'fonts/Syncopate-Bold.ttf', {weight: '700', unicodeRange: SIN_TILDES}],
  ['Syncopate', 'fonts/Syncopate-BoldItalic.ttf', {weight: '700', style: 'italic', unicodeRange: SIN_TILDES}],
  ['Syncopate', 'fonts/Archivo-ExtraBold.ttf', {weight: '700', unicodeRange: TILDES, sizeAdjust: '112%'} as FontFaceDescriptors],
];

/** Carga las fuentes del producto antes de renderizar el primer fotograma. */
export const useBrandFonts = () => {
  const [handle] = useState(() => delayRender('fuentes'));
  useEffect(() => {
    Promise.all(FACES.map(([family, file, desc]) => new FontFace(family, `url(${staticFile(file)})`, desc).load().then((f) => document.fonts.add(f))))
      .then(() => continueRender(handle))
      .catch((e) => cancelRender(e));
  }, [handle]);
};
