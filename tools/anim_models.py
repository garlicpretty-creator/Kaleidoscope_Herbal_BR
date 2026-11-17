"""Adds the animation poses to block models and the block states that pick them. Safe to run again.

Usage: python3 tools/anim_models.py

Blocks cannot play model animations, so each moving part gets a few extra copies of its bone in
different poses, and a block state chooses which copy is drawn. The scripts step that state over a
few ticks (see scripts/utils/frames.js):

  mortar       pestle 0..2          pestle at rest, raised, striking
  clay pot     pot 3 / 4            lid down / lifted by the boil
  herb cabinet drawer 0..2          middle drawer closed, half out, out
  soup bowls   sips 0..3            broth full, two thirds, one third, empty
  teas         (no state)           a tick component puffs steam over filled cups
"""
import copy,json,os
ROOT=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..')
BP=os.path.join(ROOT,'Kaleidoscope Herbal [BP]');RP=os.path.join(ROOT,'Kaleidoscope Herbal [RP]')
NS='kaleidoscope_herbal:'
q=lambda state:"q.block_state('%s%s')"%(NS,state)

def load(path):
    with open(path,encoding='utf-8') as f:return json.load(f)
def dump(path,data):
    with open(path,'w',encoding='utf-8') as f:f.write(json.dumps(data,ensure_ascii=False,separators=(',',':')))
def geo(name):
    path=os.path.join(RP,'models','blocks',name+'.geo.json');return path,load(path)
def block(rel):
    path=os.path.join(BP,'blocks',rel+'.json');return path,load(path)

def moved(cube,dx=0,dy=0,dz=0,scale=1.0):
    """A copy of the cube moved by (dx,dy,dz), its centre pulled toward the bowl axis by `scale`."""
    c=copy.deepcopy(cube);(x,y,z),(w,h,d)=c['origin'],c['size']
    cx,cz=x+w/2,z+d/2;nx,nz=cx*scale-w/2+dx,cz*scale-d/2+dz;sx,sz=nx-x,nz-z
    c['origin']=[round(nx,4),round(y+dy,4),round(nz,4)]
    if 'pivot' in c:c['pivot']=[round(c['pivot'][0]+sx,4),round(c['pivot'][1]+dy,4),round(c['pivot'][2]+sz,4)]
    return c
def set_bones(g,bones):
    """Replaces bones of the same name, so a rerun does not stack copies."""
    names={b['name'] for b in bones};g['bones']=[b for b in g['bones'] if b['name'] not in names]+bones
def bone(g,name):return next(b for b in g['bones'] if b['name']==name)

def states(b,**new):b['description'].setdefault('states',{}).update(new)
def visibility(b,rules):
    geom=b['components']['minecraft:geometry']
    if isinstance(geom,str):geom={'identifier':geom};b['components']['minecraft:geometry']=geom
    geom.setdefault('bone_visibility',{}).update(rules)

# ---------------------------------------------------------------- mortar: the pestle pounds
def mortar():
    path,j=geo('mortar');g=j['minecraft:geometry'][0];p=bone(g,'pestle')
    up=dict(copy.deepcopy(p),name='pestle_up',cubes=[moved(c,dy=2.6) for c in p['cubes']],rotation=[0,0,-9])
    down=dict(copy.deepcopy(p),name='pestle_down',cubes=[moved(c,dy=-.55) for c in p['cubes']],rotation=[0,0,3])
    set_bones(g,[up,down]);dump(path,j)
    path,j=block('stations/mortar');b=j['minecraft:block']
    states(b,**{NS+'pestle':{'values':{'min':0,'max':2}}})
    visibility(b,{'pestle':q('pestle')+' == 0','pestle_up':q('pestle')+' == 1','pestle_down':q('pestle')+' == 2'})
    dump(path,j)

