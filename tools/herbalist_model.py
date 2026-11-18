"""The wandering herbalist (走方郎中): model, texture and PBR maps. Usage: python3 tools/herbalist_model.py

A travelling doctor of the rivers and lakes: a wide bamboo hat (斗笠), an ankle-length hemp robe with a crossed
collar and a dark sash, a bamboo herb basket (藥簍) on his back, a gourd (葫蘆) at his hip and a cloth banner
(幌子) on a staff, painted with a gourd, the old sign of a doctor (懸壺濟世). Nothing blue, nothing like the
vanilla wandering trader.

Writes models/entity/wandering_herbalist.geo.json and textures/kaleidoscope_herbal/entity/wandering_herbalist
(.png, _normal.png, _mer.png, .texture_set.json). The bones head, body, rightArm, leftArm, rightLeg and leftLeg
must keep their names: the walk animation swings the four limbs and the look animation turns the head.
"""
import json,os,random
from PIL import Image
ROOT=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..')
RP=os.path.join(ROOT,'Kaleidoscope Herbal [RP]');NS='kaleidoscope_herbal'
TW=TH=128

# material -> (base colour, roughness)
MAT={'robe':((166,154,126),240),'robe_dk':((140,128,102),240),'sash':((112,54,42),235),'trousers':((78,70,60),240),
     'skin':((212,168,128),185),'hair':((150,146,140),220),'straw':((204,174,108),225),'bamboo':((184,152,90),205),
     'herbs':((88,134,62),215),'gourd':((214,148,58),120),'wood':((112,80,52),210),'banner':((226,216,190),240)}
rnd=random.Random(7)

# bone -> (parent, pivot); cubes: (bone, name, origin, size, material, inflate)
BONES={'body':(None,[0,24,0]),'head':('body',[0,24,0]),'hat':('head',[0,31,0]),'rightArm':('body',[-5,22,0]),
       'staff':('rightArm',[-6,13,0]),'leftArm':('body',[5,22,0]),'rightLeg':('body',[-1.9,12,0]),'leftLeg':('body',[1.9,12,0]),
       'basket':('body',[0,22,2]),'gourd':('body',[4.5,12,0])}
CUBES=[
 ('body','torso',[-4,12,-2],[8,12,4],'robe',0),
 ('body','skirt',[-4,3,-2],[8,9,4],'robe',.5),
 ('body','sash',[-4,11,-2],[8,2,4],'sash',.6),
 ('head','head',[-4,24,-4],[8,8,8],'skin',0),
 ('head','beard',[-1.5,21,-4.4],[3,3,1],'hair',0),
 ('hat','brim',[-8,31,-8],[16,1,16],'straw',0),
 ('hat','crown',[-5,32,-5],[10,1,10],'straw',0),
 ('hat','peak',[-2.5,33,-2.5],[5,1,5],'straw',0),
 ('hat','tip',[-1,34,-1],[2,1,2],'straw',0),
 ('rightArm','rsleeve',[-8,12,-2],[4,12,4],'robe',0),
 ('leftArm','lsleeve',[4,12,-2],[4,12,4],'robe',0),
 ('rightLeg','rleg',[-3.9,0,-2],[4,12,4],'trousers',0),
 ('leftLeg','lleg',[-0.1,0,-2],[4,12,4],'trousers',0),
 ('basket','basket',[-3.5,11,2.2],[7,11,5],'bamboo',0),
 ('basket','herbs',[-3,22,2.7],[6,2,4],'herbs',0),
 ('gourd','gourd_lo',[4.3,7,-1.5],[3,3,3],'gourd',0),
 ('gourd','gourd_hi',[4.8,10,-1],[2,2,2],'gourd',0),
 ('staff','pole',[-6.5,2,-2.5],[1,29,1],'wood',0),
 ('staff','bar',[-12.5,29,-2.5],[7,1,1],'wood',0),
 ('staff','banner',[-12,17,-2.6],[6,12,0],'banner',0),   # in front of the pole and the sleeve (z -2): no z-fighting
]

def foot(size):
    w,h,d=(int(round(s)) for s in size);return 2*(w+d),d+h
