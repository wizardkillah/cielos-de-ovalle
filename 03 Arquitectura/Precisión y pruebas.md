---
tags: [arquitectura, pruebas]
fecha: 2026-11-16
---
# Precisión y pruebas

## Referencia
**PyEphem 4.2**: teoría planetaria VSOP87 y teoría lunar completa. `tests/make_reference.py` genera 240 instantes al azar entre 2024 y 2035, vistos desde Ovalle (30,6033° S, 71,2003° O), y los guarda en `tests/reference.json`.

## Motor: error máximo en 240 fechas

| Cuerpo | Geocéntrico (AR/Dec) | Horizontal (Az/Alt, Ovalle) | Límite de la prueba |
|---|---|---|---|
| Sol | 0,012° | 0,013° | 0,02° |
| Luna | 0,011° | 0,012° | 0,05° |
| Mercurio | 0,016° | 0,018° | 0,05° |
| Venus | 0,031° | 0,036° | 0,05° |
| Marte | 0,034° | 0,029° | 0,08° |
| Júpiter | 0,076° | 0,075° | 0,20° |
| Saturno | 0,079° | 0,078° | 0,25° |
| Urano | 0,024° | 0,023° | 0,20° |
| Neptuno | 0,018° | 0,017° | 0,20° |
| Estrella fija (Sirio, con precesión) | — | 0,007° | 0,02° |

El diámetro de la Luna llena es 0,5°. El peor caso (Saturno, 0,08°) es un sexto de ese diámetro: indistinguible a simple vista o con el teléfono.

## Sucesos, en cuatro fechas

| Suceso | Diferencia máxima |
|---|---|
| Puesta del Sol | 4 segundos |
| Salida del Sol | 2 segundos |
| Salida de la Luna | 7 segundos |
| Luna llena | 1,4 minutos |
| Luna nueva | 0,9 minutos |

## Comprobación independiente: eclipse del 6 de febrero de 2027
Eclipse parcial de Sol visto desde Ovalle.

| | PyEphem | Motor propio |
|---|---|---|
| Máximo (hora local) | 12:06 | 12:07 |
| Magnitud | 0,62 | 0,62 |

Un eclipse exige que Sol y Luna, con paralaje incluida, calcen dentro de una fracción de grado: es una buena prueba de conjunto.

## Geometría y catálogo
| Comprobación | Resultado |
|---|---|
| Centro galáctico (AR 266,405°, Dec −28,936°) | 0,0002° |
| Polo norte galáctico | 0,0005° |
| Refracción en el horizonte (≈0,48°) | 0,003° de diferencia |
| Estrellas en el catálogo | 5.044 |
| Sirio es la primera (la más brillante) | sí |
| Segmentos de constelación válidos | todos |
| Coordenadas de los 31 objetos de cielo profundo frente a catálogo | 31 de 31 dentro de tolerancia |

## App en navegador (`tests/smoke.py`)
Chromium sin interfaz, en 390×844 (teléfono) y 1280×800 (escritorio):

- la bienvenida aparece en el primer uso;
- el cielo dibuja estrellas;
- «¿Qué estoy mirando?» abre una ficha;
- «Esta noche» lista 24 objetos;
- el buscador encuentra «cruz» y abre Saturno;
- «Llévame» deja el objeto a 0,01° del centro;
- cambio a inglés;
- Cosmos recorre las ocho escalas hasta el Grupo Local;
- sensores simulados: vertical al sur → az 180°, alt 0°; inclinado 40° → alt 40°; `alpha` 90° → oeste;
- sin errores de JavaScript en consola.

**Total: 45 comprobaciones del motor y 21 en navegador, todas en verde.**

## Lo que las pruebas no cubren
- Sensores y cámara en teléfonos reales ([[Sensores y realidad aumentada]]).
- Safari y Firefox: la prueba automática usa solo Chromium. El código evita funciones recientes, pero falta abrirla en esos navegadores.
- Rendimiento en teléfonos de gama baja.
- Fechas fuera de 1800–2050.

## Cómo repetirlas

```bash
cd App/fuente
pip install ephem playwright && playwright install chromium
python3 tests/make_reference.py      # opcional: regenera la referencia
node tests/test_astro.js
python3 build.py && python3 tests/smoke.py capturas/
```

`test_astro.js` termina con código distinto de cero si algo supera su límite: sirve para integración continua.
