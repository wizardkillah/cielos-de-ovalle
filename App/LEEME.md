---
tags: [app]
---
# App — LEEME

## Usarla
Abre **[cielos-de-ovalle.html](cielos-de-ovalle.html)** en cualquier navegador reciente (Chrome, Edge, Safari, Firefox). No necesita instalación ni conexión.

Para que funcionen la brújula, la cámara y el GPS en un teléfono hay que publicarla en https: [[Publicar la app]].

## Qué hay en esta carpeta

| Archivo | Qué es |
|---|---|
| `cielos-de-ovalle.html` | La aplicación completa en un solo archivo (342 kB) |
| `manifest.webmanifest`, `sw.js`, `icono.svg` | Para instalarla como app y usarla sin conexión una vez publicada |
| `fuente/src/` | Código fuente por módulos ([[Arquitectura]]) |
| `fuente/build.py` | Une `src/` en el HTML final |
| `fuente/tests/` | Pruebas del motor y de la app ([[Precisión y pruebas]]) |
| `fuente/tools/` | Generación del catálogo, verificación de coordenadas, calendario y fichas de la bóveda |
| `fuente/pwa/` | Originales del manifiesto, el service worker y el icono |
| `fuente/LICENCIA-d3-celestial.txt` | Licencia de los datos estelares |

## Modificarla

```bash
cd fuente
# editar src/content.js (fichas), src/i18n.js (textos), src/style.css (aspecto)…
python3 build.py                              # genera dist/cielos-de-ovalle.html
node tests/test_astro.js                      # 45 comprobaciones del motor
python3 tests/smoke.py                        # 21 comprobaciones en navegador
cp dist/cielos-de-ovalle.html ..              # reemplaza la app de la bóveda
```

Requisitos para desarrollar: Python 3, Node.js y, solo para las pruebas, `pip install ephem playwright` más `playwright install chromium`. Para **usar** la app no hace falta nada de esto.

## Cambios frecuentes
- **Agregar un objeto o un lugar**: [[Catálogo y datos]].
- **Cambiar el lugar por defecto**: el primer elemento de `sites` en `src/content.js`.
- **Cambiar el nombre**: `brand` en `src/i18n.js`, el `<title>` y la marca en `src/index.html`, y `manifest.webmanifest`.
- **Cambiar colores**: variables al comienzo de `src/style.css`.

## Compatibilidad
Escrita en JavaScript clásico, sin funciones recientes, para que funcione en teléfonos de varios años. Probada automáticamente en Chromium. Falta abrirla en Safari y Firefox, y probar sensores en teléfonos reales ([[Hoja de ruta]]).

## Licencia y créditos
- Código y textos: de este proyecto.
- Catálogo estelar y figuras: d3-celestial, © 2015 Olaf Frohn, BSD-3-Clause.
- Algoritmos: J. Meeus, *Astronomical Algorithms*; E. M. Standish (JPL), elementos keplerianos aproximados.
- Tipografías (opcionales, se cargan si hay conexión): Atkinson Hyperlegible y Chakra Petch, SIL Open Font License.
