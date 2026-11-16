#!/usr/bin/env python3
"""Contrasta las coordenadas de src/content.js con el catálogo de d3-celestial.
Uso: python3 tools/check_dsos.py <carpeta_datos>"""
import json, re, sys, math
from pathlib import Path
ref = {f["id"].replace(" ", ""): f["geometry"]["coordinates"] for f in json.loads((Path(sys.argv[1]) / "dsos.6.json").read_text())["features"]}
for extra in ("dsos.bright.json", "dsos.14.json"):
    if (Path(sys.argv[1]) / extra).exists():
        ref.update({f["id"].replace(" ", ""): f["geometry"]["coordinates"] for f in json.loads((Path(sys.argv[1]) / extra).read_text())["features"]})
src = Path(__file__).parent.parent.joinpath("src/content.js").read_text(encoding="utf-8")
bad = 0
def sep(ra, dec, lon, lat):
    return math.degrees(math.acos(min(1, math.sin(math.radians(dec)) * math.sin(math.radians(lat)) +
        math.cos(math.radians(dec)) * math.cos(math.radians(lat)) * math.cos(math.radians(ra - lon)))))
for cat, ra, dec, size in re.findall(r"cat: '([^']+)'.*?ra: ([\d.\-]+), dec: ([\d.\-]+), mag: [\d.\-]+, size: ([\d.]+)", src):
    ra, dec, size = float(ra), float(dec), float(size)
    key = cat.replace(" ", "")
    if key in ref:
        name, d = cat, sep(ra, dec, ref[key][0] % 360, ref[key][1])
    else:  # sin la misma designación: el objeto catalogado más cercano
        name, d = min(((k, sep(ra, dec, v[0] % 360, v[1])) for k, v in ref.items()), key=lambda t: t[1])
    ok = d < max(0.3, size * 0.25)
    bad += not ok
    print(f"  {'ok   ' if ok else 'FALLA'} {cat:10s} dif {d:5.2f}°  (ref. {name})")
sys.exit(1 if bad else 0)
