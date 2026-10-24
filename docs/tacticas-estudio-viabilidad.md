# Vídeos de tácticas de pádel: estudio de viabilidad

## Veredicto
Es viable y encaja bien con lo que ya hay. Es un tercer tipo de vídeo (junto a *guiones* y *reacciones*) con su propia plantilla de Remotion. El mockup (`tacticas/globo-y-sube.json` + `src/Tactica.tsx`) ya renderiza una táctica completa con la marca, la zona segura de TikTok y el pie solo `zyrapadel.com`. Lo difícil no es la técnica, es **garantizar que lo que se enseña es correcto**. Eso se resuelve con proceso, no con código (ver más abajo).

## 1. Encaje con la arquitectura actual
- Un vídeo = un JSON en una carpeta (`tacticas/<id>.json`), igual que `guiones/`, `memes/` y `reacciones/`. `render.mjs` lo recoge, `Root.tsx` registra la composición `tactica-<id>`, y el flujo de CI y la app local lo renderizan igual.
- Reutiliza fuentes, colores, `SAFE`, logo y cierre de Zyra. Nada de dependencias nuevas.
- La voz sigue el flujo actual: Edu graba un mp3 por frase (gancho, un subtítulo por paso, cierre). Los pasos de la táctica son los subtítulos, así que `scripts/voz.mjs` y la app «Grabar yo la voz» valen casi sin tocar; solo hay que hacer que los cortes de cada paso sigan `tiempos` de la voz en lugar de los segundos fijos del JSON.
- Esfuerzo estimado para el sistema completo: la plantilla ya está (mockup); faltan integrar voz/tiempos, la app (formulario de táctica) y el generador de guiones.

## 2. Cómo se describe una jugada (como datos)
Pista de 10×20 m en metros (red en y=10). El JSON lleva:
- **fichas**: jugadores (`n` = nosotros, `r` = rivales), posición inicial y movimientos `{t0, t1, a}`.
- **pelota**: posición inicial y tramos `{t0, t1, a, altura}`; la altura (0–1) se dibuja como tamaño y sombra, así un globo se ve alto en una vista cenital.
- **flechas** (de movimiento o de bola, rectas o curvas), **zonas** resaltadas (p. ej. «zona de red») y marcas como «juntos».
- **pasos**: un subtítulo por paso con `*palabra*` destacada, y el instante en que entra.
Todo se anima por fotograma, sin dibujar a mano. Una táctica nueva = un JSON de ~40 líneas. Limitación: una pelota con rebote en pared o cristal se describe con varios tramos; se puede añadir un tipo `rebote` si hace falta (salidas de pared, bajadas de pared).

## 3. Generar el guion con IA
Se puede, con límites. La IA no debe inventar tácticas; debe **rellenar una plantilla validada**:
1. Edu (o un entrenador) aprueba una **lista de tácticas** (`tacticas/catalogo.md`): situación, qué hacer, por qué, cuándo NO hacerlo, fuente.
2. La IA convierte una entrada del catálogo en JSON (posiciones, trayectorias, subtítulos) y el texto de la voz. Solo reordena y redacta lo que ya está en la ficha.
3. Una vez generado, la IA marca cada afirmación con la fuente de la ficha. Si no hay ficha para algo, no lo escribe.
Esto encaja con el generador actual de guiones de `app/server.mjs` (mismo patrón: prompt + validación del resultado), cambiando el contenido de entrada.

## 4. Cómo garantizar que el contenido es correcto (lo importante)
Yo no puedo certificar que una táctica sea «lo que enseñan los entrenadores de hoy»: mi conocimiento puede estar desfasado o simplificar demasiado. Propuesta:
- **Fuentes**: cada táctica del catálogo cita al menos dos fuentes independientes (material de formación de entrenadores titulados, federación/escuelas reconocidas, análisis de partidos profesionales del circuito). Las fuentes las elige Edu; yo las busco y las resumo, pero no las doy por buenas por mi cuenta.
- **Catálogo cerrado**: solo se generan vídeos de tácticas que estén aprobadas en el catálogo. Estado de cada ficha: `borrador → revisada por Edu → validada por un entrenador`.
- **Revisión humana antes de publicar**: el JSON lleva `revision.estado`; el render de producción se niega si no es `validada` (el mockup está en `borrador`). Edu ve el vídeo y la ficha antes de grabar la voz.
- **Lenguaje con matices**: la mayoría de tácticas dependen de nivel, posición y estilo. Los vídeos dicen «lo habitual», «suele funcionar», y siempre incluyen cuándo NO aplicarla (como el paso final del mockup).
- **Sin afirmaciones numéricas** (porcentajes, «el 80% de los puntos…») salvo que vengan de una fuente citada.
- **Recomendación fuerte**: que un entrenador titulado revise las primeras 5–10 tácticas; después, el catálogo sirve de base y la revisión de cada vídeo nuevo es más ligera.

## 5. Riesgos y límites
- Lo que un vídeo de 18 s puede explicar es una idea por vídeo; los matices (zurdos, nivel, lado) se pierden. Mejor series pequeñas y centradas («Táctica nº N»).
- La vista cenital 2D no muestra bien el golpe (efectos, altura exacta, posición del cuerpo). Se compensa con la voz y el subtítulo.
- Marca y plataforma: no se muestran jugadores reales ni marcas de terceros; solo fichas. El vídeo promociona Zyra solo con el pie y el cierre (nada de claims de rendimiento).
- Hay muchas variaciones por lado (derecha/revés), mano dominante y nivel; el catálogo debe decir en qué contexto vale.

## 6. Plan por fases
1. **Fase 0 (hecho):** mockup de una táctica.
2. **Fase 1:** Edu valida el diseño y elige las primeras 5–10 tácticas; yo preparo las fichas con fuentes y Edu/un entrenador las revisa.
3. **Fase 2:** integración con voz (tiempos por frase), app y generador de guion basado en el catálogo; puerta de `revision.estado`.
4. **Fase 3:** biblioteca de patrones (globo, salida de pared, subida a la red, bandeja/víbora, defensa de remate…) y variantes visuales (cámara que sigue la pelota, mapa de calor).