def pack():
    """Shelf-packs every cube's box UV into the texture."""
    order=sorted(range(len(CUBES)),key=lambda i:-foot(CUBES[i][3])[1]);uv={};x=y=row=0
    for i in order:
        fw,fh=foot(CUBES[i][3])
        if x+fw>TW:x,y,row=0,y+row,0
        uv[i]=(x,y);x+=fw;row=max(row,fh)
    assert y+row<=TH,'texture too small'
    return uv

def faces(u,v,size):
    w,h,d=(int(round(s)) for s in size)
    return {'top':(u+d,v,w,d),'bottom':(u+d+w,v,w,d),'right':(u,v+d,d,h),'front':(u+d,v+d,w,h),
            'left':(u+d+w,v+d,d,h),'back':(u+2*d+w,v+d,w,h)}

img=Image.new('RGBA',(TW,TH),(0,0,0,0));height=Image.new('L',(TW,TH),0);rough=Image.new('L',(TW,TH),0)
def put(x,y,c,hgt=128,mat=None):
    img.putpixel((x,y),tuple(c)+(255,));height.putpixel((x,y),hgt)
    if mat:rough.putpixel((x,y),MAT[mat][1])
def shade(c,f):return tuple(max(0,min(255,round(v*f))) for v in c)
def fill(r,mat,f=1.0,noise=.05):
    x0,y0,w,h=r
    for y in range(y0,y0+h):
        for x in range(x0,x0+w):put(x,y,shade(MAT[mat][0],f*(1+rnd.uniform(-noise,noise))),128,mat)

# ---- per-cube painting: rect is (x, y, w, h) of a face on the texture
def p_robe(F,name):
    for k,r in F.items():fill(r,'robe',{'top':1.05,'bottom':.75}.get(k,1.0))
    for k in ('front','back','left','right'):
        x,y,w,h=F[k]
        for xx in range(x,x+w):put(xx,y+h-1,shade(MAT['robe'][0],.78),110,'robe')         # hem
        for yy in range(y,y+h):
            if (yy-y)%3==0:put(x+(yy*5)%w,yy,shade(MAT['robe'][0],.9),120,'robe')         # a few creases
    if name=='torso':
        x,y,w,h=F['front']
        for i in range(h):                                     # crossed collar: right over left, dark edging
            a=x+2+i*3//4
            if a<x+w:put(a,y+i,shade(MAT['robe'][0],.62),150,'robe')
            if i<4:put(x+w-3-i,y+i,(232,226,208),140,'robe')  # the white inner collar
        for i in range(6):put(x+1,y+i,shade(MAT['wood'][0],.9),150,'wood');put(x+w-2,y+i,shade(MAT['wood'][0],.9),150,'wood')  # basket straps
    if name in('rsleeve','lsleeve'):
        for k in ('front','back','left','right'):
            x,y,w,h=F[k]
            for yy in range(y+h-3,y+h):
                for xx in range(x,x+w):put(xx,yy,shade(MAT['robe'][0],.8 if yy==y+h-3 else .95),130,'robe')   # cuff
        x,y,w,h=F['bottom'];fill((x,y,w,h),'skin',.95)       # the hand shows under the sleeve
        for k in ('front','back','left','right'):
            x,y,w,h=F[k];[put(xx,y+h-1,shade(MAT['skin'][0],.9),140,'skin') for xx in range(x+1,x+w-1)]
def p_sash(F,name):
    for k,r in F.items():fill(r,'sash')
    x,y,w,h=F['front']
    for yy in range(y,y+h):put(x+w-3,yy,shade(MAT['sash'][0],.7),140,'sash')   # the knot
    put(x+w-3,y+h-1,(190,160,90),160,'sash')
def p_trousers(F,name):
    for k,r in F.items():fill(r,'trousers')
    for k in ('front','back','left','right'):
        x,y,w,h=F[k]
        for yy in range(y+h-3,y+h):
            for xx in range(x,x+w):put(xx,yy,(42,38,36) if yy<y+h-1 else (214,206,190),140,'trousers')  # cloth shoes, white sole
    x,y,w,h=F['bottom'];fill((x,y,w,h),'trousers',.6)
