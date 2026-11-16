---
tags: [proyecto, arquitectura]
---
# Decisiones de diseño

Cada decisión con su motivo y su costo, para poder revisarla más adelante.

## D1 · Un solo archivo HTML, sin dependencias
**Motivo:** en un observatorio hay poca o ninguna señal. Un archivo se copia, se abre con doble clic, se sube a cualquier hosting y se guarda sin conexión. Los prototipos con Three.js por CDN quedaban en negro sin internet.
**Costo:** el código se escribe en módulos separados y se une con `build.py`; no hay empaquetador ni TypeScript.

## D2 · Canvas 2D en vez de WebGL
**Motivo:** el producto es un mapa del cielo: puntos, líneas y texto. Canvas 2D dibuja 5.000 estrellas a 60 cuadros por segundo en teléfonos modestos, sin sombreadores ni contexto que se pierda.
**Costo:** no hay planetas texturizados en 3D. Se priorizó que las posiciones fueran correctas.

## D3 · Proyección estereográfica (gnomónica con cámara)
**Motivo:** conserva las formas de las constelaciones y permite campos de más de 120°. Además convierte los círculos de la esfera en círculos, lo que permite rellenar el suelo de forma exacta. Con la cámara encendida se usa la gnomónica, que es la de una lente.
**Detalle:** [[Proyección y cámara]].

## D4 · Elementos keplerianos del JPL en vez de VSOP87
**Motivo:** la tabla de Standish cabe en 8 líneas y da 0,08° o mejor entre 1800 y 2050. VSOP87 completo son miles de términos para una mejora que el ojo no distingue.
**Costo:** fuera de 1800–2050 el error crece. Está documentado en [[Motor astronómico]].

## D5 · Luna con 68 términos de Meeus y paralaje
**Motivo:** la Luna es lo más cercano y lo que más se nota si está mal. La paralaje llega a 1°: dos diámetros lunares.

## D6 · Catálogo estelar de d3-celestial
**Motivo:** datos abiertos (BSD-3), derivados de Hipparcos, ya con nombres en español y figuras de constelaciones. Se compactan a 142 kB con `tools/build_catalog.py`.

## D7 · Sin servidor, sin cuentas, sin analítica
**Motivo:** nada que mantener ni pagar, nada que falle a las 23:00 en un cerro, ningún dato personal. Las preferencias se guardan en el propio teléfono.

## D8 · Sensores como mejora opcional
**Motivo:** la brújula de los teléfonos falla cerca de metal y exige https. La app debe servir igual arrastrando con el dedo.

## D9 · Nombres indígenas con atribución y cautela
**Motivo:** hay mucha información de baja calidad circulando. Solo se incluyen nombres con respaldo, atribuidos a su cultura, y marcados para validación local. Ver [[Nombres y saberes del cielo]].

## D10 · Cosmos: real donde se puede, esquema donde no, y dicho en pantalla
**Motivo:** las posiciones de planetas, estrellas vecinas y galaxias son reales. Los brazos espirales y la nube de Oort son ilustrativos y la app lo indica.

## D11 · De día, mostrar igual las estrellas
**Motivo:** muchas visitas y clases ocurren de día. La app tiñe el cielo de azul, avisa y ofrece «ir al anochecer».

## D12 · Tipografía y color
Atkinson Hyperlegible para el texto (diseñada para baja visión; se lee bien a oscuras) y Chakra Petch para rótulos. Verde agua para la estructura, ámbar para la acción principal. Si no hay conexión se usan las fuentes del sistema.

## D13 · Efectos ambientales: sí, pero separados de los datos
**Motivo:** el cielo real centellea y se mueve; un mapa quieto se siente como una lámina. La versión 1.1 agrega centelleo, entrada, inercia y estrellas fugaces para que mirar la pantalla se parezca a mirar hacia arriba.
**Límites:** ningún efecto mueve una estrella ni un planeta de su posición calculada. Las estrellas fugaces son decorativas, se llaman así en la capa que las controla y no aparecen con la brújula ni la cámara, donde alguien podría buscarlas en el cielo real. Todo se apaga con una capa y con el ajuste «reducir movimiento» del sistema.
**Costo:** unos 18 kB más. El dibujo sigue en torno a 2 ms por cuadro en un portátil.
