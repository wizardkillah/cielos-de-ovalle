---
tags: [arquitectura]
---
# Proyección y cámara

## La cámara es una base de tres vectores
En vez de guardar ángulos, la cámara virtual es una base ortonormal en coordenadas del horizonte **[Este, Norte, Arriba]**:

- `F` hacia dónde mira,
- `R` la derecha de la pantalla,
- `U` el arriba de la pantalla.

En modo manual se construye desde azimut y altura:

```
F = ( sen az · cos alt,  cos az · cos alt,  sen alt )
R = ( cos az,           −sen az,           0       )
U = (−sen az · sen alt, −cos az · sen alt, cos alt )
```

Con sensores, la base llega directamente de la orientación del teléfono (ver [[Sensores y realidad aumentada]]). El resto del código no distingue un caso del otro, y la inclinación lateral del teléfono queda resuelta sin trabajo adicional.

## Dos proyecciones
Para un astro con vector `v`, sus coordenadas de cámara son `x = v·R`, `y = v·U`, `z = v·F`.

| Modo | Proyección | Fórmula | Por qué |
|---|---|---|---|
| Manual y brújula | Estereográfica | `k = K / (1 + z)` | Conserva formas, admite más de 120° de campo |
| Cámara (RA) | Gnomónica | `k = K / z` | Es la proyección de una lente: calza con el video |

`pantalla = (cx + x·k, cy − y·k)`

`K` se calcula para que el campo elegido cubra el lado corto de la pantalla (estereográfica) o para que el campo de la cámara cubra el lado largo (gnomónica).

## El suelo: un círculo exacto
La proyección estereográfica convierte todo círculo de la esfera en un círculo del plano. El horizonte es un círculo, así que en pantalla también lo es.

1. Se proyectan tres puntos del horizonte.
2. Se calcula la circunferencia que pasa por los tres.
3. Se mira de qué lado cae el nadir: ese lado es el suelo.
4. Se rellena de un trazo, y se recorta con esa misma forma la rejilla del piso.

Si el radio resulta enorme (mirando justo al horizonte) se usa un semiplano. No hay polígonos aproximados ni bordes dentados.

## El domo holográfico
La rejilla verde es el sistema de coordenadas horizontales real: círculos de altura cada 10° y meridianos de azimut cada 15°. Bajo el horizonte continúa como piso. Reproduce la estética de las imágenes de referencia y a la vez enseña a leer «40° de altura hacia el sureste».

![[referencia-domo-2.jpg|360]] ![[app-cielo-movil.jpg|220]]

## Orden de dibujo
Fondo → Vía Láctea → domo → eclíptica y ecuador → constelaciones → estrellas → cielo profundo → puntero al polo sur → suelo → horizonte y puntos cardinales → Sol, Luna y planetas → mira y selección.

El suelo se dibuja después de las estrellas para tapar lo que está bajo el horizonte.

## Detalles que mejoran la lectura
- **Tamaño de estrella** según magnitud y **color** según índice B−V en siete tonos.
- **Luna** con su fase y con el limbo iluminado girado hacia donde está el Sol en pantalla.
- **Etiquetas sin encimarse**: cada rótulo reserva un rectángulo; el siguiente se omite si choca. Se dibujan primero los más importantes.
- **Magnitud límite automática**: al alejar se muestran menos estrellas; al acercar, hasta la 6,5.
- **Luz de día y de Luna**: con el Sol sobre −18° el cielo se tiñe y se apagan las estrellas débiles; con Luna alta se atenúa la Vía Láctea.

## Selección por toque
Durante el dibujo se guarda la posición en pantalla de cada objeto. Al tocar, gana el más cercano, con ventaja para Sol, Luna, planetas, cielo profundo y estrellas brillantes sobre las de fondo.

## Flecha guía
Si el objeto elegido queda fuera de pantalla, aparece una flecha en el borde con los grados que faltan. Con sensores, eso guía al visitante a girar el cuerpo.

## Modo Cosmos
Proyección ortográfica inclinada con zoom logarítmico. El plano de referencia rota de la eclíptica (escala planetaria) al plano galáctico (escala de la galaxia) mediante una rotación de eje y ángulo interpolada, y el centro de la vista se desplaza hacia el centro galáctico al alejarse. Ver `cosmos.js`.
