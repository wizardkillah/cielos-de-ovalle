"""Rasteriza el icono (App/icono.svg) a los mipmaps de Android con Pillow, sin cairo."""
import os
from PIL import Image, ImageDraw
S = 1024; k = S / 512
def render(size, with_bg=True, scale=1.0):
    im = Image.new('RGBA', (S, S), (2, 7, 11, 255) if with_bg else (0, 0, 0, 0))
    ov = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
    teal = (70, 240, 190, 115)
    for r in (200, 130, 60):
        d.ellipse([(256 - r) * k, (256 - r) * k, (256 + r) * k, (256 + r) * k], outline=teal, width=int(3 * k))
    for a, b in (((256, 40), (256, 472)), ((40, 256), (472, 256)), ((103, 103), (409, 409)), ((409, 103), (103, 409))):
        d.line([a[0] * k, a[1] * k, b[0] * k, b[1] * k], fill=teal, width=int(3 * k))
    blue = (126, 178, 255, 180)
    d.line([256 * k, 150 * k, 256 * k, 380 * k], fill=blue, width=int(4 * k))
    d.line([176 * k, 262 * k, 346 * k, 262 * k], fill=blue, width=int(4 * k))
    for cx, cy, r, c in ((256, 150, 22, (255, 200, 97)), (256, 380, 28, (219, 231, 255)), (176, 262, 22, (219, 231, 255)),
                         (346, 262, 20, (219, 231, 255)), (300, 318, 10, (219, 231, 255))):
        d.ellipse([(cx - r) * k, (cy - r) * k, (cx + r) * k, (cy + r) * k], fill=c + (255,))
    im = Image.alpha_composite(im, ov)
    if scale != 1.0:  # para el icono adaptativo: contenido dentro de la zona segura (66 %)
        inner = im.resize((int(S * scale), int(S * scale)), Image.LANCZOS)
        im = Image.new('RGBA', (S, S), (0, 0, 0, 0)); im.paste(inner, ((S - inner.width) // 2,) * 2)
    return im.resize((size, size), Image.LANCZOS)
res = os.path.join(os.path.dirname(__file__), '..', 'android', 'app', 'src', 'main', 'res')
for dens, px, fg in (('mdpi', 48, 108), ('hdpi', 72, 162), ('xhdpi', 96, 216), ('xxhdpi', 144, 324), ('xxxhdpi', 192, 432)):
    d = os.path.join(res, 'mipmap-' + dens)
    full = render(px)
    full.save(os.path.join(d, 'ic_launcher.png'))
    mask = Image.new('L', (px, px), 0); ImageDraw.Draw(mask).ellipse([0, 0, px - 1, px - 1], fill=255)
    rnd = Image.new('RGBA', (px, px), (0, 0, 0, 0)); rnd.paste(full, mask=mask); rnd.save(os.path.join(d, 'ic_launcher_round.png'))
    render(fg, with_bg=False, scale=0.62).save(os.path.join(d, 'ic_launcher_foreground.png'))
print('iconos listos')