# ---------------------------------------------------------------- clay pot: the lid rattles while it boils
def clay_pot():
    path,j=geo('clay_pot');g=j['minecraft:geometry'][0];lid=bone(g,'lid_closed')
    bob=dict(copy.deepcopy(lid),name='lid_bob',cubes=[moved(c,dy=.7) for c in lid['cubes']],rotation=[0,0,4])
    set_bones(g,[bob]);dump(path,j)
    path,j=block('stations/clay_pot');b=j['minecraft:block']
    # The pot's one `pot` state already has the two boiling looks (3 lid down, 4 lid lifted; see clayPot.js LOOK).
    visibility(b,{'lid_closed':q('pot')+' == 3','lid_bob':q('pot')+' == 4'})
    dump(path,j)

# ---------------------------------------------------------------- herb cabinet: the middle drawer slides out
def cabinet():
    path,j=geo('herb_cabinet');g=j['minecraft:geometry'][0];front=bone(g,'drawer_5');label=bone(g,'shown_1')
    plate=front['cubes'][0];side=plate['uv']['up']
    out=[]
    for name,depth in (('half',1.3),('open',2.7)):
        cubes=[moved(c,dz=-depth) for c in front['cubes']]
        (x,y,z),(w,h,d)=plate['origin'],plate['size']
        # The drawer's box, so an open drawer is not a floating front plate.
        cubes.append({'origin':[round(x+.2,4),round(y+.2,4),round(z+d-depth,4)],'size':[round(w-.4,4),round(h-.4,4),depth],
                      'uv':{face:copy.deepcopy(side) for face in ('up','down','east','west')}})
        out.append(dict(copy.deepcopy(front),name='drawer_5_'+name,cubes=cubes))
        out.append(dict(copy.deepcopy(label),name='shown_1_'+name,cubes=[moved(c,dz=-depth) for c in label['cubes']]))
    set_bones(g,out);dump(path,j)
    path,j=block('decor/herb_cabinet');b=j['minecraft:block']
    states(b,**{NS+'drawer':{'values':{'min':0,'max':2}}})
    shown="(%s > 0 || %s > 0)"%(q('shown'),q('shown_page'))
    visibility(b,{'drawer_5':q('drawer')+' == 0','drawer_5_half':q('drawer')+' == 1','drawer_5_open':q('drawer')+' == 2',
                  'shown_1':shown+' && '+q('drawer')+' == 0','shown_1_half':shown+' && '+q('drawer')+' == 1',
                  'shown_1_open':shown+' && '+q('drawer')+' == 2'})
    dump(path,j)

# ---------------------------------------------------------------- bowls: the broth goes down with each sip
# The bowl's inner wall is about 3.5 px from the axis above y = 3 and about 2.6 px below it; each lowered
# surface is a cross of two rectangles whose corners stay inside the wall.
LEVELS=((1,3.55,3.5,2.5,.85),(2,2.6,2.6,1.8,.65))   # sips, height, half long side, half short side, topping spread
def bowl(name):
    path,j=geo(name);g=j['minecraft:geometry'][0];soup=bone(g,'soup');top=bone(g,'toppings')
    sface=soup['cubes'][0]['uv']['up'];(u0,v0),(us,vs)=sface['uv'],sface['uv_size']
    y0=soup['cubes'][0]['origin'][1];out=[]
    for sips,y,a,b_,spread in LEVELS:
        cubes=[]
        for hx,hz in ((a,b_),(b_,a)):
            uv=copy.deepcopy(sface);uv['uv']=[round(u0+us/2-hx*us/8,3),round(v0+vs/2-hz*vs/8,3)];uv['uv_size']=[round(2*hx*us/8,3),round(2*hz*vs/8,3)]
            cubes.append({'origin':[-hx,y,-hz],'size':[2*hx,0,2*hz],'uv':{'up':uv}})
        out.append(dict(copy.deepcopy(soup),name='soup_%d'%sips,cubes=cubes))
        out.append(dict(copy.deepcopy(top),name='toppings_%d'%sips,cubes=[moved(c,dy=y-y0,scale=spread) for c in top['cubes']]))
    set_bones(g,out);dump(path,j)
    path,j=block('decor/'+name);b=j['minecraft:block']
    states(b,**{NS+'sips':{'values':{'min':0,'max':3}}})
    rules={'soup':q('sips')+' == 0','toppings':q('sips')+' == 0'}
    for sips,*_ in LEVELS:rules['soup_%d'%sips]=q('sips')+' == %d'%sips;rules['toppings_%d'%sips]=q('sips')+' == %d'%sips
    visibility(b,rules);dump(path,j)

