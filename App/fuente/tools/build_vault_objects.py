#!/usr/bin/env python3
"""Genera las notas de objetos de la bóveda de Obsidian a partir del contenido de la app.
Uso: node tools/export_content.js > content.json && python3 tools/build_vault_objects.py content.json "<bóveda>/05 Cielo austral/Objetos"
Requiere: pip install ephem"""
import json, sys, math, ephem
from pathlib import Path
data = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
out = Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
LAT = -30.6033
MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
TIPO = {"galaxy": "Galaxia", "nebula": "Nebulosa", "cluster": "Cúmulo abierto", "globular": "Cúmulo globular",
        "dark": "Nebulosa oscura", "center": "Centro galáctico"}
TOOL = {"eye": "A simple vista", "bino": "Binoculares", "scope": "Telescopio"}
CONST = {k: v[1] for k, v in data["cons"].items()}

def alt22(ra, dec):
    """Altura a las 22:00 hora local el día 15 de cada mes de 2027 (UTC−3 verano, UTC−4 invierno)."""
    res = []
    for m in range(1, 13):
        off = 4 if 4 <= m <= 8 else 3
        o = ephem.Observer(); o.lat, o.lon, o.pressure = str(LAT), "-71.2003", 0
        o.date = ephem.Date(f"2027/{m}/15 22:00") + off / 24
        b = ephem.FixedBody(); b._ra = math.radians(ra); b._dec = math.radians(dec); b._epoch = ephem.J2000; b.compute(o)
        res.append(round(math.degrees(b.alt)))
    return res