def p_head(F,name):
    for k,r in F.items():fill(r,'skin',1.0,.03)
    hair=MAT['hair'][0]
    for k in ('back','left','right','top'):
        x,y,w,h=F[k]
        for yy in range(y,y+h):
            for xx in range(x,x+w):
                if k=='top' or k=='back' or yy<y+4 or (k=='right' and xx<x+4) or (k=='left' and xx>=x+w-4):
                    put(xx,yy,shade(hair,1+rnd.uniform(-.08,.08)),140,'hair')
    x,y,w,h=F['front']
    for xx in range(x,x+w):put(xx,y,shade(hair,1),140,'hair');put(xx,y+1,shade(hair,.92),140,'hair')   # hairline
    for xx in (x+1,x+2,x+5,x+6):put(xx,y+3,(120,112,104),140,'hair')                                    # brows
    for xx in (x+1,x+6):put(xx,y+4,(236,232,222),130,'skin')
    for xx in (x+2,x+5):put(xx,y+4,(44,36,32),120,'skin')                                               # eyes
    put(x+3,y+5,shade(MAT['skin'][0],.86),150,'skin');put(x+4,y+5,shade(MAT['skin'][0],.86),150,'skin')  # nose
    for xx in range(x+2,x+6):put(xx,y+6,(196,192,184),150,'hair')                                        # moustache
    put(x+1,y+7,(196,192,184),150,'hair');put(x+6,y+7,(196,192,184),150,'hair')
    for xx in range(x+3,x+5):put(xx,y+7,(150,96,84),120,'skin')                                          # mouth
def p_beard(F,name):
    for k,r in F.items():fill(r,'hair',1.25,.06)
    x,y,w,h=F['front'];img.putpixel((x,y+h-1),(0,0,0,0));img.putpixel((x+w-1,y+h-1),(0,0,0,0))
