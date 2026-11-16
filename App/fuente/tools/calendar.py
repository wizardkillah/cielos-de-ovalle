#!/usr/bin/env python3
"""Calendario astronómico para Ovalle calculado con PyEphem.
Uso: python3 tools/calendar.py 2026/11/16 2027/12/31"""
import ephem, math, sys
from datetime import timedelta
LAT, LON = '-30.6033', '-71.2003'
start, end = ephem.Date(sys.argv[1]), ephem.Date(sys.argv[2])
def obs(d):
    o = ephem.Observer(); o.lat, o.lon, o.elevation, o.pressure = LAT, LON, 220, 0; o.date = d; return o
def local(d):   # Chile continental: UTC−3 de septiembre a abril, UTC−4 en invierno (aprox. 1er sábado abril–1er sábado sept.)
    dt = ephem.Date(d).datetime()
    winter = (dt.month, dt.day) >= (4, 4) and (dt.month, dt.day) < (9, 5)
    return (dt - timedelta(hours=4 if winter else 3)).strftime('%Y-%m-%d %H:%M') + (' (UTC−4)' if winter else ' (UTC−3)')
print('## FASES')
d = start
while d < end:
    n = ephem.next_new_moon(d); f = ephem.next_full_moon(d)
    for t, name in sorted([(n, 'Luna nueva'), (f, 'Luna llena')]):
        if t < end: print(name, local(t))
    d = ephem.Date(max(n, f) + 1)
print('## ESTACIONES')
d = start
while d < end:
    for fn, nm in [(ephem.next_solstice, 'Solsticio'), (ephem.next_equinox, 'Equinoccio')]:
        t = fn(d)
        if t < end: print(nm, local(t))
    d = ephem.Date(d + 185)
print('## OPOSICIONES / ELONGACIONES')
for cls in (ephem.Mars, ephem.Jupiter, ephem.Saturn, ephem.Uranus, ephem.Neptune):
    t = start; hist = []
    while t < end:
        b = cls(); b.compute(t); hist.append((t, abs(math.degrees(b.elong)), b.mag, ephem.constellation(b)[1])); t = ephem.Date(t + 0.25)
    for i in range(1, len(hist) - 1):
        if hist[i][1] > 170 and hist[i][1] > hist[i - 1][1] and hist[i][1] >= hist[i + 1][1]:
            print('Oposición', cls().name, local(hist[i][0])[:10], 'mag %.1f' % hist[i][2], 'en', hist[i][3])
for cls in (ephem.Mercury, ephem.Venus):
    t = start; hist = []
    while t < end:
        b = cls(); b.compute(t); hist.append((t, math.degrees(b.elong))); t = ephem.Date(t + 0.5)
    for i in range(1, len(hist) - 1):
        a, c, n = abs(hist[i - 1][1]), abs(hist[i][1]), abs(hist[i + 1][1])
        if c > a and c >= n and c > 17:
            print('Máx. elongación', cls().name, local(hist[i][0]), '%.1f°' % c, 'vespertina (atardecer)' if hist[i][1] > 0 else 'matutina (amanecer)')
print('## ECLIPSES DE SOL EN OVALLE')
d = start
while d < end:
    n = ephem.next_new_moon(d); best = (9, None)
    t = n - 0.25
    while t < n + 0.25:
        o = obs(t); s = ephem.Sun(o); m = ephem.Moon(o)
        sep = math.degrees(ephem.separation(s, m))
        if sep < best[0]: best = (sep, t, math.degrees(s.radius), math.degrees(m.radius), math.degrees(s.alt))
        t += 1 / 1440
    sep, t, rs, rm, alt = best
    if sep < rs + rm and alt > 0:
        # fracción de área cubierta
        if sep <= abs(rs - rm): obsc = min(1, (rm / rs) ** 2)
        else:
            a1 = rs * rs * math.acos((sep * sep + rs * rs - rm * rm) / (2 * sep * rs)); a2 = rm * rm * math.acos((sep * sep + rm * rm - rs * rs) / (2 * sep * rm))
            a3 = 0.5 * math.sqrt((-sep + rs + rm) * (sep + rs - rm) * (sep - rs + rm) * (sep + rs + rm)); obsc = (a1 + a2 - a3) / (math.pi * rs * rs)
        mag = (rs + rm - sep) / (2 * rs)
        # contactos
        c1 = c4 = None; tt = t
        while True:
            tt -= 1 / 1440; o = obs(tt); s = ephem.Sun(o); m = ephem.Moon(o)
            if math.degrees(ephem.separation(s, m)) > math.degrees(s.radius + m.radius): c1 = tt; break
        tt = t
        while True:
            tt += 1 / 1440; o = obs(tt); s = ephem.Sun(o); m = ephem.Moon(o)
            if math.degrees(ephem.separation(s, m)) > math.degrees(s.radius + m.radius): c4 = tt; break
        print('Eclipse solar: máximo', local(t), 'magnitud %.2f' % mag, 'área cubierta %.0f%%' % (obsc * 100), 'altura Sol %.0f°' % alt, '| inicio', local(c1)[11:16], 'fin', local(c4)[11:16])
    d = ephem.Date(n + 1)
print('## ECLIPSES DE LUNA')
d = start
while d < end:
    f = ephem.next_full_moon(d); best = (9, None)
    t = f - 0.2
    while t < f + 0.2:
        s = ephem.Sun(t); m = ephem.Moon(t)
        anti = ephem.Equatorial((s.g_ra + math.pi) % (2 * math.pi), -s.g_dec, epoch=t)
        sep = math.degrees(ephem.separation((anti.ra, anti.dec), (m.g_ra, m.g_dec)))
        if sep < best[0]:
            pm = math.degrees(math.asin(6378.14 / (m.earth_distance * 149597870.7))); ps = 8.794 / 3600 / s.earth_distance
            rs = math.degrees(s.radius); rm = math.degrees(m.radius)
            best = (sep, t, 1.02 * (0.99834 * pm - rs + ps), 1.02 * (0.99834 * pm + rs + ps), rm)
        t += 2 / 1440
    sep, t, u, pen, rm = best
    if sep < pen + rm:
        o = obs(t); m = ephem.Moon(o)
        umag = (u + rm - sep) / (2 * rm); pmag = (pen + rm - sep) / (2 * rm)
        kind = 'total' if umag >= 1 else 'parcial' if umag > 0 else 'penumbral'
        print('Eclipse lunar', kind, local(t), 'mag. umbral %.2f' % umag, 'mag. penumbral %.2f' % pmag, 'altura Luna en Ovalle %.0f°' % math.degrees(m.alt))
    d = ephem.Date(f + 1)
print('## LLUVIAS DE METEOROS (iluminación lunar en el máximo)')
for name, date in [('Gemínidas', '2026/12/14'), ('Líridas', '2027/4/22'), ('Eta Acuáridas', '2027/5/6'), ('Delta Acuáridas del Sur', '2027/7/30'),
                   ('Oriónidas', '2027/10/21'), ('Leónidas', '2027/11/17'), ('Gemínidas', '2027/12/14')]:
    m = ephem.Moon(ephem.Date(date) + 0.25); print(name, date, 'Luna %.0f%%' % m.phase)
print('## ESTA NOCHE', sys.argv[1])
o = obs(ephem.Date(sys.argv[1]) + 0.5); o.horizon = '-0:34'
print('puesta Sol', local(o.next_setting(ephem.Sun())))
o.horizon = '-18'; print('fin crepúsculo astronómico', local(o.next_setting(ephem.Sun(), use_center=True)))
