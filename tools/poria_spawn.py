"""The poria log culture (段木茯苓菌種): its model and its corner of the plant atlas. Usage: python3 tools/poria_spawn.py

A patch of white, powdery poria mycelium on the side of a spruce log, with a few lumps: two with the dark brown
bark of a young poria, one still white. The reishi culture next to it is a thin star-shaped web with white
knots, so the two read differently.

Paints only its own empty corner of models/plants.png (x 100-115, y 112-121) and the same pixels of
plants_normal.png and plants_mers.png, and writes models/blocks/poria_spawn.geo.json. Like the reishi culture,
the model is drawn facing north; the block turns it to the face it was put on.
"""
import json,math,os,random
from PIL import Image
ROOT=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..')
RP=os.path.join(ROOT,'Kaleidoscope Herbal [RP]');NS='kaleidoscope_herbal'
ATLAS=os.path.join(RP,'textures',NS,'models','plants')
PATCH=(100,112)          # the 10x10 patch
BARK=(112,112)           # 2x2: bark-brown lump
WHITE=(112,114)          # 2x2: white lump
REGION=(100,112,116,122) # everything this script owns

def patch():
    """(x, y) -> (rgba, height, roughness) for the 10x10 patch."""
    rnd=random.Random(11);px={}
    for y in range(10):
        for x in range(10):
            dx,dy=x-4.5,y-4.6;a=math.atan2(dy,dx)
            edge=4.5+.5*math.sin(3*a+.7)+.35*math.sin(7*a+2.1)       # a lobed, uneven outline
            r=math.hypot(dx,dy*1.08)
            if r>edge+.35:
                if r<edge+1.6 and (x*7+y*3)%5==0:                   # a few loose threads at the edge
                    px[(x,y)]=((226,222,210,255),150,230)
                continue
            v=rnd.random()
            if v<.2:c=(214,204,178)           # cream-tan speckles: the powder
            elif v<.32:c=(252,250,244)
            elif v<.4:c=(196,184,156)
            else:c=(236,230,214)
            f=1-.05*max(0,r-edge+1.2)         # a touch darker toward the thin edge
            px[(x,y)]=(tuple(round(k*f) for k in c)+(255,),170+rnd.randint(-25,25),245)
    return px

def lumps():
    bark=[(104,70,44),(88,58,38),(118,82,52),(96,64,40)];white=[(242,238,226),(228,222,206),(236,232,220),(220,214,198)]
    out={}
    for (u,v),cols,rough in ((BARK,bark,215),(WHITE,white,245)):
        for i,c in enumerate(cols):out[(u+i%2,v+i//2)]=(c+(255,),190,rough)
    return out

def paint():
    img=Image.open(ATLAS+'.png').convert('RGBA');nrm=Image.open(ATLAS+'_normal.png').convert('RGBA');mer=Image.open(ATLAS+'_mers.png').convert('RGBA')
    x0,y0,x1,y1=REGION
    for y in range(y0,y1):                      # the region must still be empty, or someone else owns it now
        for x in range(x0,x1):
            p=img.getpixel((x,y))
            assert p[3]==0 or getattr(paint,'again',False),('plants atlas pixel already used',x,y)
    for y in range(y0,y1):
        for x in range(x0,x1):img.putpixel((x,y),(0,0,0,0));nrm.putpixel((x,y),(128,128,255,255));mer.putpixel((x,y),(0,0,255,0))
    px={(PATCH[0]+x,PATCH[1]+y):v for (x,y),v in patch().items()};px.update(lumps())
    hgt={k:v[1] for k,v in px.items()}
    for (x,y),(rgba,h,rough) in px.items():
        img.putpixel((x,y),rgba);mer.putpixel((x,y),(0,0,rough,40))   # alpha: subsurface (see tools/subsurface.py)
        g=lambda xx,yy:hgt.get((xx,yy),h-40)
        dx=(g(x+1,y)-g(x-1,y))/255*1.4;dy=(g(x,y+1)-g(x,y-1))/255*1.4;l=(dx*dx+dy*dy+1)**.5
        nrm.putpixel((x,y),(round((-dx/l*.5+.5)*255),round((dy/l*.5+.5)*255),round((1/l*.5+.5)*255),255))
    img.save(ATLAS+'.png');nrm.save(ATLAS+'_normal.png');mer.save(ATLAS+'_mers.png')

def face(u,v,w=2,h=2):return {'uv':[u,v],'uv_size':[w,h],'material_instance':'atlas_plants'}
def lump(origin,size,uv):
    f=face(*uv);return {'origin':origin,'size':size,'uv':{k:dict(f) for k in ('south','east','west','up','down')}}
def geometry():
    cubes=[{'origin':[-5,2,-7.95],'size':[10,10,0],'uv':{'south':face(*PATCH,10,10)}},
           lump([-3.2,4.0,-7.95],[2.8,2.4,2.0],BARK),
           lump([1.0,7.0,-7.95],[2.2,1.9,1.6],BARK),
           lump([-1.4,8.4,-7.95],[1.6,1.4,1.2],WHITE),
           lump([2.4,3.4,-7.95],[1.4,1.2,1.0],WHITE),
           lump([-3.6,8.9,-7.95],[1.2,1.1,.9],BARK)]
    geo={"format_version":"1.21.110","minecraft:geometry":[{"description":{"identifier":"geometry.%s.poria_spawn"%NS,
        "texture_width":128,"texture_height":128,"visible_bounds_width":2,"visible_bounds_height":2.5,"visible_bounds_offset":[0,0.75,0]},
        "bones":[{"name":"mycelium","pivot":[0,0,0],"cubes":cubes}]}]}
    with open(os.path.join(RP,'models','blocks','poria_spawn.geo.json'),'w',encoding='utf-8') as f:f.write(json.dumps(geo,separators=(',',':')))

if __name__=='__main__':
    import sys
    paint.again='--again' in sys.argv          # repaint its own corner after a change to this script
    paint();geometry();print('poria culture: atlas corner painted, poria_spawn.geo.json written')
