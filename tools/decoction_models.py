"""Builds the placed-bowl models of the four v1.1 decoctions (cordyceps, four gentlemen, mugwort-angelica,
licorice-jujube), which used to borrow the ginseng / four-herb / reishi bowls.
Usage: python3 tools/decoction_models.py, then python3 tools/anim_models.py (which adds the sipping poses back)
Each model is the shared bowl (taken from ginseng_decoction.geo.json) with its own soup surface and toppings.
The new surface tiles and topping swatches are painted into free rows of models/bowls(.png|_normal|_mer),
and the four block files are pointed at the new geometry. Safe to run again: it repaints the same cells."""
import os,json,copy
from PIL import Image
ROOT=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..')
RP=os.path.join(ROOT,'Kaleidoscope Herbal [RP]');BP=os.path.join(ROOT,'Kaleidoscope Herbal [BP]')
TEX=os.path.join(RP,'textures','kaleidoscope_herbal','models')
SRC_TILE=(21,15)   # golden broth tile: its shading and round outline are reused for the new broths
SRC_SWATCH=(13,35) # an existing topping swatch: its normal / MER values are reused
# Topping swatches: name -> (top xy, top size, side xy, side size, colours top rows, side colour row)
SW={
 'cordyceps':((1,55),(3,2),(5,55),(3,1),[['#8a5a2b','#b9792f','#d9a441'],['#6f4522','#9a6427','#c08a35']],['#6f4522','#8a5a2b','#a8752e']),
 'poria':((9,55),(2,2),(12,55),(2,1),[['#f6f1e4','#e8e0cd'],['#e8e0cd','#d6ccb4']],['#d6ccb4','#c4b89c']),
 'mugwort':((15,55),(3,2),(19,55),(3,1),[['#5d7d4a','#7c9a5e','#5d7d4a'],['#46633a','#5d7d4a','#46633a']],['#3d5733','#46633a','#3d5733']),
 'licorice':((23,55),(2,2),(26,55),(2,1),[['#e9c766','#d4ab49'],['#d4ab49','#b98d38']],['#a67c30','#8f6a2a']),
 'ginseng':((34,25),(2,2),(38,25),(2,1),None,None),   # existing
 'angelica':((13,35),(2,2),(17,35),(2,1),None,None),  # existing
 'jujube':((51,25),(2,2),(47,25),(2,1),None,None),    # existing
}
# name -> (surface tile xy, broth colour, toppings [(swatch, origin x/z, size x/y/z, yaw)])
MODELS={
 'cordyceps_decoction':((1,45),'#b06e28',[('cordyceps',(-2.6,-0.9),(3.4,0.5,0.9),-25),('cordyceps',(-0.4,0.9),(3.2,0.5,0.9),35),('ginseng',(0.6,-2.6),(1.8,0.4,1.8),-12)]),
 'four_gentlemen_decoction':((11,45),'#dcc58a',[('poria',(-2.4,-2.2),(1.8,0.6,1.8),15),('poria',(0.9,0.6),(1.6,0.6,1.6),-30),('ginseng',(-2.2,0.7),(1.9,0.4,1.9),40),('licorice',(0.5,-2.3),(1.7,0.4,1.4),-10)]),
 'mugwort_angelica_decoction':((21,45),'#5b5a2c',[('mugwort',(-2.8,-1.6),(2.8,0.3,1.3),20),('mugwort',(-0.2,0.8),(2.8,0.3,1.3),-40),('mugwort',(-2.4,1.2),(2.2,0.3,1.1),65),('angelica',(0.7,-2.4),(1.8,0.4,1.8),-15)]),
 'licorice_jujube_decoction':((31,45),'#e2b550',[('jujube',(-2.3,-1.9),(2.0,1.0,2.0),10),('jujube',(0.6,0.4),(1.9,1.0,1.9),-35),('licorice',(-2.2,1.0),(1.8,0.4,1.4),30),('licorice',(0.7,-2.4),(1.6,0.4,1.3),-20)]),
}
def rgb(h): return tuple(int(h[i:i+2],16) for i in (1,3,5))
def paint():
    col=Image.open(os.path.join(TEX,'bowls.png')).convert('RGBA')
    nor=Image.open(os.path.join(TEX,'bowls_normal.png'));mer=Image.open(os.path.join(TEX,'bowls_mer.png'))
    nmode,mmode=nor.mode,mer.mode;nor=nor.convert('RGBA');mer=mer.convert('RGBA')
    sx,sy=SRC_TILE
    src=[[col.getpixel((sx+x,sy+y)) for x in range(8)] for y in range(8)]
    lum=lambda p:(p[0]*3+p[1]*6+p[2])/10
    solid=[lum(p) for r in src for p in r if p[3]];mean=sum(solid)/len(solid)
    for (tx,ty),broth,_ in MODELS.values():
        base=rgb(broth)
        for y in range(8):
            for x in range(8):
                p=src[y][x]
                if not p[3]: col.putpixel((tx+x,ty+y),(0,0,0,0))
                else:
                    k=lum(p)/mean
                    col.putpixel((tx+x,ty+y),tuple(max(0,min(255,round(c*k))) for c in base)+(255,))
                nor.putpixel((tx+x,ty+y),nor.getpixel((sx+x,sy+y)));mer.putpixel((tx+x,ty+y),mer.getpixel((sx+x,sy+y)))
    wx,wy=SRC_SWATCH;n0=nor.getpixel((wx,wy));m0=mer.getpixel((wx,wy))
    for top,tsize,side,ssize,rows,srow in SW.values():
        if rows is None: continue
        for y in range(tsize[1]):
            for x in range(tsize[0]):
                col.putpixel((top[0]+x,top[1]+y),rgb(rows[y][x])+(255,));nor.putpixel((top[0]+x,top[1]+y),n0);mer.putpixel((top[0]+x,top[1]+y),m0)
        for x in range(ssize[0]):
            col.putpixel((side[0]+x,side[1]),rgb(srow[x])+(255,));nor.putpixel((side[0]+x,side[1]),n0);mer.putpixel((side[0]+x,side[1]),m0)
    col.save(os.path.join(TEX,'bowls.png'));nor.convert(nmode).save(os.path.join(TEX,'bowls_normal.png'));mer.convert(mmode).save(os.path.join(TEX,'bowls_mer.png'))
