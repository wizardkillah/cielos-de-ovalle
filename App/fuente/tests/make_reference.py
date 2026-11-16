#!/usr/bin/env python3
"""Genera tests/reference.json con PyEphem (VSOP87 + teoría lunar completa).
Uso: pip install ephem && python3 tests/make_reference.py"""
import ephem, json, math, random
random.seed(7)
LAT, LON = -30.6033, -71.2003
bodies = {'sun': ephem.Sun, 'moon': ephem.Moon, 'mercury': ephem.Mercury, 'venus': ephem.Venus,
          'mars': ephem.Mars, 'jupiter': ephem.Jupiter, 'saturn': ephem.Saturn,
          'uranus': ephem.Uranus, 'neptune': ephem.Neptune}
cases = []
for i in range(240):
    d = ephem.Date('2024/1/1') + random.uniform(0, 365.25 * 12)   # 2024–2035
    obs = ephem.Observer(); obs.lat = str(LAT); obs.lon = str(LON); obs.elevation = 0
    obs.pressure = 0; obs.date = d
    row = {'unix_ms': (float(d) - float(ephem.Date('1970/1/1'))) * 86400000, 'b': {}}
    for name, cls in bodies.items():
        b = cls(); b.compute(d)
        g = [math.degrees(b.g_ra), math.degrees(b.g_dec)]
        b.compute(obs)
        row['b'][name] = g + [math.degrees(b.az), math.degrees(b.alt)]
    # Estrella fija: Sirio J2000
    s = ephem.FixedBody(); s._ra = ephem.hours('6:45:08.92'); s._dec = ephem.degrees('-16:42:58.0'); s._epoch = ephem.J2000
    s.compute(obs); row['sirius'] = [math.degrees(s.az), math.degrees(s.alt)]
    cases.append(row)
# Salidas y puestas del Sol y la Luna en Ovalle
rs = []
for ds in ['2026/11/16 12:00', '2027/2/6 12:00', '2027/6/21 12:00', '2028/9/1 12:00']:
    obs = ephem.Observer(); obs.lat = str(LAT); obs.lon = str(LON); obs.elevation = 0
    obs.pressure = 0; obs.horizon = '-0:34'; obs.date = ds  # −0:34 + semidiámetro (limbo superior) = −0.83°
    ms = lambda d: (float(d) - float(ephem.Date('1970/1/1'))) * 86400000
    rs.append({'from_ms': ms(obs.date), 'sunset': ms(obs.next_setting(ephem.Sun())),
               'sunrise': ms(obs.next_rising(ephem.Sun())), 'moonrise': ms(obs.next_rising(ephem.Moon())),
               'full': ms(ephem.next_full_moon(ds)), 'new': ms(ephem.next_new_moon(ds))})
json.dump({'lat': LAT, 'lon': LON, 'cases': cases, 'riseset': rs}, open('tests/reference.json', 'w'))
print(len(cases), 'casos')
