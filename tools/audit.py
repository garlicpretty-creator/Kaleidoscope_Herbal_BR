"""Completeness audit of the two packs. Usage: python3 tools/audit.py
Goes further than check_refs.py: for every item and block it follows each reference to the file that must exist
(icon, texture set, geometry, bones, atlas bounds, loot, recipe, name in every language, guidebook entry), and checks
the world-generation files, the manifests and the things that should not be left over. Exit code 1 on any problem."""
import os,sys,json,glob,re
ROOT=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..')
BP=os.path.join(ROOT,'Kaleidoscope Herbal [BP]');RP=os.path.join(ROOT,'Kaleidoscope Herbal [RP]');NS='kaleidoscope_herbal'
problems=[];notes=[]
def bad(kind,what): problems.append((kind,what))
def load(p):
    with open(p,encoding='utf-8-sig') as f: return json.load(f)
def files(base,pattern): return sorted(glob.glob(os.path.join(glob.escape(base),pattern),recursive=True))
def png_size(p):
    with open(p,'rb') as f: d=f.read(26)
    return int.from_bytes(d[16:20],'big'),int.from_bytes(d[20:24],'big')
def walk(o):
    if isinstance(o,dict):
        yield o
        for v in o.values(): yield from walk(v)
    elif isinstance(o,list):
        for v in o: yield from walk(v)
# ---------------------------------------------------------------- inventory
items={};blocks={}
for p in files(BP,'items/**/*.json'):
    j=load(p)['minecraft:item'];items[j['description']['identifier']]=(p,j)
for p in files(BP,'blocks/**/*.json'):
    j=load(p)['minecraft:block'];blocks[j['description']['identifier']]=(p,j)
item_tex=load(os.path.join(RP,'textures','item_texture.json'))['texture_data']
terrain=load(os.path.join(RP,'textures','terrain_texture.json'))['texture_data']
geos={}
for p in files(RP,'models/**/*.geo.json'):
    for g in load(p)['minecraft:geometry']:
        gid=g['description']['identifier']
        if gid in geos: bad('geometry','%s is defined twice'%gid)
        geos[gid]=(p,g)
langs={}
for pack in (RP,BP):
    for p in files(pack,'texts/*.lang'):
        keys={}
        for line in open(p,encoding='utf-8-sig'):
            line=line.rstrip('\n').rstrip('\r')
            if '=' in line and not line.lstrip().startswith('#'): k,v=line.split('=',1);keys[k.strip()]=v
        langs[(os.path.basename(pack)[-3:-1],os.path.basename(p))]=keys
rp_langs={n:k for (pack,n),k in langs.items() if pack=='RP'}
def tex_ok(path,what,need_set=True):
    full=os.path.join(RP,path+'.png')
    if not os.path.exists(full): bad('texture','%s: %s.png is missing'%(what,path));return
    if need_set:
        s=os.path.join(RP,path+'.texture_set.json')
        if not os.path.exists(s): bad('pbr','%s: %s has no texture set'%(what,path));return
        t=load(s)['minecraft:texture_set'];size=png_size(full)
        for k,v in t.items():
            if isinstance(v,str):
                q=os.path.join(os.path.dirname(full),v+'.png')
                if not os.path.exists(q): bad('pbr','%s: %s map %s is missing'%(what,k,v))
                elif png_size(q)!=size: bad('pbr','%s: %s map is %s, colour is %s'%(what,k,png_size(q),size))
def named(key,what):
    for lang,keys in rp_langs.items():
        if not keys.get(key,'').strip(): bad('text','%s: no "%s" in %s'%(what,key,lang))
