"""Repaints the placed tea cups in models/teas(.png|_normal|_mer) to match the tea icons.
Usage: python tools/tea_blocks.py

Up to 1.3.0 each placed tea had its own cup colour (pink, teal, white...) while every tea icon shows the same
celadon cup on a saucer. Now all five use the celadon cup of the dew tea, and the teas are told apart by the
tea itself, as on the icons: its colour and what floats on it (the same garnish tools/tea_cups.py paints on the icons).
Each tea has a 32 x 6 strip of cells (cup sides, cup front, rim, cup top, saucer side, saucer top, tea surface);
the cup and saucer cells are copied from the dew tea's strip, the 4 x 4 tea surface is painted here.
Safe to run again: it repaints the same cells."""
import os
from PIL import Image
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
TEX = os.path.join(ROOT, 'Kaleidoscope Herbal [RP]', 'textures', 'kaleidoscope_herbal', 'models')
CUP = (33, 7)                                   # the dew tea's strip: its cup and saucer are the celadon ones
STRIPS = {'goji_tea': (1, 1), 'chrysanthemum_tea': (33, 1), 'honeysuckle_tea': (1, 7), 'honeysuckle_tea_dew': (33, 7), 'jujube_tea': (1, 13)}
# the tea surface, 4 x 4, row by row: tea colours and garnish
C = {'Y': (246, 206, 70), 'y': (232, 186, 58), 'c': (196, 140, 30),            # chrysanthemum flower
     'R': (214, 46, 36), 'r': (168, 30, 26),                                    # goji berries / jujube skin
     'W': (250, 246, 228), 'w': (226, 230, 176),                                # honeysuckle bud / dew flower
     'J': (236, 216, 160)}                                                      # jujube flesh
SURF = {
    'chrysanthemum_tea': ('abba', 'bYyb', 'bycb', 'abba', {'a': (226, 196, 112), 'b': (238, 212, 130)}),
    'goji_tea':          ('abba', 'bRba', 'abbR', 'baRb', {'a': (232, 150, 84), 'b': (244, 170, 98)}),
    'honeysuckle_tea':   ('abba', 'bWwb', 'bbWa', 'awbb', {'a': (200, 206, 128), 'b': (216, 220, 146)}),
    'honeysuckle_tea_dew': ('abba', 'bWWb', 'bWYb', 'abba', {'a': (214, 226, 196), 'b': (230, 238, 214)}),
    'jujube_tea':        ('abba', 'bRJb', 'bJrb', 'abba', {'a': (120, 46, 32), 'b': (146, 62, 40)}),
}

def main():
    files = [os.path.join(TEX, n) for n in ('teas.png', 'teas_normal.png', 'teas_mer.png')]
    ims = [Image.open(f) for f in files]; modes = [im.mode for im in ims]; ims = [im.convert('RGBA') for im in ims]
    col, nor, mer = ims
    cup = [im.crop((CUP[0], CUP[1], CUP[0] + 26, CUP[1] + 5)) for im in ims]   # everything left of the tea surface
    for name, (u, v) in STRIPS.items():
        for im, c in zip(ims, cup): im.paste(c, (u, v))
        rows = SURF[name][:4]; pal = {**C, **SURF[name][4]}
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                col.putpixel((u + 26 + x, v + y), pal[ch] + (255,))
                nor.putpixel((u + 26 + x, v + y), (128, 128, 255, 255))
                mer.putpixel((u + 26 + x, v + y), (0, 0, 14 if ch in 'ab' else 160, 255))   # the tea glossy like before, the garnish matte
    for im, f, m in zip(ims, files, modes): im.convert(m).save(f)

if __name__ == '__main__':
    main()
