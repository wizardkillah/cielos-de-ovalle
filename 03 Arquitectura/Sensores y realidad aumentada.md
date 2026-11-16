---
tags: [arquitectura, pendiente]
---
# Sensores y realidad aumentada

> [!warning] Estado
> La matemática está probada con eventos simulados (teléfono vertical al sur, inclinado 40°, girado al oeste). **No se ha probado en teléfonos reales**: no se puede hacer desde un computador. Es la primera tarea de la [[Hoja de ruta]].

## Requisitos del navegador
| Función | Necesita | Si falta |
|---|---|---|
| Orientación (`DeviceOrientationEvent`) | Página en **https**; en iPhone, permiso tras un toque | Mensaje y modo manual |
| Cámara (`getUserMedia`) | https y permiso | Mensaje; sigue la brújula sin video |
| GPS (`geolocation`) | https y permiso | Lugares predefinidos o coordenadas a mano |
| Pantalla encendida (`wakeLock`) | Navegadores recientes | Se ignora |

Abrir el archivo con doble clic (`file://`) sirve en un computador, pero en un teléfono **no habilita sensores ni cámara**. Hay que publicarla: [[Publicar la app]].

## De los ángulos del teléfono a la cámara virtual
El navegador entrega tres ángulos: `alpha` (giro sobre el eje vertical), `beta` (inclinación adelante-atrás) y `gamma` (inclinación lateral). La matriz de rotación del estándar W3C, con el mundo en X = este, Y = norte, Z = arriba, tiene por columnas los ejes del aparato:

```
X = ( cA·cG − sA·sB·sG,   cG·sA + cA·sB·sG,   −cB·sG )   derecha de la pantalla
Y = ( −cB·sA,             cA·cB,              sB     )   arriba de la pantalla
Z = ( cG·sA·sB + cA·sG,   sA·sG − cA·cG·sB,   cB·cG  )   sale de la pantalla
```

La cámara trasera mira en dirección `−Z`. Entonces `F = −Z`, `U = Y`, `R = F × U`.

Con la pantalla girada (apaisado) el «arriba» pasa a ser una mezcla de X e Y según `screen.orientation.angle`.

## Norte verdadero
| Plataforma | De dónde sale el norte |
|---|---|
| Android (Chrome) | Evento `deviceorientationabsolute`: `alpha` referido al norte |
| iPhone (Safari) | `webkitCompassHeading`; se usa `alpha = 360 − rumbo` |
| Otros | `alpha` relativo: la app avisa y pide alinear una estrella conocida |

## Suavizado
Los sensores vibran. Se aplica un filtro de paso bajo (18 % de la lectura nueva por evento) sobre los vectores `F` y `U`, y se re-ortonormaliza. Filtrar vectores evita el salto de 359° a 0° que aparece al filtrar ángulos.

## Calibración
- **Arrastrar hacia los lados** con la brújula activa gira el mapa: se alinea una estrella conocida con la real y el ajuste queda guardado.
- **Capas → Ajuste de brújula** permite fijar el valor a mano.
- **Capas → Campo de la cámara** (40°–90°): cada teléfono tiene una lente distinta. Valor inicial 62°.

La **declinación magnética** (diferencia entre el norte de la brújula y el norte verdadero) es pequeña en la zona central de Chile y hoy queda absorbida por ese ajuste. Falta calcularla con un modelo geomagnético ([[Hoja de ruta]]).

## Fuentes de error en terreno
- Estructuras metálicas, autos, cúpulas y el propio telescopio desvían la brújula varios grados.
- Los teléfonos sin giroscopio (gama baja) entregan orientación ruidosa.
- En iPhone el rumbo pierde precisión con el teléfono muy vertical.

Un error de 5° a 10° es normal. Por eso las etiquetas son grandes y la app ofrece siempre el modo manual.

## Lista de prueba en terreno
- [ ] Android: activar brújula, apuntar al sur. ¿El rótulo dice «S»? ¿La Cruz del Sur o Canopus coinciden?
- [ ] Android: inclinar a 45°. ¿El rótulo marca cerca de 45°?
- [ ] Android: girar el teléfono a apaisado. ¿El horizonte sigue horizontal?
- [ ] iPhone: aparece el permiso de «Movimiento y orientación» al pulsar el botón.
- [ ] iPhone: repetir las tres pruebas anteriores.
- [ ] Cámara: ¿el horizonte dibujado calza con el real? Ajustar el campo hasta que dos estrellas separadas calcen a la vez.
- [ ] Anotar modelo de teléfono, campo de cámara y ajuste de brújula resultantes.
- [ ] 20 minutos de uso continuo: temperatura y batería.

![[app-realidad-aumentada.jpg|240]]
*Simulación: cámara encendida, teléfono al sur a 35°, Saturno seleccionado fuera de campo (flecha y 86°).*
