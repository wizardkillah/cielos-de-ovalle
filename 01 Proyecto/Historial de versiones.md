---
tags: [proyecto]
---
# Historial de versiones

## Prototipos (archivados en `99 Archivo/Prototipos anteriores`)

| # | Archivo | Qué aportó | Por qué no siguió |
|---|---|---|---|
| 1 | `star-map.html` | Primer mapa 2D con coordenadas Az/Alt y AR/Dec | ~90 estrellas a mano; sin Sol, Luna ni planetas; solo ratón |
| 2 | `stellarium-pro.html` | Sol, Luna, planetas, control de tiempo, eventos del día | Luna mal calculada (hasta 74°); recalculaba salidas y puestas en cada cuadro; horas en UTC |
| 3 | `solar-system-3d.html` | Estética holográfica de las imágenes de referencia; Three.js | Dependía de un CDN; etiquetas que no seguían a los planetas |
| 4 | `milkyway-3d.html` | Idea de las cinco escalas hasta el Grupo Local | Órbitas con elementos inventados; la primera entrega no arrancaba |
| 5 | `solar-system-hd.html` | Texturas procedurales de planetas | Mismas órbitas inventadas; la Luna modelada como planeta |
| 6 | `observatorio-app.html` | Enfoque correcto: móvil, bilingüe, «¿qué estoy mirando?» | No usaba sensores; 13 estrellas; errores de contenido |

El detalle está en [[Auditoría general]] y [[Bugs encontrados]].

## Versión 1.0 — 16 de noviembre de 2026

Reescritura completa que une lo mejor de los seis prototipos sobre una sola base.

**Nuevo**
- Motor astronómico único, con pruebas automáticas contra PyEphem.
- Catálogo real de 5.044 estrellas y 88 constelaciones con nombres en español.
- 31 objetos de cielo profundo y 22 estrellas con ficha bilingüe.
- Modo «seguir el teléfono» y cámara, con calibración de brújula.
- Puntero de la Cruz del Sur al polo sur celeste.
- «Esta noche», buscador, salto al anochecer, luz roja.
- Modo Cosmos con zoom continuo y marco que pasa de la eclíptica al plano galáctico.
- Funciona sin conexión; archivos para instalarla como PWA.

**Corregido**: todos los puntos de [[Bugs encontrados]] y [[Correcciones de contenido]].

**Retirado**: texturas procedurales de planetas y Three.js. Motivo en [[Decisiones de diseño]].

## Versión 1.1 — 16 de noviembre de 2026

Movimiento e interacción. No cambia el motor astronómico ni el contenido.

**Cielo**
- Entrada: las estrellas se encienden de la más brillante a la más tenue mientras la cámara baja a su posición.
- Centelleo (más marcado cerca del horizonte), halo en más estrellas y destellos en las más brillantes.
- Resplandor sobre el horizonte y arco cálido hacia el Sol durante el crepúsculo.
- Estrellas fugaces ocasionales, decorativas. Nunca aparecen con la brújula o la cámara activas.
- Al elegir una estrella o constelación, su figura se dibuja resaltada y un anillo se cierra sobre el objeto.
- «Llévame» abre la vista a mitad del vuelo y la cierra al llegar; la duración depende de la distancia.

**Interacción**
- Inercia al soltar el arrastre, en Cielo y en Cosmos.
- Zoom suave; con la rueda, el punto bajo el cursor queda fijo.
- Doble toque: acerca hacia ese punto (y vuelve a la vista amplia si ya estaba cerca).
- Con ratón: anillo y nombre del objeto bajo el cursor.
- En teléfono: la ficha se cierra deslizándola hacia abajo; vibración breve al elegir un objeto.
- Onda en el punto tocado; respuesta visual en todos los botones; las fichas entran en cascada.

**Cosmos**
- Giro lento cuando no se toca nada y estelas radiales mientras cambia la escala.
- Transición al pasar de Cielo a Cosmos y de vuelta.

**Otros**
- Capa nueva «Centelleo y estrellas fugaces (decorativo)» para apagar los efectos.
- Se respeta el ajuste «reducir movimiento» del sistema: sin animaciones.
- Corregido: en pantallas de unos 1.000 px de ancho, los botones de zoom tapaban «Capas» y la última parada de Cosmos.
- `build.py` genera el mismo archivo en Windows, macOS y Linux.

**Verificación**: 45 comprobaciones del motor en verde. La app se revisó a mano en Chromium (escritorio y 375 px). `tests/smoke.py` **no se ejecutó** en esta versión: falta instalar Playwright en este equipo.

Motivos en [[Decisiones de diseño]] (D13).

## Convención para lo que viene
`mayor.menor.parche`. Al publicar una versión nueva hay que subir también el nombre de caché en `sw.js` (ver [[Publicar la app]]).
