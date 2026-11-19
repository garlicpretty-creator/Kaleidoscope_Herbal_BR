"""Draws the eight honey pill sprites into tools/icon_src/rd/. Usage: python3 tools/honey_pills.py

All eight share one Retro Diffusion sprite of three dark brown honey pills on a square of paper
(art/retro_diffusion/pill/pill.png). Real honey pills are all the same honey brown, so the pills keep the sprite's
colour and only the paper under them takes the colour of the powder packet's label: a pill and its powder read as
one set.
Then run tools/icons.py, which writes the icons with their normal and MER maps.
"""
import os
from PIL import Image
ROOT=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..')
SRC=os.path.join(ROOT,'art','retro_diffusion','pill','pill.png')
OUT=os.path.join(ROOT,'tools','icon_src','rd')

# The label colours of the eight powder packets (明目藍、清熱青、安神紫、行氣綠、參蟲紅、輕身黃、隱息灰、回春粉).
COATS={'ming_mu':(58,96,190),'qing_re':(36,160,164),'an_shen':(110,74,184),'xing_qi':(70,164,60),
       'shen_chong':(194,46,40),'qing_shen':(232,182,40),'yin_xi':(92,94,104),'hui_chun':(228,104,146)}

def mix(a,b,t):return tuple(round(x+(y-x)*t) for x,y in zip(a,b))

def is_paper(p):
    """The paper is the pale, nearly grey part of the sprite; the pills are the brown part."""
    return min(p[:3])>150 and max(p[:3])-min(p[:3])<60

def pill(coat):
    src=Image.open(SRC).convert('RGBA');w,h=src.size
    out=Image.new('RGBA',(w,h),(0,0,0,0))
    for y in range(h):
        for x in range(w):
            p=src.getpixel((x,y))
            if p[3]<128:continue
            if is_paper(p):            # the paper takes the label colour, keeping the sprite's shading
                t=sum(p[:3])/3/255;out.putpixel((x,y),mix(tuple(round(c*.55) for c in coat),mix(coat,(255,250,236),.35),t)+(255,))
            else:out.putpixel((x,y),p[:3]+(255,))
    return out

if __name__=='__main__':
    for kind,coat in COATS.items():pill(coat).save(os.path.join(OUT,kind+'_pill.png'))
    print('wrote %d honey pill sprites'%len(COATS))
