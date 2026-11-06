import {useCurrentFrame, useVideoConfig} from 'remotion';

/**
 * Los tiempos de las plantillas (gancho, subtítulos, cierre; también `tiempos` de la voz) están en «fotogramas de 30 por segundo».
 * `useT()` devuelve el instante actual en esas unidades, con decimales, sea cual sea el fps de la composición: así un vídeo a 60 fps
 * (el doble de fotogramas) mueve todo con suavidad sin tocar ni una duración.
 */
export const T = 30;
export const useT = () => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  return (f * T) / fps;
};
