"""Puts the seven decoctions in one bowl. Usage: python3 tools/decoction_bowls.py, then python3 tools/icons.py
art/retro_diffusion/bowl/bowl.png is the Retro Diffusion cordyceps decoction; the other six files there are that bowl
redrawn image-to-image with each broth. The icon is bowl.png with only the broth surface taken from each redraw.
Two redraws came out in the wrong colour and are corrected here: four gentlemen (drawn orange, is a pale broth) and
four herb (drawn the same orange as cordyceps, is rose red)."""
import os
from PIL import Image
ROOT=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..')
SRC=os.path.join(ROOT,'art','retro_diffusion','bowl');OUT=os.path.join(ROOT,'tools','icon_src','rd')
lum=lambda p:(p[0]*.3+p[1]*.59+p[2]*.11)/255
def pale(p): t=lum(p);return tuple(round(a+(b-a)*t) for a,b in zip((176,152,104),(250,242,214)))
def rose(p): return (p[0],round(p[1]*.5),round(p[2]*.75+18))
FIX={'four_gentlemen_decoction':pale,'four_herb_decoction':rose}
if __name__=='__main__':
    bowl=Image.open(os.path.join(SRC,'bowl.png')).convert('RGBA')
    broth={(x,y) for y in range(16) for x in range(16) if bowl.getpixel((x,y))[3] and bowl.getpixel((x,y))[0]-bowl.getpixel((x,y))[2]>60}
    for name in ('ginseng_decoction','four_herb_decoction','reishi_decoction','four_gentlemen_decoction','mugwort_angelica_decoction','licorice_jujube_decoction'):
        drawn=Image.open(os.path.join(SRC,name+'.png')).convert('RGBA');icon=bowl.copy()
        for xy in broth:
            p=drawn.getpixel(xy)
            if p[3]>=128: icon.putpixel(xy,FIX.get(name,lambda q:q[:3])(p)[:3]+(255,))
        icon.save(os.path.join(OUT,name+'.png'));print(name)
    bowl.save(os.path.join(OUT,'cordyceps_decoction.png'))
