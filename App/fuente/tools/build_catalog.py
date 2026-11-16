#!/usr/bin/env python3
"""Genera src/data.js a partir de los datos abiertos de d3-celestial.

Entrada (carpeta con los JSON descargados de
https://github.com/ofrohn/d3-celestial/tree/master/data):
  stars.6.json, starnames.json, constellations.lines.json, constellations.json

Salida: src/data.js  (catálogo compacto, ~130 kB)

Uso:  python3 tools/build_catalog.py <carpeta_datos> src/data.js
"""
import json
import sys
from pathlib import Path

src = Path(sys.argv[1])
out = Path(sys.argv[2])


def load(name):
    return json.loads((src / name).read_text(encoding="utf-8"))


def ra360(lon):
    return lon % 360.0


stars = load("stars.6.json")["features"]
names = load("starnames.json")
lines = load("constellations.lines.json")["features"]
consts = load("constellations.json")["features"]

# Ordenadas por brillo: el dibujo puede cortar por magnitud con un simple "break".
stars.sort(key=lambda f: f["properties"]["mag"])

flat = []          # ra*1000, dec*1000, mag*100, bv*100  (enteros)
star_names = {}    # índice -> [nombre_en, nombre_es, bayer+const]
hip_index = {}
for i, f in enumerate(stars):
    lon, lat = f["geometry"]["coordinates"]
    p = f["properties"]
    try:
        bv = float(p.get("bv") or 0.6)
    except ValueError:
        bv = 0.6
    flat += [round(ra360(lon) * 1000), round(lat * 1000), round(p["mag"] * 100), round(bv * 100)]
    hip = str(f["id"])
    hip_index[hip] = i
    n = names.get(hip)
    if not n:
        continue
    proper = n.get("name") or ""
    bayer = n.get("bayer") or ""
    con = n.get("c") or ""
    desig = (bayer + " " + con).strip() if bayer else ""
    # Nombre propio para las brillantes; designación Bayer hasta mag 4.6
    if (proper and p["mag"] <= 4.2) or (desig and p["mag"] <= 4.6):
        star_names[i] = [proper, n.get("es") or "", desig]

# Líneas de constelaciones: [[ [ra,dec], ... ], ...] por constelación
con_lines = {}
for f in lines:
    segs = []
    for seg in f["geometry"]["coordinates"]:
        segs.append([[round(ra360(a), 2), round(b, 2)] for a, b in seg])
    con_lines[f["id"]] = segs

con_names = {}
for f in consts:
    p = f["properties"]
    lon, lat = f["geometry"]["coordinates"]
    con_names[f["id"]] = [p.get("en") or p["name"], p.get("es") or p["name"],
                          round(ra360(lon), 1), round(lat, 1), int(p.get("rank") or 3)]

# Estrellas con significado propio en la app (se resuelven por número HIP)
special = {
    "sirius": "32349", "canopus": "30438", "rigilkent": "71683", "arcturus": "69673",
    "vega": "91262", "capella": "24608", "rigel": "24436", "procyon": "37279",
    "achernar": "7588", "betelgeuse": "27989", "hadar": "68702", "altair": "97649",
    "acrux": "60718", "aldebaran": "21421", "antares": "80763", "spica": "65474",
    "pollux": "37826", "fomalhaut": "113368", "mimosa": "62434", "deneb": "102098",
    "regulus": "49669", "gacrux": "61084", "imai": "59747",
}
special_idx = {}
for key, hip in special.items():
    if hip not in hip_index:
        raise SystemExit(f"Falta la estrella {key} (HIP {hip}) en el catálogo")
    special_idx[key] = hip_index[hip]

js = [
    "/* Generado por tools/build_catalog.py — no editar a mano.",
    "   Datos: d3-celestial (c) 2015 Olaf Frohn, licencia BSD-3-Clause,",
    "   derivados de los catálogos Hipparcos/Yale BSC y de las figuras de Stellarium. */",
    "var CATALOG={",
    "stars:" + json.dumps(flat, separators=(",", ":")) + ",",
    "names:" + json.dumps(star_names, separators=(",", ":"), ensure_ascii=False) + ",",
    "lines:" + json.dumps(con_lines, separators=(",", ":")) + ",",
    "cons:" + json.dumps(con_names, separators=(",", ":"), ensure_ascii=False) + ",",
    "special:" + json.dumps(special_idx, separators=(",", ":")),
    "};",
    "if(typeof module!=='undefined')module.exports=CATALOG;",
]
out.write_text("\n".join(js) + "\n", encoding="utf-8")
print(f"{len(stars)} estrellas, {len(star_names)} con nombre, {len(con_lines)} constelaciones "
      f"-> {out} ({out.stat().st_size/1024:.0f} kB)")
