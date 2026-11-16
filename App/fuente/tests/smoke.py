#!/usr/bin/env python3
"""Prueba de humo en navegador real (Chromium + Playwright).
Uso: python3 tests/smoke.py [carpeta_capturas]"""
import sys, json, pathlib
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parent.parent
url = (root / "dist" / "cielos-de-ovalle.html").as_uri()
shots = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else None
errors = []
def shot(page, name):
    if shots: page.screenshot(path=str(shots / (name + ".png")))
def check(cond, msg):
    print(("  ok    " if cond else "  FALLA ") + msg)
    if not cond: errors.append(msg)
with sync_playwright() as p:
    b = p.chromium.launch()
    for label, vp, scale in [("movil", {"width": 390, "height": 844}, 2), ("escritorio", {"width": 1280, "height": 800}, 1)]:
        ctx = b.new_context(viewport=vp, device_scale_factor=scale, has_touch=(label == "movil"), locale="es-CL", timezone_id="America/Santiago")
        page = ctx.new_page()
        page.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
        page.on("console", lambda m: errors.append("console: " + m.text) if m.type == "error" and "fonts.g" not in m.text and "ERR_" not in m.text else None)
        page.goto(url); page.wait_for_timeout(700)
        print(label)
        check(page.locator("#welcome.show").count() == 1, "bienvenida visible en el primer uso")
        shot(page, label + "-1-bienvenida")
        page.click("[data-act=start]"); page.wait_for_timeout(300)
        # Noche fija y reproducible: 16 nov 2026, 22:30 hora de Chile
        page.evaluate("__cielos.setTime(Date.UTC(2026,10,17,1,30),false)"); page.wait_for_timeout(500)
        shot(page, label + "-2-cielo")
        n = page.evaluate("(()=>{const c=document.getElementById('view'),x=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let k=0;for(let i=0;i<x.length;i+=4)if(x[i]+x[i+1]+x[i+2]>150)k++;return k})()")
        check(n > 1500, f"el cielo dibuja estrellas ({n} píxeles brillantes)")
        page.click("#b-what"); page.wait_for_timeout(500)
        check(page.locator("#sheet.open").count() == 1, "«¿Qué estoy mirando?» abre una ficha: " + page.inner_text("#sheet-title"))
        shot(page, label + "-3-identificar")
        page.click("#sheet-close")
        page.click("#b-tonight"); page.wait_for_timeout(400)
        items = page.locator("#tonight .item").count()
        check(items >= 12, f"«Esta noche» lista objetos ({items})")
        shot(page, label + "-4-esta-noche")
        page.fill("#search", "cruz"); page.wait_for_timeout(200)
        check(page.locator("#results .item").count() >= 1, "la búsqueda encuentra «cruz»")
        page.fill("#search", "saturno"); page.wait_for_timeout(200)
        page.click("#results .item"); page.wait_for_timeout(1300)
        check("Saturno" in page.inner_text("#sheet-title"), "buscar y abrir Saturno")
        shot(page, label + "-5-saturno")
        sep = page.evaluate("(()=>{const a=__cielos,v=a.Sky.dirOf(a.S.sel);return a.Astro.angSep(v,a.S.cam.F)})()")
        check(sep < 1.0 or page.evaluate("__cielos.Sky.bodies.saturn.alt") < -5, f"«Llévame» centra el objeto (a {sep:.2f}°)")
        page.click("#sheet-close")
        page.click("#b-layers"); page.wait_for_timeout(300); shot(page, label + "-6-capas"); page.click("#sheet-close")
        page.click("#c-time"); page.wait_for_timeout(300); shot(page, label + "-7-hora"); page.click("#sheet-close")
        page.click("#c-place"); page.wait_for_timeout(300); shot(page, label + "-8-lugar"); page.click("#sheet-close")
        # Cruz del Sur y puntero al polo
        page.evaluate("(()=>{const s=__cielos.S;s.view.az=180;s.view.alt=30;s.view.fov=70})()"); page.wait_for_timeout(400)
        shot(page, label + "-9-sur")
        page.click("#b-lang"); page.wait_for_timeout(300)
        check(page.inner_text("#b-what").strip().startswith("What"), "cambio de idioma a inglés")
        page.click("#b-lang")
        page.click("#b-red"); page.wait_for_timeout(200); shot(page, label + "-10-luz-roja"); page.click("#b-red")
        page.click("#m-cosmos"); page.wait_for_timeout(900)
        for i in range(8):
            page.click(f"#stops button:nth-child({i+1})"); page.wait_for_timeout(1500)
            shot(page, f"{label}-cosmos-{i+1}")
        check(page.evaluate("__cielos.Cosmos.view.span") > 1e11, "Cosmos llega al Grupo Local")
        page.click("#m-sky"); page.wait_for_timeout(300)
        # Sensores simulados: teléfono vertical mirando al sur, luego inclinado 40° hacia arriba
        if label == "movil":
            r = page.evaluate("""(()=>{const a=__cielos;a.S.sensor=true;
              const f=(al,be,ga)=>{for(let i=0;i<60;i++)a.onOrient({alpha:al,beta:be,gamma:ga,absolute:true,type:'deviceorientationabsolute'})};
              const h=()=>a.Astro.azAltFromEnu(a.S.cam.F), out=[];
              f(180,90,0); return new Promise(res=>setTimeout(()=>{out.push(h()); f(180,130,0); setTimeout(()=>{out.push(h()); f(90,90,0); setTimeout(()=>{out.push(h()); a.S.sensor=false; res(out)},200)},200)},200))})()""")
            check(abs(r[0]["az"] - 180) < 1 and abs(r[0]["alt"]) < 1, f"sensor: vertical hacia el sur → az {r[0]['az']:.1f}, alt {r[0]['alt']:.1f}")
            check(abs(r[1]["az"] - 180) < 1 and abs(r[1]["alt"] - 40) < 1, f"sensor: inclinado 40° → az {r[1]['az']:.1f}, alt {r[1]['alt']:.1f}")
            check(abs(r[2]["az"] - 270) < 1, f"sensor: alfa 90° → oeste (az {r[2]['az']:.1f})")
        ctx.close()
    b.close()
print("\nERRORES:" if errors else "\nSin errores")
for e in errors: print("  -", e)
sys.exit(1 if errors else 0)
