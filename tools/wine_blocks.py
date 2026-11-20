"""Gives the placed ginseng and reishi wines a glaze of their own, matching their icons.
Usage: python tools/wine_blocks.py

Up to 1.3.0 ginseng wine stood in the same amber bottle as angelica and goji wine although its icon is a pale
cream jar, and reishi wine in nearly the same dark red bottle as jujube wine. The shared cells are copied into free
cells of models/wines(.png|_normal|_mer), recoloured along a glaze ramp (shading kept), and that wine's model is
pointed at the copies:
  ginseng wine   shoulder and body in a pale straw glaze, like its icon
  reishi wine    shoulder and body in a near-black purple-brown glaze, like a reishi cap
Safe to run again: the copies are always made from the untouched source cells, and the model is only re-pointed once."""
import os, json
from PIL import Image
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
RP = os.path.join(ROOT, 'Kaleidoscope Herbal [RP]')
TEX = os.path.join(RP, 'textures', 'kaleidoscope_herbal', 'models'); GEO = os.path.join(RP, 'models', 'blocks')
STRAW = ((168, 136, 86), (228, 204, 148), (252, 240, 204))
EBONY = ((26, 16, 20), (62, 38, 40), (118, 80, 70))
# wine -> [(source cell, new cell, ramp)]; cells are 18 x 18 with their top-left texel at (1 + 18 i, 1 + 18 j)
WINES = {'ginseng_wine': [((1, 1), (37, 37), STRAW), ((19, 1), (55, 37), STRAW)],
         'reishi_wine': [((55, 19), (73, 37), EBONY), ((109, 19), (91, 37), EBONY)]}

def lum(p): return p[0] * .3 + p[1] * .59 + p[2] * .11
def ramp(t, r):
    a, b, k = (r[0], r[1], t * 2) if t < .5 else (r[1], r[2], t * 2 - 1)
    return tuple(round(a[i] + (b[i] - a[i]) * k) for i in range(3))

def main():
    files = [os.path.join(TEX, n) for n in ('wines.png', 'wines_normal.png', 'wines_mer.png')]
    ims = [Image.open(f) for f in files]; modes = [im.mode for im in ims]; ims = [im.convert('RGBA') for im in ims]
    for wine, cells in WINES.items():
        for (sx, sy), (dx, dy), r in cells:
            for im in ims[1:]: im.paste(im.crop((sx - 1, sy - 1, sx + 17, sy + 17)), (dx - 1, dy - 1))
            src = ims[0].crop((sx - 1, sy - 1, sx + 17, sy + 17))
            ls = [lum(p) for p in src.getdata() if p[3]]; lo, hi = min(ls), max(ls)
            out = Image.new('RGBA', src.size, (0, 0, 0, 0))
            for y in range(src.height):
                for x in range(src.width):
                    p = src.getpixel((x, y))
                    if p[3]: out.putpixel((x, y), ramp((lum(p) - lo) / max(hi - lo, 1), r) + (p[3],))
            ims[0].paste(out, (dx - 1, dy - 1))
        path = os.path.join(GEO, wine + '.geo.json'); geo = json.load(open(path, encoding='utf-8'))
        for bone in geo['minecraft:geometry'][0]['bones']:
            for cube in bone.get('cubes', []):
                for face in cube['uv'].values():
                    u, v = face['uv']; w, h = face['uv_size']; u0, v0 = min(u, u + w), min(v, v + h)
                    for (sx, sy), (dx, dy), _ in cells:
                        if sx - 1 <= u0 < sx + 17 and sy - 1 <= v0 < sy + 17:
                            face['uv'] = [round(u + dx - sx, 4), round(v + dy - sy, 4)]; break
        with open(path, 'w', encoding='utf-8', newline='\n') as f: json.dump(geo, f, separators=(',', ':'))
    for im, f, m in zip(ims, files, modes): im.convert(m).save(f)

if __name__ == '__main__':
    main()
