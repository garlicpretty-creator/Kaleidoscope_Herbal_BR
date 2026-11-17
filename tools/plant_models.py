"""Rebuilds the models of the eight field herbs, wild and farmed, from their 16x16 plant sprites.
Usage: python3 tools/plant_models.py

The old models were a thin stem with a few small leaf planes and filled about a third of the block.
Each plant is now its own sprite (tools/icon_src/, the same drawings the item icons use) on two crossed
planes at one texture pixel per model unit, like a vanilla flower. Flowers, berries and fruit stay flat on the
planes: the 3D boxes that used to stand out of them were dropped to match vanilla and Cookery's crops.

  full plant   crossed 16x16 planes
  wild plant   the same, standing in a tuft of grass
  young crop   the sprite without flowers or fruit, on smaller planes
  sprout       a two-leaf seedling

Sprites, the grass tuft and the seedling are painted into free rows of models/plants(.png|_normal|_mer).
Geometry identifiers and bone names (stage0..stageN, plant) are unchanged, so no block file changes.
Not touched: wild cordyceps, wild poria, wild reishi and reishi spawn, which are not leafy plants."""
import os,json
from PIL import Image
ROOT=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..')
RP=os.path.join(ROOT,'Kaleidoscope Herbal [RP]')
TEX=os.path.join(RP,'textures','kaleidoscope_herbal','models');SRC=os.path.join(os.path.dirname(os.path.abspath(__file__)),'icon_src')
GEO=os.path.join(RP,'models','blocks')
# Colours that are leaf, stem or trunk. Everything else in a sprite is a flower or a fruit and becomes a box.
BODY={'285327','4d9230','82c63d','b7e85c','674129','95603a','1e4623','3a5e28','3c7332','5c9242','2a412d','345038','4e5b43','607052','688864','bcccbc'}
# herb -> (sprite of the farmed plant, sprite of the wild plant, number of growth stages)
HERBS={'angelica':('carried_angelica_crop','carried_wild_angelica',3),'chrysanthemum':('carried_wild_chrysanthemum','carried_wild_chrysanthemum',3),
       'ginseng':('carried_wild_ginseng','carried_wild_ginseng',4),'goji':('carried_goji_crop','carried_wild_goji',3),
       'honeysuckle':('carried_honeysuckle_crop','carried_wild_honeysuckle',3),'jujube':('carried_jujube_crop','carried_wild_jujube',3),
       'licorice':('carried_licorice_crop','carried_wild_licorice',3),'mugwort':('carried_wild_mugwort','carried_wild_mugwort',3)}
SPROUT=['........','.g....g.','gGg..gGg','.gG..Gg.','..gddg..','...dd...','...dd...','...dd...']
GRASS=['................','..g......g...g..','.gG..g..gG..gG.g','.dG.gGd.dG.gGd.G','gdGgdGdgdGgdGdgG','dGddGdGdGddGdGdG']
PAL={'g':(130,198,61),'G':(183,232,92),'d':(77,146,48)}
def hexof(p): return '%02x%02x%02x'%p[:3]
def clusters(im):
    """Connected groups of flower / fruit pixels, each as (bounding box, [(row, first column, last column), ...])."""
    acc={(x,y) for y in range(16) for x in range(16) if im.getpixel((x,y))[3] and hexof(im.getpixel((x,y))) not in BODY}
    out=[]
    while acc:
        todo=[acc.pop()];grp=list(todo)
        while todo:
            x,y=todo.pop()
            for n in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
                if n in acc: acc.remove(n);todo.append(n);grp.append(n)
        xs=[q[0] for q in grp];ys=[q[1] for q in grp];runs=[]
        for y in sorted(set(ys)):
            row=sorted(q[0] for q in grp if q[1]==y);start=prev=row[0]
            for x in row[1:]+[None]:
                if x is None or x!=prev+1: runs.append((y,start,prev));start=x
                prev=x
        out.append(((min(xs),min(ys),max(xs),max(ys)),runs))
    return sorted(out)
class Atlas:
    def __init__(self):
        self.col=Image.open(os.path.join(TEX,'plants.png')).convert('RGBA')
        self.nor=Image.open(os.path.join(TEX,'plants_normal.png'));self.mer=Image.open(os.path.join(TEX,'plants_mer.png'))
        self.modes=(self.nor.mode,self.mer.mode);self.nor=self.nor.convert('RGBA');self.mer=self.mer.convert('RGBA')
    def paint(self,im,x0,y0):
        for y in range(im.height):
            for x in range(im.width):
                p=im.getpixel((x,y));solid=p[3]>0
                self.col.putpixel((x0+x,y0+y),p[:3]+(255,) if solid else (0,0,0,0))
                self.nor.putpixel((x0+x,y0+y),(128,128,255,255))
                self.mer.putpixel((x0+x,y0+y),(0,0,185 if hexof(p) in BODY else 200,255) if solid else (0,0,255,255))
    def save(self):
        self.col.save(os.path.join(TEX,'plants.png'));self.nor.convert(self.modes[0]).save(os.path.join(TEX,'plants_normal.png'))
        self.mer.convert(self.modes[1]).save(os.path.join(TEX,'plants_mer.png'))