def face(xy,size): return {'uv':list(xy),'uv_size':list(size),'material_instance':'atlas_bowls'}
def build():
    base=json.load(open(os.path.join(RP,'models','blocks','ginseng_decoction.geo.json'),encoding='utf-8'))
    for name,(tile,_,tops) in MODELS.items():
        g=copy.deepcopy(base);geo=g['minecraft:geometry'][0]
        geo['description']['identifier']='geometry.kaleidoscope_herbal.'+name
        for bone in geo['bones']:
            if bone['name']=='soup':
                for c in bone['cubes']: c['uv']={'up':face(tile,(8,8))}
            elif bone['name']=='toppings':
                cubes=[]
                for i,(sw,(ox,oz),(w,h,d),yaw) in enumerate(tops):
                    top,tsize,side,ssize,_,_=SW[sw];s=face(side,ssize)
                    cubes.append({'origin':[ox,4.23,oz],'size':[w,h,d],'pivot':[round(ox+w/2,3),4.23,round(oz+d/2,3)],
                                  'rotation':[-8 if i%2==0 else 6,yaw,0],
                                  'uv':{'up':face(top,tsize),'north':s,'south':s,'east':s,'west':s}})
                bone['cubes']=cubes
        with open(os.path.join(RP,'models','blocks',name+'.geo.json'),'w',encoding='utf-8',newline='\n') as f:
            json.dump(g,f,ensure_ascii=False,separators=(',',':'))
        p=os.path.join(BP,'blocks','decor',name+'.json');j=json.load(open(p,encoding='utf-8'))
        j['minecraft:block']['components']['minecraft:geometry']['identifier']='geometry.kaleidoscope_herbal.'+name
        with open(p,'w',encoding='utf-8',newline='\n') as f: json.dump(j,f,ensure_ascii=False,separators=(',',':'))
        print('built',name)
if __name__=='__main__':
    paint();build()
