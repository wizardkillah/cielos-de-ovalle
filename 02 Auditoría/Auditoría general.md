---
tags: [auditoria]
fecha: 2026-11-16
---
# Auditoría general

Revisión de los seis prototipos archivados en `99 Archivo/Prototipos anteriores`.

## Conclusión
La idea y la estética eran buenas; **los números no**. Las seis versiones compartían ideas pero cada una llevaba su propia copia del cálculo astronómico, con errores distintos, y ninguna tenía pruebas. La versión que más se acercaba al producto buscado (`observatorio-app.html`) no podía cumplir su promesa principal: no sabía hacia dónde apuntaba el teléfono.

Se optó por reescribir sobre una base única en vez de parchar seis archivos.

## Cómo se auditó
1. Lectura completa del código de los seis archivos.
2. Extracción de sus funciones astronómicas y ejecución en Node contra **PyEphem** (teoría planetaria VSOP87 y lunar completa) en tres fechas.
3. Revisión de cada afirmación de las fichas contra fuentes.
4. Revisión de rendimiento, robustez sin conexión y uso táctil.

## Error medido de los prototipos

Separación angular entre la posición calculada y la de referencia (geocéntrica):

| Cuerpo | `stellarium-pro` | `observatorio-app` | **Versión 1.0** |
|---|---|---|---|
| Sol | 0,00° | 0,00° | 0,01° |
| Luna | **21° – 74°** | 0,04° – 0,12° | 0,01° |
| Mercurio | 0,19° – 0,29° | 0,20° – 0,29° | 0,02° |
| Venus | 0,13° – 0,95° | 0,13° – 1,00° | 0,03° |
| Marte | 0,22° – 0,55° | 0,21° – 0,56° | 0,03° |
| Júpiter | **1,0° – 2,8°** | **1,0° – 2,8°** | 0,08° |
| Saturno | **5,1° – 7,6°** | **5,1° – 7,6°** | 0,08° |

En los prototipos 3D (`solar-system-hd`, `milkyway-3d`) la longitud heliocéntrica de los planetas se desviaba hasta **18° en Marte y 12° en Saturno**, porque dos de los elementos orbitales estaban inventados.

Para dimensionar: la Luna llena mide 0,5°. Un error de 7° en Saturno es catorce lunas de distancia; uno de 74° en la Luna es apuntar a otra parte del cielo.

## Evaluación por área

| Área | Prototipos | Versión 1.0 |
|---|---|---|
| **Exactitud** | Luna y planetas exteriores inservibles; sin precesión ni paralaje; Vía Láctea con el centro corrido 90° | Contrastada en 240 fechas; error máximo 0,08° |
| **Arquitectura** | 6 copias divergentes del motor; todo en variables globales; sin pruebas | Módulos separados, un motor, pruebas de motor y de navegador |
| **Datos** | ~90 estrellas a mano con duplicados; figuras con estrellas inexistentes | 5.044 estrellas y 88 figuras de catálogo |
| **Robustez** | Sin internet no cargaba (CDN); un error dejaba la pantalla en negro | Sin dependencias; funciona desde un archivo local |
| **Rendimiento** | Hasta ~1.500 cálculos de efemérides por cuadro; DOM reconstruido 60 veces por segundo | Cálculos pesados solo al abrir un panel |
| **Móvil** | Solo ratón en tres versiones; sin pellizco; pantalla borrosa (sin densidad de píxeles) | Gestos táctiles, pellizco, nitidez a 2× |
| **Producto** | «¿Qué estoy mirando?» sin sensores; horas en UTC | Sigue al teléfono; hora local del lugar |
| **Contenido** | Varios datos falsos o desactualizados | 62 fichas revisadas |
| **Honestidad** | Se anunciaba «VSOP87», «ELP2000», «Hipparcos», «datos del Hubble» sin serlo | Cada método está nombrado como lo que es |

## Hallazgos
- 34 defectos de código: [[Bugs encontrados]]
- 13 errores de contenido: [[Correcciones de contenido]]

## Lo que se conservó
- La estética de domo holográfico de las imágenes de referencia (ahora es el domo de coordenadas real del cielo).
- El botón «¿Qué estoy mirando?» y las fichas bilingües con dato curioso.
- La idea de escalas hasta el borde de la galaxia, convertida en el modo Cosmos.
- El control de tiempo y los saltos a eventos.

![[referencia-domo-1.jpg|380]] ![[app-cosmos-sistema-solar.jpg|240]]
