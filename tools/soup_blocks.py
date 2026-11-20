"""Recolours the broth of the placed jujube sweet soup to match its icon.
Usage: python tools/soup_blocks.py

The 1.3 icon is clear amber soup with whole red jujubes floating in it, but the placed bowl still had a red broth
that looked like goji-jujube soup. Its 8 x 8 broth tile in models/bowls.png (used by no other model) is recoloured
along an amber ramp, shading kept; the three whole jujubes on top are unchanged. Safe to run again: the ramp is
laid over the tile's own light-to-dark order, which recolouring keeps."""
import os
from PIL import Image
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
TEX = os.path.join(ROOT, 'Kaleidoscope Herbal [RP]', 'textures', 'kaleidoscope_herbal', 'models')
TILE = (11, 25)
AMBER = ((132, 70, 24), (190, 118, 42), (232, 170, 86))

def lum(p): return p[0] * .3 + p[1] * .59 + p[2] * .11

def main():
    path = os.path.join(TEX, 'bowls.png'); im = Image.open(path); mode = im.mode; im = im.convert('RGBA')
    cells = [(TILE[0] + x, TILE[1] + y) for y in range(8) for x in range(8)]
    ls = [lum(im.getpixel(c)) for c in cells if im.getpixel(c)[3]]; lo, hi = min(ls), max(ls)
    for c in cells:
        p = im.getpixel(c)
        if not p[3]: continue
        t = (lum(p) - lo) / max(hi - lo, 1); a, b, k = (AMBER[0], AMBER[1], t * 2) if t < .5 else (AMBER[1], AMBER[2], t * 2 - 1)
        im.putpixel(c, tuple(round(a[i] + (b[i] - a[i]) * k) for i in range(3)) + (p[3],))
    im.convert(mode).save(path)

if __name__ == '__main__':
    main()