def art(rows):
    im=Image.new('RGBA',(len(rows[0]),len(rows)),(0,0,0,0))
    for y,r in enumerate(rows):
        for x,ch in enumerate(r):
            if ch!='.': im.putpixel((x,y),PAL[ch]+(255,))
    return im
def face(u,v,w,h): return {'uv':[u,v],'uv_size':[w,h],'material_instance':'atlas_plants'}
def planes(uv,size,width,height,yaws):
    """Vertical planes through the block centre, drawn on both sides."""
    u,v=uv;w,h=size
    return [{'origin':[-width/2,0,0],'size':[width,height,0],'pivot':[0,0,0],'rotation':[0,yaw,0],
             'uv':{'north':face(u,v,w,h),'south':face(u+w,v,-w,h)}} for yaw in yaws]
def boxes(uv,groups,yaws):
    """Flowers and fruit stand out of the planes: every row of a group is a box as wide as its pixels, so the box
    faces only ever show flower / fruit pixels. A wide flat group is an umbel seen from the side; the rest are buttons."""
    u,v=uv;out=[]
    for (c0,r0,c1,r1),runs in groups:
        w=c1-c0+1;h=r1-r0+1;depth=w if (h<=2 and w>=3) else min(w,h,2)
        for yaw in yaws:
            for r,a,b in runs:
                n=b-a+1
                out.append({'origin':[8-b-1,16-r-1,-depth/2],'size':[n,1,depth],'pivot':[0,0,0],'rotation':[0,yaw,0],
                            'uv':{'north':face(u+a,v+r,n,1),'south':face(u+a+n,v+r,-n,1),'east':face(u+a,v+r,1,1),
                                  'west':face(u+b,v+r,1,1),'up':face(u+a,v+r,n,1),'down':face(u+a,v+r,n,1)}})
    return out
def write(name,bones):
    geo={'format_version':'1.21.110','minecraft:geometry':[{'description':{'identifier':'geometry.kaleidoscope_herbal.'+name,
         'texture_width':128,'texture_height':128,'visible_bounds_width':2,'visible_bounds_height':2,'visible_bounds_offset':[0,0.75,0]},
         'bones':[{'name':n,'pivot':[0,0,0],'cubes':c} for n,c in bones]}]}
    with open(os.path.join(GEO,name+'.geo.json'),'w',encoding='utf-8',newline='\n') as f: json.dump(geo,f,separators=(',',':'))
if __name__=='__main__':
    atlas=Atlas();slot={};young={}
    sprites=sorted({s for crop,wild,_ in HERBS.values() for s in (crop,wild)})
    for i,s in enumerate(sprites):                        # full sprites: rows at y=56 and y=74
        im=Image.open(os.path.join(SRC,s+'.png')).convert('RGBA');slot[s]=(1+18*(i%7),56+18*(i//7),im);atlas.paint(im,*slot[s][:2])
    for i,(herb,(crop,_,_)) in enumerate(HERBS.items()):  # young sprites (no flowers or fruit): rows at y=92 and y=110
        im=slot[crop][2].copy();greens=[q[:3] for q in im.getdata() if q[3] and hexof(q) in BODY]
        leaf=sorted(set(greens),key=greens.count)[-1]
        for y in range(16):
            for x in range(16):
                if im.getpixel((x,y))[3] and hexof(im.getpixel((x,y))) not in BODY: im.putpixel((x,y),leaf+(255,))  # a bud, still green
        young[herb]=(1+18*(i%7),92+18*(i//7));atlas.paint(im,*young[herb])
    sprout=(37,110);grass=(55,110);atlas.paint(art(SPROUT),*sprout);atlas.paint(art(GRASS),*grass)
    atlas.save()
    X=(45,-45)
    for herb,(crop,wild,stages) in HERBS.items():
        def full(s): return planes(slot[s][:2],(16,16),16,16,X)   # flat crossed planes only, like vanilla and Cookery crops
        bones=[('stage0',planes(sprout,(8,8),6,6,X))]
        sizes=[11] if stages==3 else [8,12]
        for n,size in enumerate(sizes,1): bones.append(('stage%d'%n,planes(young[herb],(16,16),size,size,X)))
        bones.append(('stage%d'%(stages-1),full(crop)))
        write(herb+'_crop',bones);write('wild_'+herb,[('plant',full(wild)+planes(grass,(16,6),16,6,(0,90)))])
        print(herb,'flowers/fruit:',len(clusters(slot[crop][2])),'farmed,',len(clusters(slot[wild][2])),'wild')
