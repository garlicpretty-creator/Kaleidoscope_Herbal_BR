"""Puts the five teas in one cup. Usage: python3 tools/tea_cups.py, then python3 tools/icons.py
art/retro_diffusion/tea/cup.png is one Retro Diffusion teacup; the other five files there are the same cup redrawn
by Retro Diffusion (image-to-image) with each tea in it. Redrawing shifts the cup a little every time, so the icon
is cup.png with only the tea surface taken from each redraw."""
import os
from PIL import Image
ROOT=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..')
SRC=os.path.join(ROOT,'art','retro_diffusion','tea');OUT=os.path.join(ROOT,'tools','icon_src','rd')
SURFACE={(x,4) for x in range(5,11)}|{(x,5) for x in range(4,12)}|{(x,6) for x in range(5,11)}
if __name__=='__main__':
    cup=Image.open(os.path.join(SRC,'cup.png')).convert('RGBA')
    for tea in ('chrysanthemum_tea','goji_tea','honeysuckle_tea','honeysuckle_tea_dew','jujube_tea'):
        drawn=Image.open(os.path.join(SRC,tea+'.png')).convert('RGBA');icon=cup.copy()
        for x,y in SURFACE:
            p=drawn.getpixel((x,y))
            if p[3]>=128: icon.putpixel((x,y),p[:3]+(255,))
        icon.save(os.path.join(OUT,tea+'.png'));print(tea)
