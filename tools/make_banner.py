"""Draw docs/banner.png in the same layout as the Fishing Voyage banner.

78 x 48 grid of 20 px cells (the title uses its own 19 px cells):
grey bevel, a themed band with corner brackets, a black panel, the gold
Kaleidoscope star between two of the pack's own items, and the title in
blocky two-tone letters. Herbal's theme colour is green, and the star is
lifted from the Herbal pack icon so the two match.

    python3 tools/make_banner.py
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ITEMS = ROOT / "Kaleidoscope Herbal [RP]" / "textures" / "kaleidoscope_herbal" / "items"
ICON = ROOT / "Kaleidoscope Herbal [BP]" / "pack_icon.png"
OUT = ROOT / "docs" / "banner.png"

GW, GH = 78, 48          # grid in cells
U = 10                   # px per half cell; a cell is 2 x 2 units

GREY_L = (192, 192, 196)
GREY_M = (128, 128, 132)
GREY_D = (48, 48, 52)
BLACK = (0, 0, 0)
PANEL = (16, 16, 16)
SHADOW = (48, 48, 48)
G_DARK = (6, 112, 44)
G_BAND = (88, 204, 88)
G_PALE = (204, 248, 204)
G_SHADE = (34, 150, 64)
T1_FACE, T1_SHADE = (200, 246, 206), (60, 190, 84)
T2_FACE, T2_SHADE = (226, 255, 228), (96, 214, 110)

canvas = Image.new("RGB", (GW * 2, GH * 2), PANEL)   # in units


def unit(x, y, c):
    if 0 <= x < canvas.width and 0 <= y < canvas.height:
        canvas.putpixel((x, y), c)


def cell(x, y, c):
    for dy in (0, 1):
        for dx in (0, 1):
            unit(x * 2 + dx, y * 2 + dy, c)


def hline(x0, x1, y, c):
    for x in range(x0, x1 + 1):
        cell(x, y, c)


def vline(x, y0, y1, c):
    for y in range(y0, y1 + 1):
        cell(x, y, c)


def frame():
    R, B = GW - 1, GH - 1
    # bevel and black ring
    hline(0, R, 0, GREY_L); vline(0, 0, B, GREY_L)
    hline(0, R, B, GREY_L); vline(R, 0, B, GREY_L)
    hline(1, R - 1, 1, GREY_D); vline(1, 1, B - 1, GREY_D)
    hline(1, R - 1, B - 1, GREY_M); vline(R - 1, 1, B - 1, GREY_M)
    hline(2, R - 2, 2, BLACK); vline(2, 2, B - 2, BLACK)
    hline(2, R - 2, B - 2, BLACK); vline(R - 2, 2, B - 2, BLACK)
    # band: light outer line, dark inner line
    hline(3, R - 3, 3, G_BAND); hline(3, R - 3, B - 3, G_BAND)
    vline(3, 3, B - 3, G_BAND); vline(R - 3, 3, B - 3, G_BAND)
    hline(4, R - 4, 4, G_DARK); hline(4, R - 4, B - 4, G_DARK)
    vline(4, 4, B - 4, G_DARK); vline(R - 4, 4, B - 4, G_DARK)
    # panel drop shadow on the right and bottom
    vline(R - 5, 5, B - 5, SHADOW); hline(5, R - 5, B - 5, SHADOW)
    # corner brackets: three pale cells, a dark gap, one pale cell
    for cx, sx in ((3, 1), (R - 3, -1)):
        for cy, sy in ((3, 1), (B - 3, -1)):
            for i in range(3):
                cell(cx + sx * i, cy, G_PALE)
                cell(cx, cy + sy * i, G_PALE)
            cell(cx + sx, cy + sy, G_PALE)
            for i, c in ((3, G_DARK), (4, G_PALE), (5, G_DARK)):
                cell(cx + sx * i, cy, c)
                cell(cx, cy + sy * i, c)


def star(ox, oy):
    """The gold star from the pack icon with a clean one-cell outline:
    band green all round, a darker green along the lower edges."""
    icon = Image.open(ICON).convert("RGB")
    step = icon.width // 32            # icon is drawn in 32 x 32 blocks
    body = {}
    for y in range(16):
        for x in range(16):
            c = icon.getpixel(((16 + x * 2) * step // 2 + step // 2,
                               (16 + y * 2) * step // 2 + step // 2))
            if c[0] > 180 and c[1] > 150:           # gold body
                body[(x, y)] = c
    ring = set()
    for (x, y) in body:
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                n = (x + dx, y + dy)
                if n not in body:
                    ring.add(n)
    for (x, y) in ring:
        lower = (x, y - 1) in body and (x, y + 1) not in body
        cell(ox + x, oy + y, G_SHADE if lower else G_BAND)
    for (x, y), c in body.items():
        cell(ox + x, oy + y, c)
    # the little sparkle square the Fishing banner has at the star's foot
    cell(ox + 17, oy + 15, G_PALE)


def item(name, ox, oy):
    t = Image.open(ITEMS / f"{name}.png").convert("RGBA")
    for y in range(t.height):
        for x in range(t.width):
            r, g, b, a = t.getpixel((x, y))
            if a > 127:
                cell(ox + x, oy + y, (r, g, b))


FONT = {
    "K": ["XX.XX", "XXXX.", "XXX..", "XXXX.", "XX.XX"],
    "A": ["XXXXX", "XX.XX", "XXXXX", "XX.XX", "XX.XX"],
    "L": ["XX...", "XX...", "XX...", "XX...", "XXXXX"],
    "E": ["XXXXX", "XX...", "XXXX.", "XX...", "XXXXX"],
    "I": ["XX", "XX", "XX", "XX", "XX"],
    "D": ["XXXX.", "XX.XX", "XX.XX", "XX.XX", "XXXX."],
    "O": ["XXXXX", "XX.XX", "XX.XX", "XX.XX", "XXXXX"],
    "S": ["XXXXX", "XX...", "XXXXX", "...XX", "XXXXX"],
    "C": ["XXXXX", "XX...", "XX...", "XX...", "XXXXX"],
    "P": ["XXXXX", "XX.XX", "XXXXX", "XX...", "XX..."],
    "H": ["XX.XX", "XX.XX", "XXXXX", "XX.XX", "XX.XX"],
    "R": ["XXXX.", "XX.XX", "XXXX.", "XX.XX", "XX.XX"],
    "B": ["XXXX.", "XX.XX", "XXXX.", "XX.XX", "XXXX."],
}
TEXT_CELL = 19   # px; the title is drawn on the final image


def text(img, s, top, face, shade):
    """Bold two-cell strokes: a cell is shaded where the stroke ends on its
    right, so every stem reads light-then-dark like the Fishing title."""
    c = TEXT_CELL
    width = sum(len(FONT[ch][0]) for ch in s) * c + (len(s) - 1) * c
    x = (img.width - width) // 2
    for ch in s:
        g = FONT[ch]
        w = len(g[0])
        for gy, line in enumerate(g):
            for gx, v in enumerate(line):
                if v != "X":
                    continue
                open_right = gx + 1 >= w or line[gx + 1] != "X"
                col = shade if open_right else face
                img.paste(col, (x + gx * c, top + gy * c, x + (gx + 1) * c, top + (gy + 1) * c))
        x += (w + 1) * c


def main():
    frame()
    star(31, 7)
    item("fresh_ginseng", 10, 7)
    item("dried_reishi", 52, 7)
    img = canvas.resize((canvas.width * U, canvas.height * U), Image.NEAREST)
    text(img, "KALEIDOSCOPE", 27 * 20 + 6, T1_FACE, T1_SHADE)
    text(img, "HERBAL", 34 * 20 + 6, T2_FACE, T2_SHADE)
    OUT.parent.mkdir(exist_ok=True)
    img.save(OUT, optimize=True)
    print(f"wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
