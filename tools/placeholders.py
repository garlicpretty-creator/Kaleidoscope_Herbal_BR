"""Placeholder art for the 1.2 code, until the real art is drawn. Usage: python3 tools/placeholders.py

Writes into the resource pack:
  - the wandering herbalist: client entity, model (straw hat, robe, herb basket on the back), walk and look
    animations, render controller, and a flat-coloured 64x64 texture with its texture set
  - the hut marker's fully transparent block texture (it is meant to stay invisible; not a placeholder)
  - the eight honey pill icons: three amber pills and a dot in the colour of the powder's label

Replace the herbalist texture or the pill icons by dropping in new art and keeping the file names; rerunning
this script overwrites them, so take the pill icons over into tools/icons.py once they are final.
"""
import json,os
from PIL import Image,ImageDraw
ROOT=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..')
RP=os.path.join(ROOT,'Kaleidoscope Herbal [RP]');NS='kaleidoscope_herbal'
TEX=os.path.join(RP,'textures',NS)

def dump(path,data):
    os.makedirs(os.path.dirname(path),exist_ok=True)
    with open(path,'w',encoding='utf-8') as f:f.write(json.dumps(data,ensure_ascii=False,separators=(',',':')))
def texture_set(folder,name,rough=230,metal=0):
    """Flat normal map and a single MER value: enough for the PBR checks until real maps exist."""
    img=Image.open(os.path.join(folder,name+'.png'));w,h=img.size
    Image.new('RGBA',(w,h),(128,128,255,255)).save(os.path.join(folder,name+'_normal.png'))
    Image.new('RGBA',(w,h),(metal,0,rough,255)).save(os.path.join(folder,name+'_mer.png'))
    dump(os.path.join(folder,name+'.texture_set.json'),{"format_version":"1.16.100","minecraft:texture_set":{"color":name,"normal":name+"_normal","metalness_emissive_roughness":name+"_mer"}})

# ---------------------------------------------------------------- the wandering herbalist
# (bone, parent, pivot, cube origin, size, uv, colour, mirror)
SKIN,HAT,ROBE,SLEEVE,TROUSERS,BASKET=(222,182,146),(212,182,104),(72,84,124),(62,72,108),(66,54,44),(170,136,76)
PARTS=[
 ('body',None,[0,24,0],[-4,12,-2],[8,12,4],[16,16],ROBE,False),
 ('head','body',[0,24,0],[-4,24,-4],[8,8,8],[0,0],SKIN,False),
 ('hat','head',[0,24,0],[-6,31,-6],[12,1,12],[0,48],HAT,False),
 ('rightArm','body',[-5,22,0],[-8,12,-2],[4,12,4],[40,16],SLEEVE,False),
 ('leftArm','body',[5,22,0],[4,12,-2],[4,12,4],[40,16],SLEEVE,True),
 ('rightLeg','body',[-1.9,12,0],[-3.9,0,-2],[4,12,4],[0,16],TROUSERS,False),
 ('leftLeg','body',[1.9,12,0],[-0.1,0,-2],[4,12,4],[0,16],TROUSERS,True),
 ('basket','body',[0,24,0],[-3,13,2],[6,9,4],[16,32],BASKET,False),
]
def herbalist():
    bones=[]
    for name,parent,pivot,origin,size,uv,_,mirror in PARTS:
        bone={'name':name,'pivot':pivot,'cubes':[dict({'origin':origin,'size':size,'uv':uv},**({'mirror':True} if mirror else {}))]}
        if parent:bone['parent']=parent
        bones.append(bone)
    dump(os.path.join(RP,'models','entity','wandering_herbalist.geo.json'),{"format_version":"1.12.0","minecraft:geometry":[{"description":{
        "identifier":"geometry.%s.wandering_herbalist"%NS,"texture_width":64,"texture_height":64,"visible_bounds_width":2,"visible_bounds_height":3,"visible_bounds_offset":[0,1.5,0]},"bones":bones}]})
    img=Image.new('RGBA',(64,64),(0,0,0,0));d=ImageDraw.Draw(img)
    for name,_,_,_,(w,h,dd),(u,v),colour,_ in PARTS:
        dark=tuple(round(c*.8) for c in colour)
        d.rectangle([u+dd,v,u+dd+2*w-1,v+dd-1],fill=colour+(255,))          # top and bottom
        d.rectangle([u,v+dd,u+2*(w+dd)-1,v+dd+h-1],fill=dark+(255,))        # the four sides
        d.rectangle([u+dd,v+dd,u+dd+w-1,v+dd+h-1],fill=colour+(255,))       # front
    # face: eyes and a beard on the head's front (head uv 0,0, depth 8: front at 8..15, 8..15)
    for x in (10,13):d.point((x,12),fill=(40,30,26,255))
    d.rectangle([10,14,13,15],fill=(196,196,190,255))
    d.line([20,16,20,27],fill=(150,40,36,255))                               # a red sash across the robe front
    d.rectangle([20,32,25,33],fill=(84,150,70,255))                          # herbs in the basket
    os.makedirs(os.path.join(TEX,'entity'),exist_ok=True)
    img.save(os.path.join(TEX,'entity','wandering_herbalist.png'));texture_set(os.path.join(TEX,'entity'),'wandering_herbalist',rough=235)
    swing=lambda phase,amp:["math.cos(q.limb_swing * 38.17%s) * %d * q.limb_swing_amount"%(' + 180' if phase else '',amp),0,0]
    dump(os.path.join(RP,'animations','wandering_herbalist.animation.json'),{"format_version":"1.8.0","animations":{
        "animation.%s.herbalist.walk"%NS:{"loop":True,"bones":{"rightArm":{"rotation":swing(0,40)},"leftArm":{"rotation":swing(1,40)},
            "rightLeg":{"rotation":swing(1,45)},"leftLeg":{"rotation":swing(0,45)}}},
        "animation.%s.herbalist.look"%NS:{"loop":True,"bones":{"head":{"rotation":["q.target_x_rotation","q.target_y_rotation",0]}}}}})
    dump(os.path.join(RP,'render_controllers','wandering_herbalist.render_controllers.json'),{"format_version":"1.10.0","render_controllers":{
        "controller.render.%s.herbalist"%NS:{"geometry":"Geometry.default","materials":[{"*":"Material.default"}],"textures":["Texture.default"]}}})
    dump(os.path.join(RP,'entity','wandering_herbalist.entity.json'),{"format_version":"1.10.0","minecraft:client_entity":{"description":{
        "identifier":"%s:wandering_herbalist"%NS,"materials":{"default":"entity_alphatest"},
        "textures":{"default":"textures/%s/entity/wandering_herbalist"%NS},"geometry":{"default":"geometry.%s.wandering_herbalist"%NS},
        "animations":{"walk":"animation.%s.herbalist.walk"%NS,"look":"animation.%s.herbalist.look"%NS},
        "scripts":{"animate":["walk","look"]},"render_controllers":["controller.render.%s.herbalist"%NS]}}})