def hms(ra): h = ra / 15; return f"{int(h)}h {int((h % 1) * 60):02d}m"
def dms(d): return f"{'−' if d < 0 else '+'}{int(abs(d))}° {int((abs(d) % 1) * 60):02d}′"
def bar(a): return "—" if a <= 0 else "▁▂▃▄▅▆▇█"[min(7, a // 12)] + f" {a}°"

def when(ra, dec):
    alts = alt22(ra, dec); tmax = 90 - abs(LAT - dec)
    best = [MES[i] for i, a in enumerate(alts) if a >= max(25, 0.6 * max(alts))]
    lines = [f"- **Altura máxima** (al cruzar el meridiano): {tmax:.0f}°"]
    if dec < -(90 + LAT): lines.append("- **Circumpolar**: desde Ovalle nunca se pone; gira alrededor del polo sur celeste.")
    elif dec > 90 + LAT: lines.append("- No sale nunca desde Ovalle.")
    if tmax < 20: lines.append("- Siempre queda **muy bajo hacia el norte**: busca un horizonte despejado.")
    lines.append(f"- **Mejores meses a las 22:00**: {', '.join(best) if best else 'no supera los 25° a esa hora; mejor de madrugada'}")
    table = "| " + " | ".join(MES) + " |\n|" + "---|" * 12 + "\n| " + " | ".join(bar(a) for a in alts) + " |"
    return "\n".join(lines) + "\n\n*Altura sobre el horizonte a las 22:00 (día 15 de cada mes, 2027):*\n\n" + table, best

index = {"Sol, Luna y planetas": [], "Estrellas": [], "Cielo profundo": []}
seasons = {m: [] for m in MES}

def write(name, fm, body):
    front = "---\n" + "\n".join(f"{k}: {json.dumps(v, ensure_ascii=False) if not isinstance(v, (int, float, bool)) else json.dumps(v)}" for k, v in fm.items()) + "\n---\n"
    (out / f"{name}.md").write_text(front + body.strip() + "\n", encoding="utf-8")

def common(o):
    s = ""
    if o.get("find"): s += f"\n## Cómo encontrarlo\n{o['find']['es']}\n"
    s += f"\n> [!tip] ¿Sabías que…?\n> {o['f']['es']}\n"
    if o.get("cult"): s += f"\n## Otros nombres\n{o['cult']['es']} Ver [[Nombres y saberes del cielo]].\n"
    if o.get("warn"): s += f"\n> [!danger] Seguridad\n> {o['warn']['es']}\n"
    s += f"\n## English\n{o['d']['en']}\n\n*{o['f']['en']}*\n"
    return s

for o in data["dsos"]:
    name = o["name"]["es"]; tipo = TIPO[o["type"]]
    txt, best = when(o["ra"], o["dec"])
    for m in best: seasons[m].append((o["prio"], name, TOOL[o["tool"]]))
    fm = {"tipo": tipo, "catalogo": o["cat"], "ar": hms(o["ra"]), "dec": dms(o["dec"]), "distancia_al": o["dist"],
          "instrumento": TOOL[o["tool"]], "prioridad": o["prio"], "tags": ["objeto", "cielo-profundo", o["type"]]}
    if o["mag"] < 20: fm["magnitud"] = o["mag"]
    body = f"# {name}\n\n*{o['name']['en']} · {o['cat']} · {tipo}*\n\n{o['d']['es']}\n\n## Datos\n| | |\n|---|---|\n| Tipo | {tipo} |\n| Catálogo | {o['cat']} |\n| Distancia | {o['dist']} años luz |\n"
    if o["mag"] < 20 and o["type"] != "dark": body += f"| [[Glosario#Magnitud\\|Magnitud]] | {o['mag']} |\n"
    if o["size"]: body += f"| Tamaño aparente | {o['size']}° ({o['size'] / 0.5:.1f} lunas llenas) |\n"
    body += f"| Se ve | {TOOL[o['tool']]} |\n| Coordenadas J2000 | AR {hms(o['ra'])} · Dec {dms(o['dec'])} |\n\n## Cuándo verlo desde Ovalle\n{txt}\n" + common(o)
    body += "\n---\n[[Índice de objetos]] · [[Cielo de Ovalle por estaciones]] · [[Glosario]]\n"
    write(name, fm, body); index["Cielo profundo"].append((o["prio"], name, tipo, TOOL[o["tool"]], o["dist"]))

for key, o in data["stars"].items():
    n = o["names"]; name = n[1] or n[0]; con = CONST.get(n[2].split(" ")[1], "") if n[2] else ""
    if key == "rigilkent": name = "Alfa Centauri"
    txt, best = when(o["ra"], o["dec"])
    if o["mag"] < 1.0:
        for m in best: seasons[m].append((7, name, "A simple vista"))
    fm = {"tipo": "Estrella", "designacion": n[2], "constelacion": con, "ar": hms(o["ra"]), "dec": dms(o["dec"]), "magnitud": o["mag"],
          "distancia_al": o["dist"], "instrumento": "A simple vista", "tags": ["objeto", "estrella"]}
    body = f"# {name}\n\n*{n[0]} · {n[2]} · {con}*\n\n{o['d']['es']}\n\n## Datos\n| | |\n|---|---|\n| Designación | {n[2]} ({n[0]}) |\n| Constelación | {con} |\n| Distancia | {o['dist']} años luz |\n| [[Glosario#Magnitud\\|Magnitud]] | {o['mag']} |\n| Índice de color B−V | {o['bv']} |\n| Coordenadas J2000 | AR {hms(o['ra'])} · Dec {dms(o['dec'])} |\n\n## Cuándo verla desde Ovalle\n{txt}\n" + common(o)
    body += "\n---\n[[Índice de objetos]] · [[Cielo de Ovalle por estaciones]] · [[Glosario]]\n"
    write(name, fm, body); index["Estrellas"].append((o["mag"], name, con, "A simple vista", o["dist"]))

KIND = {"sun": "Estrella", "moon": "Satélite natural", "planet": "Planeta"}
for key, o in data["bodies"].items():
    name = o["name"]["es"]; f = o.get("facts", {})
    fm = {"tipo": KIND[o["kind"]], "instrumento": TOOL[o["tool"]], "tags": ["objeto", "sistema-solar"]}
    body = f"# {name}\n\n*{o['name']['en']} · {KIND[o['kind']]}*\n\n{o['d']['es']}\n"
    if f:
        moons = f["moons"] if isinstance(f["moons"], str) else f["moons"]["es"]
        body += f"\n## Datos\n| | |\n|---|---|\n| Duración del año | {f['year']['es']} |\n| Lunas conocidas | {moons} |\n| Diámetro | {f['diam']} |\n| Se ve | {TOOL[o['tool']]} |\n"
    body += "\n## Cuándo verlo\nSu posición cambia cada noche. La app la calcula en vivo (ver [[Motor astronómico]]); las fechas destacadas están en [[Calendario astronómico 2026–2027]].\n" + common(o)
    body += "\n---\n[[Índice de objetos]] · [[Glosario]]\n"
    write(name, fm, body); index["Sol, Luna y planetas"].append((0, name, KIND[o["kind"]], TOOL[o["tool"]], ""))

# Índice
s = "---\ntags: [indice]\n---\n# Índice de objetos\n\nFichas generadas desde el mismo contenido que usa la app (`App/fuente/src/content.js`), con las alturas calculadas para Ovalle. Para regenerarlas: `python3 tools/build_vault_objects.py`.\n"
s += "\n## Sol, Luna y planetas\n" + " · ".join(f"[[{n}]]" for _, n, *_ in index["Sol, Luna y planetas"]) + "\n"
s += "\n## Estrellas destacadas\n| Estrella | Constelación | Magnitud | Distancia (años luz) |\n|---|---|---|---|\n"
for mag, n, con, _, dist in sorted(index["Estrellas"]): s += f"| [[{n}]] | {con} | {mag} | {dist} |\n"
s += "\n## Cielo profundo\n| Objeto | Tipo | Se ve | Distancia (años luz) |\n|---|---|---|---|\n"
for pr, n, tipo, tool, dist in sorted(index["Cielo profundo"], key=lambda t: -t[0]): s += f"| [[{n}]] | {tipo} | {tool} | {dist} |\n"
(out / "Índice de objetos.md").write_text(s, encoding="utf-8")
json.dump({m: sorted(v, reverse=True) for m, v in seasons.items()}, open(Path(sys.argv[1]).parent / "seasons.json", "w"), ensure_ascii=False)
print(len(list(out.glob("*.md"))), "notas")
