---
tags: [cielo, calendario]
calculado: 2026-11-16
---
# Calendario astronómico 2026–2027

Calculado para Ovalle con PyEphem (`App/fuente/tools/calendar.py`). Horas en **hora oficial de Chile continental**, suponiendo la regla vigente: UTC−3 de septiembre a abril y UTC−4 en invierno. Si la regla del cambio de hora se modifica, las horas de invierno se corren una hora.

## Lo imperdible

> [!important] 6 de febrero de 2027 · Eclipse parcial de Sol
> Desde Ovalle la Luna cubre el **52 % del disco solar** (magnitud 0,62).
> Comienza 10:29 · máximo **12:06** · termina 13:51, con el Sol a 60° de altura.
> Es un eclipse anular cuya franja central cruza el sur de Chile y Argentina.
> **Solo se observa con filtros solares certificados (ISO 12312-2) o por proyección.** Buena ocasión para una actividad pública de día.

| Fecha | Suceso | Notas para Ovalle |
|---|---|---|
| 25 nov 2026 | Urano en oposición | Magnitud 5,6, en Tauro. Con binoculares |
| 14 dic 2026 | Lluvia de las Gemínidas | Luna al 22 %: buenas condiciones. Mejor después de medianoche |
| 21 dic 2026 | Solsticio de verano (17:49) | La noche más corta |
| 3 ene 2027 | Venus en máxima elongación matutina (47°) | «Lucero del amanecer» muy alto antes de la salida del Sol |
| **6 feb 2027** | **Eclipse parcial de Sol** | Ver arriba |
| 10 feb 2027 | Júpiter en oposición | Magnitud −2,4, en Leo. Visible toda la noche |
| 19 feb 2027 | Marte en oposición | Magnitud −1,1, en Leo, cerca de Júpiter |
| 20 feb 2027 | Eclipse penumbral de Luna | La Luna sale ya en el máximo (20:13): apenas perceptible |
| 17 mar 2027 | Mercurio en máxima elongación matutina (27,6°) | La mejor aparición del año al amanecer |
| 20 mar 2027 | Equinoccio de otoño (17:24) | |
| 6 may 2027 | Lluvia de las Eta Acuáridas | **Luna nueva**: condiciones ideales. Es la mejor lluvia para el hemisferio sur; mirar antes del amanecer |
| 21 jun 2027 | Solsticio de invierno (10:10) | La noche más larga; centro galáctico alto |
| 30 jul 2027 | Delta Acuáridas del Sur | Luna al 14 % |
| 2 ago 2027 | Eclipse total de Sol | **No visible desde Chile** (norte de África y sur de España) |
| 17 ago 2027 | Eclipse penumbral de Luna | Máximo 03:14, Luna a 51°. Oscurecimiento leve |
| 23 sep 2027 | Equinoccio de primavera (03:01) | |
| 24 sep 2027 | Mercurio en máxima elongación vespertina (26,3°) | La mejor aparición del año al atardecer |
| 28 sep 2027 | Neptuno en oposición | Magnitud 7,8. Telescopio |
| 17 oct 2027 | Saturno en oposición | En Piscis. Visible toda la noche, anillos abriéndose |
| 21 oct 2027 | Oriónidas | Luna al 67 %: regular |
| 30 nov 2027 | Urano en oposición | |
| 14 dic 2027 | Gemínidas | Luna llena: malas condiciones |
| 21 dic 2027 | Solsticio de verano (23:41) | |

Más adelante: eclipse parcial de Luna el **12 de enero de 2028** (máximo 01:12, visible) y eclipse parcial de Sol el **26 de enero de 2028** (11 % del disco, máximo 10:43).

## Fases de la Luna
Las mejores noches para la Vía Láctea, nebulosas y galaxias van desde unos cinco días antes hasta cinco días después de la Luna nueva.

| Luna nueva | Luna llena |
|---|---|
| — | 24 nov 2026 |
| 8 dic 2026 | 23 dic 2026 |
| 7 ene 2027 | 22 ene 2027 |
| 6 feb 2027 (eclipse) | 20 feb 2027 |
| 8 mar 2027 | 22 mar 2027 |
| 6 abr 2027 | 20 abr 2027 |
| 6 may 2027 | 20 may 2027 |
| 4 jun 2027 | 18 jun 2027 |
| 3 jul 2027 | 18 jul 2027 |
| 2 ago 2027 | 17 ago 2027 |
| 31 ago 2027 | 15 sep 2027 |
| 29 sep 2027 | 15 oct 2027 |
| 29 oct 2027 | 14 nov 2027 |
| 28 nov 2027 | 13 dic 2027 |
| 27 dic 2027 | |

## Planetas: panorama
- **Fin de 2026**: [[Saturno]] alto al anochecer. [[Venus]], [[Júpiter]] y [[Marte]] en el cielo de la madrugada.
- **Febrero–abril de 2027**: [[Júpiter]] y [[Marte]] juntos en Leo, visibles toda la noche. Es el gran momento planetario del período.
- **Mediados de 2027**: [[Venus]] baja cada mañana hasta perderse en el resplandor del Sol; [[Saturno]] reaparece de madrugada.
- **Octubre de 2027**: [[Saturno]] en oposición.

Para cualquier fecha exacta, usa *Fecha y hora* en la app.

## Lluvias de meteoros desde 30° S
| Lluvia | Máximo | Desde Ovalle |
|---|---|---|
| Eta Acuáridas | 5–6 may | Excelente: es mejor desde el sur |
| Delta Acuáridas del Sur | 29–30 jul | Buena |
| Gemínidas | 13–14 dic | Buena, radiante bajo al norte |
| Oriónidas | 21–22 oct | Moderada |
| Leónidas | 17–18 nov | Débil en años normales |
| Perseidas, Cuadrántidas | ago, ene | Radiante bajo el horizonte o muy bajo: casi nada |

## Cómo recalcular
```bash
pip install ephem
python3 App/fuente/tools/calendar.py 2027/12/31 2028/12/31
```