# ---------------------------------------------------------------- hut marker: invisible on purpose
def hut_marker():
    folder=os.path.join(TEX,'blocks');Image.new('RGBA',(16,16),(0,0,0,0)).save(os.path.join(folder,'hut_marker.png'));texture_set(folder,'hut_marker')
    path=os.path.join(RP,'textures','terrain_texture.json')
    with open(path,encoding='utf-8') as f:j=json.load(f)
    j['texture_data']['kh_hut_marker']={'textures':'textures/%s/blocks/hut_marker'%NS};dump(path,j)

# ---------------------------------------------------------------- honey pill icons: amber pills, a dot of the powder's label colour
PILL_DOTS={'ming_mu':(58,96,190),'qing_re':(36,160,164),'an_shen':(100,70,176),'xing_qi':(70,164,60),
           'shen_chong':(194,46,40),'qing_shen':(232,182,40),'yin_xi':(58,60,70),'hui_chun':(228,104,146)}
def honey_pills():
    path=os.path.join(RP,'textures','item_texture.json')
    with open(path,encoding='utf-8') as f:j=json.load(f)
    folder=os.path.join(TEX,'items')
    for kind,dot in PILL_DOTS.items():
        img=Image.new('RGBA',(16,16),(0,0,0,0));d=ImageDraw.Draw(img)
        for cx,cy in ((5,9),(10,8),(8,12)):
            d.ellipse([cx-3,cy-3,cx+2,cy+2],fill=(150,86,30,255),outline=(84,44,18,255))
            d.point((cx-1,cy-1),fill=(236,186,96,255))
        d.ellipse([10,2,14,6],fill=dot+(255,),outline=(40,30,26,255))     # the powder's label colour
        name=kind+'_pill';img.save(os.path.join(folder,name+'.png'));texture_set(folder,name,rough=110)
        j['texture_data']['kh_'+name]={'textures':'textures/%s/items/%s'%(NS,name)}
    dump(path,j)

if __name__=='__main__':
    herbalist();hut_marker();honey_pills();print('placeholders written: herbalist, hut marker, 8 honey pills')
