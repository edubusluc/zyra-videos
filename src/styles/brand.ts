/** Paleta y tipografía de Zyra, tomadas de static/style.css (--z-*) del producto. */
export const C = {
  bg: '#0A0B09',
  bgTop: '#252821',
  surface: '#141512',
  surface2: '#1C1D1A',
  surface3: '#252722',
  border: '#30322D',
  borderStrong: '#474A42',
  lime: '#B4F100',
  limeHover: '#C8FF2E',
  limePress: '#9AD000',
  ink: '#0A0A0A',
  text: '#F4F5F1',
  muted: '#A4A79E',
  danger: '#FF5C63',
};

/** `lime` con transparencia (como rgba(var(--z-lime-rgb), a) en la web). */
export const limeA = (a: number) => `rgba(180, 241, 0, ${a})`;

export const FONT = {
  display: "'Syncopate', 'Archivo', sans-serif",
  body: "'Archivo', sans-serif",
};

/**
 * Estilos de texto de la web (static/style.css), en px para 1080×1920:
 * - title: h1 / .z-title y .z-hero-title (Syncopate cursiva, mayúsculas, interletraje .02–.03em).
 * - wordmark: .z-wordmark (ZYRA junto al logo).
 * - eyebrow: .z-eyebrow / .z-hero-tag (antetítulo lima, mayúsculas espaciadas).
 * - button: .btn (Archivo 800, mayúsculas, .05em, píldora).
 */
export const TYPE = {
  title: {fontFamily: FONT.display, fontStyle: 'italic', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.02em'},
  wordmark: {fontFamily: FONT.display, fontStyle: 'italic', fontWeight: 700, letterSpacing: '.06em'},
  eyebrow: {fontFamily: FONT.body, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.14em', color: C.lime},
  button: {fontFamily: FONT.body, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em'},
} as const;

/** Relleno degradado de .z-hero-title: blanco que cae a gris piedra. */
export const HERO_FILL = {background: 'linear-gradient(180deg, #FFFFFF 35%, #8E9286 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent'} as const;

/** Sombras de la web: --z-glow (resplandor lima contenido) y --z-shadow-pop. */
export const GLOW = `0 10px 30px -12px ${limeA(0.55)}`;
export const SHADOW_POP = '0 24px 48px -16px rgba(0, 0, 0, .75), 0 0 0 1px rgba(255, 255, 255, .04)';
/** Fondo de página de la web: halo lima arriba sobre el degradado oscuro. */
export const PAGE_BG = `radial-gradient(50% 35% at 50% -8%, ${limeA(0.09)} 0%, ${limeA(0)} 100%), radial-gradient(120% 60% at 50% 0%, ${C.bgTop} 0%, ${C.bg} 70%)`;

/** Zona segura de Reels/Stories/TikTok (px sobre 1080×1920). */
export const SAFE = {top: 240, bottom: 420, side: 72};
