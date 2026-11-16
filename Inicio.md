---
tags: [inicio]
version_app: "1.1"
fecha: 2026-11-16
---
# Cielos de Ovalle

Mapa del cielo en tiempo real para quien visita un observatorio del Limarí y quiere saber **qué está mirando**. Funciona en cualquier navegador, sin instalación, sin conexión y en español e inglés.

> [!success] Abrir la app
> **[Cielos de Ovalle — abrir en el navegador](App/cielos-de-ovalle.html)**
> Es un único archivo de 342 kB. También puedes hacer doble clic sobre `App/cielos-de-ovalle.html` desde el explorador de archivos.

![[app-polo-sur.jpg]]

## Qué hay en esta bóveda

| Carpeta | Para qué sirve | Empieza por |
|---|---|---|
| `01 Proyecto` | Qué es, para quién, qué se decidió y qué falta | [[Visión y alcance]] · [[Hoja de ruta]] |
| `02 Auditoría` | Revisión de los seis prototipos anteriores | [[Auditoría general]] · [[Bugs encontrados]] |
| `03 Arquitectura` | Cómo está construida la versión 1.0 | [[Arquitectura]] · [[Motor astronómico]] |
| `04 Guías` | Uso, publicación y guion para guías | [[Cómo usar la app]] · [[Publicar la app]] |
| `05 Cielo austral` | Contenido astronómico para Ovalle | [[Cielo de Ovalle por estaciones]] · [[Índice de objetos]] |
| `App` | La aplicación y su código fuente | [[LEEME]] |
| `99 Archivo` | Prototipos anteriores e imágenes | [[Prototipos anteriores]] |

## Estado al 16 de noviembre de 2026

- **Motor astronómico**: reescrito y contrastado con efemérides de referencia en 240 fechas. Error máximo 0,08° (ver [[Precisión y pruebas]]).
- **Catálogo**: 5.044 estrellas reales, 88 constelaciones, 31 objetos de cielo profundo verificados, Sol, Luna y 7 planetas.
- **App**: probada de forma automática en Chromium, en tamaño móvil y de escritorio, sin errores.
- **Pendiente de probar en teléfonos reales**: la brújula y la cámara. Solo funcionan con la app publicada en `https` (ver [[Sensores y realidad aumentada]]).

## Lo que cambió respecto de los prototipos

| Antes | Ahora |
|---|---|
| 6 archivos con 6 copias distintas del cálculo astronómico | 1 motor, con pruebas |
| Luna hasta 74° fuera de lugar; Saturno hasta 7,6° | Luna 0,01°; Saturno 0,08° |
| ~90 estrellas escritas a mano, con duplicados | 5.044 estrellas de catálogo |
| «¿Qué estoy mirando?» no sabía hacia dónde apuntaba el teléfono | Sigue al teléfono con sus sensores |
| Necesitaba internet (Three.js por CDN) | Funciona sin conexión |
| Horas en UTC | Hora local del lugar |
| Datos inventados o desactualizados en varias fichas | Fichas revisadas (ver [[Correcciones de contenido]]) |

## Esta noche en Ovalle (16 nov 2026)

Puesta del Sol 20:20 · cielo oscuro desde las 21:52 · Luna en cuarto creciente (46 %).
Saturno alto hacia el norte al anochecer. La Cruz del Sur roza el horizonte sur: buen momento para mostrar las [[Gran Nube de Magallanes|Nubes de Magallanes]], [[47 Tucanae]] y [[Achernar]]. Más fechas en [[Calendario astronómico 2026–2027]].

![[app-cielo-movil.jpg|260]] ![[app-ficha.jpg|260]] ![[app-cosmos-galaxia.jpg|420]]
