// Genera los efectos de sonido del estilo «creador» (síntesis propia, sin material de terceros) en public/sfx/*.wav.
// Uso: node scripts/sfx.mjs   (los .wav ya están en el repo; solo hace falta para regenerarlos o cambiarlos)
import {mkdirSync, writeFileSync} from 'node:fs';

const SR = 44100;
let semilla = 12345;
const ruido = () => ((semilla = (semilla * 1664525 + 1013904223) >>> 0) / 2 ** 31) - 1; // ruido blanco reproducible
const wav = (nombre, seg, f) => {
  const n = Math.round(seg * SR), d = Buffer.alloc(44 + n * 2);
  d.write('RIFF', 0); d.writeUInt32LE(36 + n * 2, 4); d.write('WAVEfmt ', 8); d.writeUInt32LE(16, 16); d.writeUInt16LE(1, 20); d.writeUInt16LE(1, 22);
  d.writeUInt32LE(SR, 24); d.writeUInt32LE(SR * 2, 28); d.writeUInt16LE(2, 32); d.writeUInt16LE(16, 34); d.write('data', 36); d.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) d.writeInt16LE(Math.round(Math.max(-1, Math.min(1, f(i / SR, i / n))) * 32767), 44 + i * 2);
  writeFileSync(`public/sfx/${nombre}.wav`, d);
};
mkdirSync('public/sfx', {recursive: true});

// Whoosh: ruido filtrado paso banda cuyo centro sube, con entrada rápida y cola suave.
{
  let lp = 0, bp = 0;
  wav('whoosh', 0.55, (t, p) => {
    const fc = 300 + 5200 * p ** 2, k = 2 * Math.sin(Math.PI * Math.min(0.45, fc / SR)), q = 0.35;
    const x = ruido(); lp += k * bp; const hp = x - lp - q * bp; bp += k * hp;
    return bp * 0.9 * Math.min(1, t / 0.04) * Math.sin(Math.PI * p) ** 1.5;
  });
}
// Impacto: bombo corto que cae de 150 a 45 Hz más un chasquido de ruido al principio.
{
  let fase = 0;
  wav('impacto', 0.4, (t) => {
    fase += (2 * Math.PI * (45 + 105 * Math.exp(-t * 28))) / SR;
    return Math.sin(fase) * Math.exp(-t * 9) * 0.95 + ruido() * Math.exp(-t * 90) * 0.35;
  });
}
// Pop: gota corta y aguda para los cambios de subtítulo.
{
  let fase = 0;
  wav('pop', 0.16, (t) => {
    fase += (2 * Math.PI * (520 + 900 * Math.exp(-t * 40))) / SR;
    return Math.sin(fase) * Math.exp(-t * 28) * 0.7;
  });
}
console.log('Efectos en public/sfx/: whoosh, impacto, pop');
