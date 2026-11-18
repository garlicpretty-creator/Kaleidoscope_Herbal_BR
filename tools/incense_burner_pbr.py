"""Vibrant Visuals maps for the incense burner (香爐). Usage: python3 tools/incense_burner_pbr.py

The burner is glazed clay (decided 2026-11-18), so nothing on it is metal:
  - unglazed body (tan and brown): roughness 205-232, darker clay rougher
  - glaze (the teal bands and the ochre trim and knob): roughness 105-125
  - the dark ash inside: roughness 235
Lit version: the embers show through the vent openings round the lid. Both texels of the vent face
(uv 14,7, two wide) glow, so every opening on the ring glows (about 16 texels on screen). The two handles
(uv 1,7) used to carry a glowing texel by mistake; they are put back to their unlit colours.
Edits models/incense_burner(_lit).png and their _mer.png in place; safe to rerun.
"""
import os
from PIL import Image
T=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','Kaleidoscope Herbal [RP]','textures','kaleidoscope_herbal','models')
VENT=[((14,7),(255,138,52),230),((15,7),(255,196,104),255)]   # texel, ember colour, emissive
HANDLE=[(1,7),(2,7),(1,8),(2,8)]

def roughness(r,g,b):
    if r<60 and g<45:return 235                                  # ash
    if g>r+20:return 105+min(20,abs(g-130)//3)                   # teal glaze
    if r>210 and g>170:return 120                                # ochre glaze on the trim and knob
    lum=(r+g+b)/3
    return round(232-max(0,min(1,(lum-60)/80))*27)               # unglazed clay: 205 (light) .. 232 (dark)

def build():
    base=Image.open(os.path.join(T,'incense_burner.png')).convert('RGBA')
    for name in ('incense_burner','incense_burner_lit'):
        col=Image.open(os.path.join(T,name+'.png')).convert('RGBA');mer=Image.open(os.path.join(T,name+'_mer.png')).convert('RGBA')
        lit=name.endswith('_lit')
        if lit:
            for p in HANDLE:col.putpixel(p,base.getpixel(p))
            for p,c,_ in VENT:col.putpixel(p,c+(255,))
        for y in range(col.size[1]):
            for x in range(col.size[0]):
                r,g,b,a=col.getpixel((x,y))
                mer.putpixel((x,y),(0,0,roughness(r,g,b) if a else 255,255))
        if lit:
            for p,_,e in VENT:mer.putpixel(p,(0,e,200,255))
        col.save(os.path.join(T,name+'.png'));mer.save(os.path.join(T,name+'_mer.png'))
    print('incense burner: clay roughness set, %d vent texels glow'%len(VENT))

if __name__=='__main__':build()
