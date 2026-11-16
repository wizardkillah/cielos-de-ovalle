#!/usr/bin/env python3
"""Une src/ en un único archivo HTML autónomo: dist/cielos-de-ovalle.html
Uso: python3 build.py"""
from pathlib import Path
root = Path(__file__).parent
src = root / "src"
order = ["astro.js", "data.js", "content.js", "i18n.js", "sky.js", "cosmos.js", "app.js"]
js = "\n".join(f"/* ---- {n} ---- */\n" + (src / n).read_text(encoding="utf-8") for n in order)
html = (src / "index.html").read_text(encoding="utf-8")
html = html.replace("/*{{CSS}}*/", (src / "style.css").read_text(encoding="utf-8"))
html = html.replace("/*{{JS}}*/", js.replace("</script>", "<\\/script>"))
out = root / "dist" / "cielos-de-ovalle.html"
out.parent.mkdir(exist_ok=True)
out.write_text(html, encoding="utf-8", newline="\n")   # mismo resultado en Windows, macOS y Linux
print(f"{out}  {out.stat().st_size/1024:.0f} kB")