# ---------------------------------------------------------------- items
used_icons=set()
for iid,(p,j) in items.items():
    c=j['components'];icon=c.get('minecraft:icon')
    icon=icon if isinstance(icon,str) else (icon or {}).get('textures',{}).get('default') if isinstance(icon,dict) else None
    if not icon: bad('item','%s has no icon'%iid)
    elif icon not in item_tex: bad('item','%s: icon %s is not in item_texture.json'%(iid,icon))
    else: used_icons.add(icon);tex_ok(item_tex[icon]['textures'],iid)
    dn=c.get('minecraft:display_name');dn=dn.get('value') if isinstance(dn,dict) else dn
    if dn: named(dn.lstrip('%'),iid)
    else: named('item.%s'%iid,iid)
    placer=c.get('minecraft:block_placer')
    if placer and placer.get('block') not in blocks and str(placer.get('block')).startswith(NS): bad('item','%s places %s, which does not exist'%(iid,placer.get('block')))
# ---------------------------------------------------------------- blocks
used_geo=set();used_terrain=set();loot_used=set()
for bid,(p,j) in blocks.items():
    comps=[j['components']]+[x['components'] for x in j.get('permutations',[])]
    states=set(j['description'].get('states',{}))|{s for tr in j['description'].get('traits',{}).values() for s in tr.get('enabled_states',[])}
    for c in comps:
        g=c.get('minecraft:geometry')
        if g:
            gid=g if isinstance(g,str) else g['identifier']
            if gid.startswith('geometry.'+NS):
                if gid not in geos: bad('block','%s: geometry %s does not exist'%(bid,gid));continue
                used_geo.add(gid);bones={b['name'] for b in geos[gid][1].get('bones',[])}
                if isinstance(g,dict):
                    for bone,expr in g.get('bone_visibility',{}).items():
                        if bone not in bones: bad('block','%s: bone_visibility names bone "%s", not in %s'%(bid,bone,gid))
                        for st in re.findall(r"block_state\('([^']+)'\)",str(expr)):
                            if st not in states: bad('block','%s: bone_visibility reads state %s, which the block does not have'%(bid,st))
        for name,m in (c.get('minecraft:material_instances') or {}).items():
            t=m.get('texture')
            if t not in terrain: bad('block','%s: texture %s is not in terrain_texture.json'%(bid,t))
            else: used_terrain.add(t);tex_ok(terrain[t]['textures'],bid)
        loot=c.get('minecraft:loot')
        if loot:
            loot_used.add(loot)
            if not os.path.exists(os.path.join(BP,loot)): bad('block','%s: loot table %s is missing'%(bid,loot))
        dn=c.get('minecraft:display_name')
        if dn: named(dn.lstrip('%'),bid)
    if not any('minecraft:geometry' in c for c in comps): bad('block','%s has no geometry'%bid)
    for cond in {x.get('condition','') for x in j.get('permutations',[])}:
        for st in set(re.findall(r"block_state\('([^']+)'\)",cond)):
            if st not in states: bad('block','%s: a permutation reads state %s, which the block does not have'%(bid,st))
sounds=load(os.path.join(RP,'blocks.json'))
for bid in blocks:
    if bid not in sounds: bad('block','%s has no entry in RP blocks.json (sound)'%bid)
for bid in sounds:
    if bid.startswith(NS) and bid not in blocks: bad('leftover','RP blocks.json lists %s, which is not a block'%bid)
# ---------------------------------------------------------------- geometry: every face inside its texture
for gid,(p,g) in geos.items():
    if gid not in used_geo: bad('leftover','geometry %s is used by no block'%gid)
    tw=g['description'].get('texture_width',64);th=g['description'].get('texture_height',64)
    for b in g.get('bones',[]):
        for c in b.get('cubes',[]):
            if isinstance(c.get('uv'),dict):
                for face,f in c['uv'].items():
                    u,v=f['uv'];w,h=f.get('uv_size',[0,0])
                    if min(u,u+w)<0 or max(u,u+w)>tw or min(v,v+h)<0 or max(v,v+h)>th: bad('geometry','%s: a %s face reaches outside the %dx%d texture'%(gid,face,tw,th))
# ---------------------------------------------------------------- loot tables, recipes, catalog
known=set(items)|set(blocks)
def own(x): return isinstance(x,str) and x.startswith(NS+':')
for p in files(BP,'loot_tables/**/*.json'):
    rel=os.path.relpath(p,BP).replace(os.sep,'/')
    for o in walk(load(p)):
        if o.get('type')=='item' and own(o.get('name')) and o['name'] not in known: bad('loot','%s drops %s, which does not exist'%(rel,o['name']))
