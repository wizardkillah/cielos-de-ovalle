---
tags: [guia, base44]
---
# Prompt maestro Base44 (v2)

Versión corregida del prompt anterior. Cambios principales:

- **No pide reimplementar la astronomía.** Entrega el motor ya probado (`astro.js`) y el catálogo (`data.js`). El prompt original describía fórmulas incompletas que habrían reproducido los errores de los prototipos ([[Bugs encontrados]]).
- Corrige la geografía: el ELT no está en la Región de Coquimbo.
- Corrige la proyección: gnomónica solo con cámara; estereográfica en el mapa.
- Describe la orientación con la matriz del estándar, no con un filtro sobre ángulos.
- Elimina datos sin respaldo.

> [!tip] Antes de usarlo
> La app de esta bóveda ya hace todo lo que pide este prompt y se puede publicar hoy ([[Publicar la app]]). Reconstruirla en Base44 solo conviene si se necesitan cuentas de usuario, un panel para el guía o contenidos editables sin tocar código.

## Archivos a adjuntar
`App/fuente/src/astro.js`, `data.js`, `content.js`, `i18n.js` y, como referencia de comportamiento, `sky.js` y `app.js`.

## Prompt

```text
Construye una aplicación web móvil llamada «Cielos de Ovalle» para visitantes de
observatorios turísticos de la provincia de Limarí, Región de Coquimbo, Chile.
Su función: mostrar el cielo real del lugar y del momento, e identificar lo que
el visitante está mirando. Bilingüe español/inglés. Debe funcionar sin conexión.

REGLA PRINCIPAL
Adjunto astro.js (motor astronómico probado contra efemérides de referencia) y
data.js (5.044 estrellas, 88 constelaciones). Úsalos tal cual, como módulos.
NO reescribas ni «simplifiques» ningún cálculo astronómico. Toda posición debe
salir de estas funciones:
  Astro.jdFromMs(ms)                         día juliano
  Astro.skyMatrix(jd, lat, lon)              matriz J2000 → [Este, Norte, Arriba]
  Astro.horizontal(id, jd, {lat, lon})       'sun' | 'moon' | planeta → az, alt, altApp, mag…
  Astro.crossings(altFn, jd, días, h0)       salidas y puestas
  Astro.transit(altFn, jd, días)             culminación
  Astro.nextPhase(jd, 0|90|180|270)          fases de la Luna
content.js trae las fichas bilingües y los lugares; i18n.js, los textos.

PANTALLAS
1. Cielo (principal): lienzo a pantalla completa con estrellas (tamaño según
   magnitud, color según B−V), líneas y nombres de constelaciones, Vía Láctea,
   objetos de cielo profundo, Sol, Luna con su fase y planetas. Horizonte con
   puntos cardinales. Rejilla de altura y azimut como domo. Arrastrar para
   mirar, pellizcar para acercar, tocar un objeto para abrir su ficha.
2. Ficha de objeto (panel inferior): nombre, tipo, con qué se ve, dónde está
   ahora, descripción en lenguaje simple, distancia, brillo, hora de salida,
   culminación y puesta en hora local, cómo encontrarlo, dato curioso, otros
   nombres, botón «Llévame».
3. Esta noche: puesta y salida del Sol, inicio y fin del cielo oscuro
   (crepúsculo astronómico, Sol a −18°), fase de la Luna, planetas visibles,
   lista de objetos sobre el horizonte ordenada por interés, buscador.
4. Ajustes: lugar (lista de content.js, GPS, coordenadas), fecha y hora,
   velocidad del tiempo, capas, idioma, luz roja.

BOTÓN PRINCIPAL «¿Qué estoy mirando?»
Identifica el objeto más cercano al centro de la pantalla, dando prioridad a
Sol, Luna, planetas, cielo profundo destacado y estrellas brillantes. Si no hay
nada destacado, di hacia dónde mira el usuario, en qué constelación, y ofrece
ir al objeto notable más cercano.

SEGUIR EL TELÉFONO
- Usa 'deviceorientationabsolute' (Android) o webkitCompassHeading (iOS).
  En iOS llama a DeviceOrientationEvent.requestPermission() dentro del toque
  del usuario.
- Construye la base de cámara con la matriz de rotación del estándar W3C
  (mundo: X este, Y norte, Z arriba). La cámara trasera mira hacia −Z del
  aparato; arriba de pantalla es +Y. Ver onOrient() en app.js.
- Suaviza con un filtro de paso bajo aplicado a los VECTORES de la base, no a
  los ángulos, y re-ortonormaliza.
- Permite calibrar arrastrando hacia los lados y guarda el ajuste.
- Si los sensores no existen o se deniegan, la app sigue en modo manual.

CÁMARA (REALIDAD AUMENTADA)
- getUserMedia con facingMode 'environment' como fondo; el cielo se dibuja
  encima con fondo transparente.
- Con cámara: proyección gnomónica, x = f·cx/cz, con f según el campo de la
  cámara (ajustable 40°–90°, por defecto 62°).
- Sin cámara: proyección estereográfica, x = K·cx/(1+cz).
- Si el objeto elegido queda fuera de pantalla, flecha en el borde con los
  grados que faltan.

REQUISITOS
- Móvil primero; también usable en computador.
- Fondo negro, textos claros, un solo color de acento cálido para la acción
  principal. Modo de luz roja para toda la interfaz.
- Áreas táctiles de al menos 44 px. Texto mínimo 11 px.
- Horas siempre en hora local del lugar (America/Santiago dentro de Chile).
- Sin conexión: todo el catálogo va dentro de la app. PWA con service worker.
- Solo https. Sin analítica ni cuentas para el visitante.
- Los cálculos de salidas y puestas se hacen al abrir un panel, nunca en cada
  cuadro de animación.

LUGAR POR DEFECTO
Ovalle: latitud −30,6033°, longitud −71,2003°.

NO HACER
- No inventar datos ni nombres en lenguas originarias: usar solo content.js.
- No afirmar precisiones ni catálogos que no se usan.
- No depender de servicios externos para funcionar.

CRITERIOS DE ACEPTACIÓN
- El 6 de febrero de 2027 a las 12:07 hora de Chile, desde Ovalle, la Luna
  cubre parcialmente al Sol (magnitud 0,62).
- El 16 de noviembre de 2026 a las 22:30, Saturno está a 58° de altura hacia
  el norte y la Luna, en cuarto creciente, hacia el oeste.
- Con el teléfono vertical apuntando al sur, el centro de la pantalla marca
  azimut 180° y altura 0°.
- La app abre y funciona en modo avión después de la primera carga.
```

## Qué supervisar en lo que genere
1. Que **no** haya reescrito `astro.js` (comparar el archivo).
2. Que pasen los tres primeros criterios de aceptación.
3. Que el permiso de orientación en iPhone se pida dentro de un toque.
4. Que no calcule salidas y puestas en el bucle de animación.
