/**
 * Un vídeo = un archivo guiones/<id>.json. `scripts.json` lo genera render.mjs juntando todos.
 * `box` = destacado en píxeles de la captura original [x, y, ancho, alto]. `scroll` = desplazamiento inicial → final.
 * Solo capturas con datos de demostración (JUGADOR 1…), nunca nombres reales.
 */
import scripts from './scripts.json';

export type VideoData = {
  id: string;
  hook: [string, string];
  title: string;
  src: string;
  imgW: number;
  scroll: [number, number];
  box?: [number, number, number, number];
  /** De 3 a 5 subtítulos, repartidos a partes iguales durante el vídeo. */
  subs: string[];
  /** Opcional: lo que se dice en voz alta por cada subtítulo (la pantalla sigue mostrando `subs`). */
  locucion?: string[];
  cta: string;
  /** false = sin subtítulos (los 3 textos bajo el móvil); render.mjs deja entonces out/<id>.voz.txt con los tiempos para la voz en off. */
  subtitulos?: boolean;
};

export const VIDEOS = scripts as VideoData[];