recipe_out=set()
for p in files(BP,'recipes/**/*.json'):
    rel=os.path.relpath(p,BP).replace(os.sep,'/');j=load(p)
    for o in walk(j):
        for k in ('item','result'):
            v=o.get(k)
            if own(v) and v not in known: bad('recipe','%s uses %s, which does not exist'%(rel,v))
    for body in j.values():
        if isinstance(body,dict):
            r=body.get('result');r=r if isinstance(r,list) else [r]
            for x in r:
                recipe_out.add(x.get('item') if isinstance(x,dict) else x)
catalog=load(files(BP,'item_catalog/*.json')[0]);cat=json.dumps(catalog)
# an item's own menu_category must be the tab and group the catalog lists it under, and a group's icon one of its items
for c in catalog['minecraft:crafting_items_catalog']['categories']:
    for g in c['groups']:
        gi=g.get('group_identifier',{})
        if gi.get('icon') and gi['icon'] not in g['items']: bad('catalog','group %s shows %s, which is not in the group'%(gi.get('name'),gi['icon']))
        for x in g['items']:
            if x not in known: bad('catalog','%s is listed but does not exist'%x);continue
            m=(items.get(x) or blocks.get(x))[1]['description'].get('menu_category',{})
            if m.get('category')!=c['category_name'] or m.get('group')!=gi.get('name'): bad('catalog','%s says %s / %s but is listed under %s / %s'%(x,m.get('category'),m.get('group'),c['category_name'],gi.get('name')))
            if x in items and x in blocks and blocks[x][1]['description'].get('menu_category')!=items[x][1]['description'].get('menu_category'): bad('catalog','%s: its item and its block name different groups'%x)
for iid in items:
    if iid not in cat: notes.append('item %s is not in the creative item catalog'%iid)
# ---------------------------------------------------------------- scripts: every id they name exists
script_ids=set()
for p in files(BP,'scripts/**/*.js'):
    s=open(p,encoding='utf-8').read()
    script_ids|=set(re.findall(r"['\"](%s:[a-z0-9_]+)['\"]"%NS,s))
events={'api_ping','api_ready','catalog_request','catalog','heat_register','heat_ack','heat_request','heat_add','heat','recipe_register','recipe_ack',
        'adjuvant_register','adjuvant_ack','evt','guidebook'}
custom=set()
for _,j in list(items.values())+list(blocks.values()):
    for o in walk(j): custom|={k for k in o if k.startswith(NS+':')}
states={s for _,j in blocks.values() for s in j['description'].get('states',{})}
particles={load(p)['particle_effect']['description']['identifier'] for p in files(RP,'particles/*.json')}
tags={t[4:] for _,j in blocks.values() for o in walk(j) for t in o if t.startswith('tag:')}
for sid in sorted(script_ids):
    if sid in known or sid in custom or sid in states or sid in particles or sid in tags or sid.split(':')[1] in events: continue
    notes.append('scripts name %s, which is not an item, block, component, state, particle or tag of this pack'%sid)
guide=open(os.path.join(BP,'scripts','data','guidebook.js'),encoding='utf-8').read()
for icon in set(re.findall(r'"icon":"([^"]+)"',guide)):
    if icon.startswith('textures/'+NS) and not os.path.exists(os.path.join(RP,icon+'.png')): bad('guidebook','icon %s.png is missing'%icon)
for iid in items:
    if iid not in guide: notes.append('item %s has no guidebook entry'%iid)
# ---------------------------------------------------------------- world generation and structures
feats={load(p)[k]['description']['identifier'] for p in files(BP,'features/**/*.json') for k in load(p) if k!='format_version'}
for p in files(BP,'feature_rules/**/*.json'):
    r=load(p)['minecraft:feature_rules'];f=r['description']['places_feature']
    if f not in feats: bad('worldgen','%s places %s, which does not exist'%(os.path.basename(p),f))
