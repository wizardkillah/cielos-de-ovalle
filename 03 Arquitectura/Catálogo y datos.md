---
tags: [arquitectura, datos]
---
# Catálogo y datos

## Qué datos lleva la app

| Conjunto | Cantidad | Origen | Archivo |
|---|---|---|---|
| Estrellas | 5.044, hasta magnitud 6 | d3-celestial `stars.6.json` (derivado de Hipparcos / Yale BSC) | `src/data.js` |
| Nombres de estrellas | 932 (propios en ES/EN y designación Bayer) | d3-celestial `starnames.json` | `src/data.js` |
| Figuras de constelaciones | 88 | d3-celestial `constellations.lines.json` | `src/data.js` |
| Nombres de constelaciones | 88, en español e inglés | d3-celestial `constellations.json` | `src/data.js` |
| Cielo profundo | 31 objetos elegidos para el cielo austral | Selección propia, coordenadas contrastadas | `src/content.js` |
| Estrellas con ficha | 22 | Redacción propia | `src/content.js` |
| Sol, Luna, planetas | 9 fichas | Redacción propia | `src/content.js` |
| Lugares | 10 | Coordenadas aproximadas (±0,05°) | `src/content.js` |
| Estrellas vecinas y galaxias (Cosmos) | 27 + 4 | Posición y distancia de referencia | `src/content.js` |

## Licencia de los datos
d3-celestial, © 2015 Olaf Frohn, licencia **BSD de 3 cláusulas**. Permite uso y redistribución conservando el aviso. El texto está en `App/fuente/LICENCIA-d3-celestial.txt` y el crédito va en la cabecera de `data.js`.

## Formato compacto
`CATALOG.stars` es una lista plana de enteros, cuatro por estrella, ordenada de más a menos brillante:

```
[ AR×1000, Dec×1000, magnitud×100, (B−V)×100,  AR×1000, Dec×1000, ... ]
```

`CATALOG.names[i] = [nombre, nombre_es, "α CMa"]` · `CATALOG.lines[abreviatura] = [[[AR, Dec], …], …]` · `CATALOG.cons[abreviatura] = [en, es, AR, Dec, rango]` · `CATALOG.special` = índices de las estrellas con ficha.

142 kB en total. Que estén ordenadas por brillo permite cortar el dibujo con un `break`.

## Regenerar el catálogo

```bash
mkdir datos && cd datos
for f in stars.6 starnames constellations.lines constellations dsos.6 dsos.14 dsos.bright; do
  curl -LO https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/$f.json
done
cd ..
python3 tools/build_catalog.py datos src/data.js
python3 tools/check_dsos.py datos        # las 31 coordenadas deben dar «ok»
python3 build.py
```

Para más o menos estrellas basta cambiar el archivo de origen (`stars.8.json` llega a magnitud 8, unas 41.000 estrellas y cerca de 1 MB).

## Agregar un objeto de cielo profundo
En `src/content.js`, dentro de `dsos`:

```js
{ id: 'm11', cat: 'M 11', type: 'cluster', ra: 282.77, dec: -6.27, mag: 5.8, size: 0.23,
  tool: 'bino', dist: '6.200', prio: 4,
  name: { es: 'Cúmulo del Pato Salvaje', en: 'Wild Duck Cluster' },
  d: { es: '…', en: '…' },      // qué es, en una o dos frases
  f: { es: '…', en: '…' },      // dato curioso verificable
  find: { es: '…', en: '…' },   // opcional: cómo encontrarlo
  cult: { es: '…', en: '…' } }  // opcional: otros nombres
```

- `type`: `galaxy`, `nebula`, `cluster`, `globular`, `dark`, `center`.
- `tool`: `eye`, `bino`, `scope`.
- `prio`: de 1 a 10. Desde 7 aparece rotulado en vista amplia y cuenta para «¿qué estoy mirando?».
- `ra`, `dec`: grados, J2000. `size`: diámetro aparente en grados.

Después: `python3 tools/check_dsos.py datos`, `python3 build.py` y, para la bóveda, `python3 tools/build_vault_objects.py`.

## Agregar un lugar
En `sites` de `content.js`: `{ id, name, lat, lon, note: { es, en } }`. La hora local se muestra en horario de Chile cuando el lugar está dentro del país; en otro caso, en la zona del dispositivo.

## Datos que caducan
- **Número de lunas** de los planetas gigantes (redactado como «más de…»).
- **Distancia de las sondas Voyager** (se calcula con una recta desde 2024; aproximada).
- **Regla del cambio de hora en Chile**: la toma el navegador del sistema operativo, no la app.

Fichas generadas a partir de estos datos: [[Índice de objetos]].