# ---------------------------------------------------------------- teas: steam over the cups
TEAS=['honeysuckle_tea','honeysuckle_tea_dew','chrysanthemum_tea','goji_tea','jujube_tea']
def tea(name):
    path,j=block('decor/'+name);c=j['minecraft:block']['components']
    c[NS+'tea_steam']={};c['minecraft:tick']={'interval_range':[60,100],'looping':True}
    dump(path,j)
STEAM={"format_version":"1.10.0","particle_effect":{"description":{"identifier":NS+"tea_steam","basic_render_parameters":{"material":"particles_blend","texture":"textures/kaleidoscope_herbal/particle/incense_smoke"}},
 "components":{"minecraft:emitter_rate_steady":{"spawn_rate":3,"max_particles":5},"minecraft:emitter_lifetime_once":{"active_time":1.4},
  "minecraft:emitter_shape_box":{"offset":[0,0,0],"half_dimensions":[0.22,0,0.22],"direction":[0,1,0]},
  "minecraft:particle_lifetime_expression":{"max_lifetime":1.8},"minecraft:particle_initial_speed":0.08,
  "minecraft:particle_motion_dynamic":{"linear_acceleration":[0.01,0.035,0],"linear_drag_coefficient":0.08},
  "minecraft:particle_appearance_billboard":{"size":["0.02 + v.particle_age * 0.025","0.03 + v.particle_age * 0.04"],"facing_camera_mode":"lookat_xyz","uv":{"texture_width":16,"texture_height":16,"uv":[0,0],"uv_size":[16,16]}},
  "minecraft:particle_appearance_tinting":{"color":{"gradient":{"0.0":[0.95,0.97,0.96,0.5],"1.0":[0.95,0.97,0.96,0]},"interpolant":"v.particle_age / v.particle_lifetime"}}}}}
# A short burst of powder, coloured by the script (variable.color).
PUFF={"format_version":"1.10.0","particle_effect":{"description":{"identifier":NS+"powder_puff","basic_render_parameters":{"material":"particles_alpha","texture":"textures/particle/particles"}},
 "components":{"minecraft:emitter_rate_instant":{"num_particles":7},"minecraft:emitter_lifetime_once":{"active_time":0.1},
  "minecraft:emitter_shape_disc":{"offset":[0,0,0],"radius":0.12,"plane_normal":"y","surface_only":False,"direction":"outwards"},
  "minecraft:particle_lifetime_expression":{"max_lifetime":"0.35 + v.particle_random_1 * 0.25"},
  "minecraft:particle_initial_speed":"0.9 + v.particle_random_2 * 0.6",
  "minecraft:particle_motion_dynamic":{"linear_acceleration":[0,-2.2,0],"linear_drag_coefficient":2.5},
  "minecraft:particle_appearance_billboard":{"size":[0.045,0.045],"facing_camera_mode":"lookat_xyz","uv":{"texture_width":128,"texture_height":128,"uv":[8,0],"uv_size":[8,8]}},
  "minecraft:particle_appearance_tinting":{"color":["v.color.r","v.color.g","v.color.b",1]}}}}

def soups():
    with open(os.path.join(BP,'scripts','data','placeableSoups.js'),encoding='utf-8') as f:s=f.read()
    return [k.split(':')[1] for k in json.loads(s[s.index('{'):s.rindex('}')+1])]

if __name__=='__main__':
    mortar();clay_pot();cabinet()
    for name in soups():bowl(name)
    for name in TEAS:tea(name)
    dump(os.path.join(RP,'particles','tea_steam.json'),STEAM);dump(os.path.join(RP,'particles','powder_puff.json'),PUFF)
    print('models and blocks updated: mortar, clay pot, herb cabinet, %d bowls, %d teas'%(len(soups()),len(TEAS)))