for p in files(BP,'features/**/*.json'):
    for o in walk(load(p)):
        for v in o.values():
            for x in (v if isinstance(v,list) else [v]):
                if own(x) and x not in known and x not in feats and not x.endswith(('_feature',)) and ':' in x and '/' not in x:
                    name=x.split(':')[1]
                    if not os.path.exists(os.path.join(BP,'structures',NS,name+'.mcstructure')): bad('worldgen','%s names %s, which is not a block, feature or structure'%(os.path.basename(p),x))
for herb in sorted(b for b in blocks if b.startswith(NS+':wild_')):
    if not any(herb in open(p,encoding='utf-8').read() for p in files(BP,'features/**/*.json')): notes.append('%s is placed by no world-generation feature'%herb)
# ---------------------------------------------------------------- languages, manifests, leftovers
ref=rp_langs.get('en_US.lang',{})
for lang,keys in rp_langs.items():
    if set(keys)!=set(ref): bad('text','%s and en_US.lang differ in keys: %s'%(lang,sorted(set(keys)^set(ref))[:6]))
    for k,v in keys.items():
        if not v.strip(): bad('text','%s: %s is empty'%(lang,k))
for pack in (BP,RP):
    m=load(os.path.join(pack,'manifest.json'));vs={tuple(m['header']['version'])}|{tuple(x['version']) for x in m['modules']}
    if len(vs)!=1: bad('manifest','%s carries several versions: %s'%(os.path.basename(pack),vs))
    for f in ('pack_icon.png',):
        if not os.path.exists(os.path.join(pack,f)): bad('manifest','%s has no %s'%(os.path.basename(pack),f))
bm=load(os.path.join(BP,'manifest.json'));rm=load(os.path.join(RP,'manifest.json'))
if not any(d.get('uuid')==rm['header']['uuid'] and d.get('version')==rm['header']['version'] for d in bm.get('dependencies',[])): bad('manifest','the behaviour pack does not depend on this version of the resource pack')
ver=re.search(r"VERSION='([^']+)'",open(os.path.join(BP,'scripts','data','version.js'),encoding='utf-8').read()).group(1)
if ver!='.'.join(map(str,bm['header']['version'])): bad('manifest','version.js says %s, the manifest %s'%(ver,bm['header']['version']))
if '"version":"%s"'%ver not in guide: bad('manifest','the guidebook does not carry version %s'%ver)
entry=next(x['entry'] for x in bm['modules'] if x['type']=='script')
if not os.path.exists(os.path.join(BP,entry)): bad('manifest','script entry %s is missing'%entry)
for p in files(BP,'scripts/**/*.js'):
    for imp in re.findall(r"from '(\.[^']+)'",open(p,encoding='utf-8').read()):
        if not os.path.exists(os.path.normpath(os.path.join(os.path.dirname(p),imp))): bad('script','%s imports %s, which is missing'%(os.path.relpath(p,BP),imp))
for k in item_tex:
    if k not in used_icons and item_tex[k]['textures'].split('/')[-1] not in guide: bad('leftover','item_texture.json entry %s is used by no item and no guidebook page'%k)
for k in terrain:
    if k not in used_terrain: notes.append('terrain_texture.json entry %s is used by no block material'%k)
for p in files(BP,'loot_tables/**/*.json'):
    rel=os.path.relpath(p,BP).replace(os.sep,'/')
    if rel not in loot_used and rel not in open(os.path.join(BP,'scripts','main.js'),encoding='utf-8').read() and not any(rel in open(q,encoding='utf-8').read() for q in files(BP,'scripts/**/*.js')+files(BP,'structures/**/*.json')+files(BP,'features/**/*.json')): notes.append('loot table %s is referenced by no block or script'%rel)
print('%d items, %d blocks, %d geometries, %d item icons, %d languages'%(len(items),len(blocks),len(geos),len(used_icons),len(rp_langs)))
for n in notes: print('note:',n)
for kind,what in problems: print('PROBLEM [%s] %s'%(kind,what))
print('%d problems, %d notes'%(len(problems),len(notes)))
sys.exit(1 if problems else 0)
