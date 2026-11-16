---
tags: [auditoria]
---
# Bugs encontrados

Gravedad: 🔴 rompe la función o da resultados falsos · 🟠 degrada mucho · 🟡 menor.
Todos están resueltos en la versión 1.0, salvo donde se indica.

## Exactitud astronómica

| ID | Dónde | Gr. | Defecto | Evidencia | En 1.0 |
|---|---|---|---|---|---|
| A1 | `stellarium-pro` · `getMoonPos` | 🔴 | Una constante local `D` (elongación lunar) tapa a la `D` global (radianes→grados). AR y Dec de la Luna se multiplican por un número cualquiera. | Luna a 21°, 40° y 74° de su lugar en tres fechas | Motor nuevo, Luna a 0,01° |
| A2 | Todas · planetas | 🔴 | Elementos orbitales truncados y Tierra en órbita circular. | Saturno 5–7,6°, Júpiter 1–2,8° | Elementos JPL completos, 0,08° |
| A3 | `solar-system-hd`, `milkyway-3d` · `keplerian` | 🔴 | Argumento del perihelio y nodo **inventados** (`w = L0*0.3 + …`, `O = a*30 + …`). | Longitud heliocéntrica hasta 18° (Marte) | Posiciones reales |
| A4 | Prototipos 3D | 🟠 | Coordenada Z multiplicada por 2: inclinaciones orbitales exageradas al doble. | Código | Sin exageración |
| A5 | `solar-system-hd` | 🟠 | La Luna modelada como un planeta a 1,003 UA del Sol. | Código | Fuera del modo Cosmos |
| A6 | Todas | 🟠 | Sin precesión: el catálogo J2000 se usa como si fuera de hoy. | 0,37° en 2026 | Matriz de precesión IAU 1976 |
| A7 | Todas | 🟠 | Sin paralaje lunar. | Hasta 1° | Posición topocéntrica |
| A8 | `star-map`, `stellarium-pro`, `observatorio-app` · Vía Láctea | 🟠 | Conversión galáctica→ecuatorial con seno donde va coseno. | Centro galáctico corrido exactamente 90° a lo largo de la banda | Matriz verificada (0,0002°) |
| A9 | `stellarium-pro` · `jdToHHMM` | 🔴 | Salidas, puestas y crepúsculos mostrados en UTC sin indicarlo. | 3 horas de diferencia en Chile | Hora local del lugar |
| A10 | `star-map`, `stellarium-pro` · constelaciones | 🟠 | Figuras con estrellas que no existen en el catálogo (`Sheliak`, `Tarazed`) y uniones erróneas: Cruz del Sur unida a Theta Carinae, Casiopea a Almach, Géminis a Elnath. | Código | Figuras de catálogo |
| A11 | `star-map`, `stellarium-pro` · catálogo | 🟡 | Estrellas duplicadas con dos nombres (Shaula/Lambda Sco, Sargas/Theta Sco, Regor/Gamma Vel, Al Nair/Grus α, Alioth y Phecda dos veces). | Código | Catálogo único |
| A12 | Todas | 🟡 | Se anunciaba VSOP87, ELP2000 e Hipparcos; eran aproximaciones cortas y una lista manual. | Textos de interfaz | Métodos nombrados como son |

## Producto y experiencia

