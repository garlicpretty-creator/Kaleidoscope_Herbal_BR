"""Puts the five teas in one cup. Usage: python3 tools/tea_cups.py, then python3 tools/icons.py
art/retro_diffusion/tea/cup.png is one Retro Diffusion teacup; the other five files there are the same cup redrawn
by Retro Diffusion (image-to-image) with each tea in it. Redrawing shifts the cup a little every time, so the icon
is cup.png with only the tea surface taken from each redraw."""
import os
from PIL import Image
ROOT=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..')
SRC=os.path.join(ROOT,'art','retro_diffusion','tea');OUT=os.path.join(ROOT,'tools','icon_src','rd')
SURFACE={(x,4) for x in range(5,11)}|{(x,5) for x in range(4,12)}|{(x,6) for x in range(5,11)}
# What floats on each tea, painted over the surface so the five read apart (round 4, 2026-11-19).
Y,y,R,C,W,P=(244,216,74),(214,166,38),(178,40,30),(228,196,140),(255,255,250),(236,228,180)
GARNISH={'chrysanthemum_tea':{(6,5):Y,(7,5):y,(9,4):Y,(9,5):y},
 'goji_tea':{(6,5):(232,52,36),(8,4):(196,30,24),(10,5):(232,52,36)},
 'honeysuckle_tea':{(6,5):P,(7,5):P,(9,4):P,(10,4):(222,212,160)},
 'honeysuckle_tea_dew':{(7,4):W,(8,4):W,(7,5):W,(8,5):(242,201,76),(9,5):W},
 'jujube_tea':{(6,5):R,(7,5):C,(9,4):R,(10,4):C}}
if __name__=='__main__':
    cup=Image.open(os.path.join(SRC,'cup.png')).convert('RGBA')
    for tea in ('chrysanthemum_tea','goji_tea','honeysuckle_tea','honeysuckle_tea_dew','jujube_tea'):
        drawn=Image.open(os.path.join(SRC,tea+'.png')).convert('RGBA');icon=cup.copy()
        for x,y in SURFACE:
            p=drawn.getpixel((x,y))
            if p[3]>=128: icon.putpixel((x,y),p[:3]+(255,))
        for xy,c in GARNISH[tea].items(): icon.putpixel(xy,c+(255,))
        icon.save(os.path.join(OUT,tea+'.png'));print(tea)
