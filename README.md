# Cielos de Ovalle

Mapa del cielo en tiempo real para quien visita un observatorio del Limarí (Región de Coquimbo, Chile) y quiere saber **qué está mirando**. Un solo archivo HTML de 342 kB, sin dependencias, sin servidor y sin conexión; en español e inglés.

![Cielo austral con el puntero de la Cruz del Sur al polo sur celeste](docs/99%20Archivo/Adjuntos/app-polo-sur.jpg)

## Qué hace

- **Cielo**: 5.044 estrellas de catálogo, 88 constelaciones, 31 objetos de cielo profundo, Sol, Luna y 7 planetas en su posición real para el lugar y la hora.
- **«¿Qué estoy mirando?»**: identifica lo que hay en la mira; con la brújula y la cámara del teléfono, el mapa sigue hacia donde apuntas.
- **Esta noche**: puesta del Sol, cielo oscuro, fase de la Luna, qué está arriba ahora y un buscador.
- **Cosmos**: zoom continuo desde los planetas interiores hasta el Grupo Local.
- **Para terreno**: luz roja, funciona sin señal, instalable como PWA.

## Cómo está hecho

| Parte | Detalle |
|---|---|
| Motor astronómico | `astro.js`, sin DOM. Meeus (Luna con 68 términos y paralaje) y elementos keplerianos del JPL. Contrastado con PyEphem en 240 fechas: error máximo 0,08° |
| Dibujo | Canvas 2D, proyección estereográfica (gnomónica con cámara). Unos 2 ms por cuadro |
| Datos | Catálogo de d3-celestial (BSD-3, derivado de Hipparcos) compactado a 142 kB |
| Construcción | `build.py` une los módulos de `App/fuente/src/` en un único HTML |
| Pruebas | 45 comprobaciones del motor en Node; prueba de humo en Chromium con Playwright |

JavaScript clásico sin librerías ni empaquetador, para que abra en teléfonos de varios años y con doble clic desde una carpeta.

## Usarla

Abre `App/cielos-de-ovalle.html` en cualquier navegador. La brújula, la cámara y el GPS necesitan que esté publicada en `https` (ver `docs/04 Guías/Publicar la app.md`).

## Desarrollar

```bash
cd App/fuente
python build.py                          # genera dist/cielos-de-ovalle.html
node tests/test_astro.js                 # motor contra efemérides de referencia
python tests/smoke.py                    # app en Chromium (pip install playwright ephem)
cp dist/cielos-de-ovalle.html ..         # reemplaza la app publicada
```

## Documentación

La carpeta `docs/` es una bóveda de Obsidian (ábrela como bóveda y empieza por `Inicio.md`), pero son archivos Markdown que también se leen directo en GitHub.

| Carpeta | Contenido |
|---|---|
| `docs/01 Proyecto` | Visión, decisiones de diseño con su motivo y su costo, hoja de ruta, historial |
| `docs/02 Auditoría` | Revisión de los seis prototipos anteriores y los errores encontrados |
| `docs/03 Arquitectura` | Motor, proyección, sensores, catálogo, precisión y pruebas |
| `docs/04 Guías` | Uso, publicación y guion para guías de observatorio |
| `docs/05 Cielo austral` | Calendario 2026–2027, cielo por estaciones, 62 fichas de objetos |
| `docs/99 Archivo` | Prototipos anteriores y capturas |
| `App/` | La aplicación y su código fuente |
| `Android/` | Envoltorio Android (Capacitor) |

## Estado

Versión 1.1. Pendiente antes de usarla con público: publicarla en `https` y probar brújula y cámara en teléfonos reales. Detalle en `docs/01 Proyecto/Hoja de ruta.md`.

## Autor y licencia

Diseño, motor astronómico, aplicación y contenido: **Francois Rojo**.

El código y el contenido propios se publican con licencia MIT (ver [`LICENSE`](LICENSE)). Los datos y las tipografías de terceros mantienen sus propias licencias, indicadas abajo.

## Créditos

- Catálogo estelar y figuras: d3-celestial, © 2015 Olaf Frohn, BSD-3-Clause (`App/fuente/LICENCIA-d3-celestial.txt`).
- Algoritmos: J. Meeus, *Astronomical Algorithms*; E. M. Standish (JPL).
- Tipografías opcionales: Atkinson Hyperlegible y Chakra Petch, SIL Open Font License.