def p_straw(F,name):
    for k,r in F.items():
        x,y,w,h=r
        for yy in range(y,y+h):
            for xx in range(x,x+w):
                f=1.0 if k=='top' else (.62 if k=='bottom' else .85)
                if k in('top','bottom'):
                    cx,cy=x+w/2-.5,y+h/2-.5;dx,dy=xx-cx,yy-cy
                    if (abs(dx)>abs(dy) and int(dy*3/max(1,abs(dx)))%2) or (abs(dy)>=abs(dx) and int(dx*3/max(1,abs(dy)))%2):f*=.9   # radial weave
                    if name=='brim' and max(abs(dx),abs(dy))>w/2-1.5:f*=.82                         # bound rim
                put(xx,yy,shade(MAT['straw'][0],f*(1+rnd.uniform(-.05,.05))),150,'straw')
    if name=='brim':                                            # chin cord on the underside
        x,y,w,h=F['bottom'];put(x+w//2,y+h//2+2,(110,60,40),140,'straw')
def p_bamboo(F,name):
    for k,r in F.items():
        x,y,w,h=r
        for yy in range(y,y+h):
            for xx in range(x,x+w):
                f=.92 if (xx+yy)%2 else 1.04                         # woven
                if k not in('top','bottom') and (yy-y) in(0,h-1,h//2):f=.7     # bands
                put(xx,yy,shade(MAT['bamboo'][0],f*(1+rnd.uniform(-.04,.04))),150 if f>1 else 120,'bamboo')
        if k=='top':fill(r,'bamboo',.45,.04)
def p_herbs(F,name):
    for k,r in F.items():
        x,y,w,h=r
        for yy in range(y,y+h):
            for xx in range(x,x+w):
                c=MAT['herbs'][0];v=rnd.random()
                if v<.18:c=(214,170,120)      # a ginseng root
                elif v<.3:c=(160,52,40)      # goji
                elif v<.42:c=(232,212,110)   # chrysanthemum
                put(xx,yy,shade(c,1+rnd.uniform(-.12,.12)),150+rnd.randint(-20,20),'herbs')
def p_gourd(F,name):
    for k,r in F.items():fill(r,'gourd',{'top':1.1,'bottom':.7}.get(k,1.0),.03)
    if name=='gourd_hi':
        x,y,w,h=F['top'];put(x,y,(120,74,40),160,'wood')
        for k in ('front','back','left','right'):x,y,w,h=F[k];[put(xx,y+h-1,(170,46,36),150,'sash') for xx in range(x,x+w)]   # red cord
    else:
        for k in ('front','left'):x,y,w,h=F[k];put(x+1,y,shade(MAT['gourd'][0],1.3),150,'gourd')   # highlight
def p_wood(F,name):
    for k,r in F.items():fill(r,'wood',1.0,.08)
def p_banner(F,name):
    for k in ('front','back'):
        x,y,w,h=F[k];fill(F[k],'banner',1.0,.03)
        for yy in range(y,y+h):
            for xx in range(x,x+w):
                if xx in(x,x+w-1) or yy==y or yy==y+h-1:put(xx,yy,(150,46,38),110,'banner')   # red border
        # a gourd on the cloth (懸壺)
        g=[(2,2),(3,2),(2,3),(3,3),(1,5),(2,5),(3,5),(4,5),(1,6),(2,6),(3,6),(4,6),(1,7),(2,7),(3,7),(4,7),(2,8),(3,8)]
        for gx,gy in g:put(x+gx,y+gy,(196,128,48),140,'banner')
        put(x+2,y+4,(150,46,38),140,'banner');put(x+3,y+4,(150,46,38),140,'banner')
        for gx in (1,2,3,4):put(x+gx,y+10,(70,60,52),120,'banner')    # a line of writing
PAINT={'torso':p_robe,'skirt':p_robe,'rsleeve':p_robe,'lsleeve':p_robe,'sash':p_sash,'rleg':p_trousers,'lleg':p_trousers,
       'head':p_head,'beard':p_beard,'brim':p_straw,'crown':p_straw,'peak':p_straw,'tip':p_straw,'basket':p_bamboo,
       'herbs':p_herbs,'gourd_lo':p_gourd,'gourd_hi':p_gourd,'pole':p_wood,'bar':p_wood,'banner':p_banner}

def normal_map():
    """Normals from the painted height (Sobel), flat where nothing is painted."""
    out=Image.new('RGBA',(TW,TH),(128,128,255,255));h=height.load();a=img.load()
    for y in range(TH):
        for x in range(TW):
            if a[x,y][3]==0:continue
            g=lambda xx,yy:h[min(TW-1,max(0,xx)),min(TH-1,max(0,yy))] if a[min(TW-1,max(0,xx)),min(TH-1,max(0,yy))][3] else h[x,y]
            dx=(g(x+1,y)-g(x-1,y))/255*1.6;dy=(g(x,y+1)-g(x,y-1))/255*1.6
            n=(-dx,dy,1.0);l=sum(c*c for c in n)**.5
            out.putpixel((x,y),tuple(round((c/l*.5+.5)*255) for c in n)+(255,))
    return out

def build():
    uv=pack();bones={b:{'name':b,'pivot':p,'cubes':[]} for b,(par,p) in BONES.items()}
    for b,(par,_) in BONES.items():
        if par:bones[b]['parent']=par
    for i,(bone,name,origin,size,mat,infl) in enumerate(CUBES):
        cube={'origin':origin,'size':size,'uv':list(uv[i])}
        if infl:cube['inflate']=infl
        bones[bone]['cubes'].append(cube)
        PAINT[name](faces(*uv[i],size),name)
    geo={"format_version":"1.12.0","minecraft:geometry":[{"description":{"identifier":"geometry.%s.wandering_herbalist"%NS,
        "texture_width":TW,"texture_height":TH,"visible_bounds_width":3,"visible_bounds_height":3,"visible_bounds_offset":[0,1.5,0]},
        "bones":list(bones.values())}]}
    path=os.path.join(RP,'models','entity','wandering_herbalist.geo.json')
    with open(path,'w',encoding='utf-8') as f:f.write(json.dumps(geo,ensure_ascii=False,indent=1))
    folder=os.path.join(RP,'textures',NS,'entity');base=os.path.join(folder,'wandering_herbalist')
    img.save(base+'.png');normal_map().save(base+'_normal.png')
    mer=Image.new('RGBA',(TW,TH),(0,0,0,255));r=rough.load();a=img.load()
    for y in range(TH):
        for x in range(TW):mer.putpixel((x,y),(0,0,r[x,y] if a[x,y][3] else 235,255))
    mer.save(base+'_mer.png')
    with open(base+'.texture_set.json','w',encoding='utf-8') as f:
        f.write(json.dumps({"format_version":"1.16.100","minecraft:texture_set":{"color":"wandering_herbalist",
            "normal":"wandering_herbalist_normal","metalness_emissive_roughness":"wandering_herbalist_mer"}},separators=(',',':')))
    print('wandering herbalist: %d bones, %d cubes, %dx%d texture'%(len(bones),len(CUBES),TW,TH))

if __name__=='__main__':build()