| ID | Dónde | Gr. | Defecto | En 1.0 |
|---|---|---|---|---|
| P1 | `observatorio-app` | 🔴 | «¿Qué estoy mirando?» usa el centro de una vista arrastrada con el dedo; no lee brújula ni giroscopio. | Modo «seguir el teléfono» |
| P2 | `observatorio-app` · pastillas | 🟠 | Tocar una pastilla ejecuta `whatAmILooking()` en vez de abrir ese objeto. | Lista «Esta noche» abre el objeto tocado |
| P3 | `observatorio-app` | 🟠 | Latitud y longitud fijas en el código; sin GPS ni otros lugares. | 10 lugares, GPS y coordenadas propias |
| P4 | `observatorio-app` | 🟡 | Pellizco declarado y vacío (`// pinch zoom`). | Pellizco implementado |
| P5 | `star-map`, `stellarium-pro` | 🟠 | Solo eventos de ratón: inutilizables en teléfono. | Eventos de puntero unificados |
| P6 | Todas las 2D | 🟠 | Lienzo sin densidad de píxeles: imagen borrosa en pantallas de teléfono. | Escala 2× |
| P7 | `observatorio-app` | 🟡 | Brújula decorativa que no gira. | Rótulo «Mirando al SE · 35°» real |
| P8 | `solar-system-3d` | 🟠 | Las etiquetas de los planetas se crean en la posición inicial y no los siguen. | Etiquetas por cuadro |
| P9 | `stellarium-pro` · imagen «DSS/NASA» | 🟡 | Depende de un servicio externo lento; rotulado como «datos del Hubble» (el DSS son placas fotográficas tomadas desde tierra). | Retirado |
| P10 | Varias | 🟡 | Uso de `alert()`; textos de 8–10 px; contraste bajo; botones sin etiqueta accesible. | Avisos propios, mínimo 11 px, etiquetas ARIA |

## Robustez y arquitectura

| ID | Dónde | Gr. | Defecto | En 1.0 |
|---|---|---|---|---|
| R1 | Prototipos 3D | 🔴 | Three.js desde un CDN: sin conexión, pantalla en negro. | Sin dependencias |
| R2 | `milkyway-3d` (1.ª entrega) | 🔴 | Llamada a `addParticleRing`, nunca definida: no pasaba del título. | Prueba de humo en navegador |
| R3 | `observatorio-app` | 🟡 | Archivo truncado a 64 kB al generarse y completado a mano. | Construcción con `build.py` |
| R4 | Todas | 🟠 | Seis copias distintas del cálculo astronómico; ninguna prueba. | Un motor, 66 comprobaciones automáticas |
| R5 | Todas | 🟡 | Todo en variables globales; HTML, estilos y lógica en un bloque. | Módulos: motor, datos, contenido, cielo, cosmos, app |
| R6 | Todas | 🟡 | Fuentes con `@import` bloqueante y sin alternativa sin conexión. | Carga no bloqueante con fuentes del sistema de respaldo |
| R7 | Varias | 🟡 | Geolocalización sin tiempo límite ni manejo de error. | Tiempo límite y mensaje claro |

## Rendimiento

| ID | Dónde | Gr. | Defecto | En 1.0 |
|---|---|---|---|---|
| F1 | `stellarium-pro` · `updateUI` | 🔴 | Salidas, puestas y crepúsculos recalculados **en cada cuadro**: unas 1.500 evaluaciones de efemérides 60 veces por segundo. | Solo al abrir un panel |
| F2 | `stellarium-pro` · `updatePlanetList` | 🟠 | La lista de planetas se reconstruye entera en cada cuadro; los toques se pierden. | DOM actualizado solo cuando cambia |
| F3 | `solar-system-3d` | 🟠 | `if (Math.floor(ts/1000) % 3 === 0)` reconstruye las órbitas unas 60 veces por segundo, un segundo de cada tres. | Órbitas calculadas una vez |
| F4 | `solar-system-3d` | 🟡 | Un `BufferAttribute` nuevo por planeta y por cuadro para las estelas. | Sin asignaciones por cuadro en el bucle |
| F5 | `stellarium-pro` | 🟡 | El campo de fecha se reescribe en cada cuadro mientras corre la animación. | Rótulo actualizado una vez por minuto |

## Pendiente conocido en 1.0
- La orientación en **modo apaisado** con sensores está implementada pero no probada en un teléfono real.
- En iPhone el norte depende de `webkitCompassHeading`, que pierde precisión con el teléfono muy vertical.
Ver [[Sensores y realidad aumentada]] y [[Hoja de ruta]].
