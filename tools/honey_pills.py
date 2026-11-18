"""Draws the eight honey pill sprites into tools/icon_src/rd/. Usage: python3 tools/honey_pills.py

All eight share one Retro Diffusion sprite of three honey pills (art/retro_diffusion/pill/pill.png). Each kind
gets a coating (丸衣) in the colour of its powder packet's label, so a pill and its powder read as one set:
the sprite's brightness is kept and its hue is replaced with a ramp built from that colour.
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
HONEY=(176,104,40)  # a little of the honey's amber stays in every coat

def mix(a,b,t):return tuple(round(x+(y-x)*t) for x,y in zip(a,b))

def ramp(coat,t):
    """t 0..1 (sprite brightness) -> colour: dark outline, the coat in the middle tones, a pale highlight."""
    base=mix(coat,HONEY,.15)
    if t<.5:return mix(tuple(round(c*.32) for c in base),base,t/.5)
    return mix(base,mix(base,(255,250,236),.8),(t-.5)/.5)

def pill(coat):
    src=Image.open(SRC).convert('RGBA');w,h=src.size
    lum=[sum(src.getpixel((x,y))[:3])/3 for y in range(h) for x in range(w) if src.getpixel((x,y))[3]>=128]
    lo,hi=min(lum),max(lum)
    out=Image.new('RGBA',(w,h),(0,0,0,0))
    for y in range(h):
        for x in range(w):
            p=src.getpixel((x,y))
            if p[3]<128:continue
            out.putpixel((x,y),ramp(coat,(sum(p[:3])/3-lo)/(hi-lo))+(255,))
    return out

if __name__=='__main__':
    for kind,coat in COATS.items():pill(coat).save(os.path.join(OUT,kind+'_pill.png'))
    print('wrote %d honey pill sprites'%len(COATS))
