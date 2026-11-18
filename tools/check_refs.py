"""Reference check for both packs. Usage: python3 tools/check_refs.py
Fails (exit 1) when something points at an id, texture, model or text that does not exist.
Lists (without failing) what nothing points at: unused textures and unused text keys."""
import json,os,re,sys
root=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..')
BP=os.path.join(root,'Kaleidoscope Herbal [BP]');RP=os.path.join(root,'Kaleidoscope Herbal [RP]');NS='kaleidoscope_herbal:'
def files(base,sub,ext='.json'):
    for d,_,fs in os.walk(os.path.join(base,sub)):
        for f in sorted(fs):
            if f.endswith(ext):yield os.path.join(d,f)
load=lambda p:json.load(open(p,encoding='utf-8'))
text=lambda p:open(p,encoding='utf-8').read()
errors=[];err=lambda *a:errors.append(' '.join(map(str,a)))
blocks={};items={}
for p in files(BP,'blocks'):b=load(p)['minecraft:block'];blocks[b['description']['identifier']]=b
for p in files(BP,'items'):i=load(p)['minecraft:item'];items[i['description']['identifier']]=i
known=set(blocks)|set(items)
entities={load(p)['minecraft:entity']['description']['identifier'] for p in files(BP,'entities')} if os.path.isdir(os.path.join(BP,'entities')) else set()
terrain=load(os.path.join(RP,'textures/terrain_texture.json'))['texture_data']
itex=load(os.path.join(RP,'textures/item_texture.json'))['texture_data']
geos=set()
for p in files(RP,'models'):
    for g in load(p).get('minecraft:geometry',[]):geos.add(g['description']['identifier'])
langs={l:dict(x.split('=',1) for x in text(os.path.join(RP,'texts',l+'.lang')).splitlines() if '=' in x and not x.startswith('#')) for l in load(os.path.join(RP,'texts/languages.json'))}
used_tex=set();used_keys=set()
def need_key(key,where):
    used_keys.add(key)
    for l,table in langs.items():
        if key not in table:err('text',key,'missing in',l,'<-',where)
def strings(o):
    if isinstance(o,str):yield o
    elif isinstance(o,dict):
        for k,v in o.items():yield k;yield from strings(v)
    elif isinstance(o,list):
        for v in o:yield from strings(v)
# blocks
for name,b in blocks.items():
    comps=[b.get('components',{})]+[p.get('components',{}) for p in b.get('permutations',[])]
    for c in comps:
        for inst in c.get('minecraft:material_instances',{}).values():
            t=inst.get('texture') if isinstance(inst,dict) else None
            if t:
                used_tex.add(('terrain',t))
                if t not in terrain:err('block',name,'texture',t,'not in terrain_texture.json')
        g=c.get('minecraft:geometry');g=g.get('identifier') if isinstance(g,dict) else g
        if g and g not in geos and not g.startswith('minecraft:'):err('block',name,'geometry',g,'not found')
        d=c.get('minecraft:display_name')
        if d and d.startswith('%'):need_key(d[1:],name)
        loot=c.get('minecraft:loot')
        if loot and not os.path.exists(os.path.join(BP,loot)):err('block',name,'loot table',loot,'not found')
# model poses: every bone a block shows or hides exists in its model, every state it reads is declared
geo_bones={}
for p in files(RP,'models'):
    for g in load(p).get('minecraft:geometry',[]):geo_bones[g['description']['identifier']]={b['name'] for b in g['bones']}
for name,b in blocks.items():
    declared=set(b['description'].get('states',{}))|set(b['description'].get('traits',{}).get('minecraft:placement_direction',{}).get('enabled_states',[]))
    for c in [b.get('components',{})]+[p.get('components',{}) for p in b.get('permutations',[])]:
        g=c.get('minecraft:geometry')
        if not isinstance(g,dict):continue
        for bone_name,rule in g.get('bone_visibility',{}).items():
            if bone_name not in geo_bones.get(g['identifier'],set()):err('block',name,'shows bone',bone_name,'missing from',g['identifier'])
            for state in re.findall(r"q\.block_state\('([^']+)'\)",str(rule)):
                if state not in declared:err('block',name,'reads undeclared state',state)
# items
for name,i in items.items():
    c=i['components'];icon=c.get('minecraft:icon');icon=icon.get('textures',{}).get('default') if isinstance(icon,dict) else icon
    if icon:
        used_tex.add(('item',icon))
        if icon not in itex:err('item',name,'icon',icon,'not in item_texture.json')
    d=c.get('minecraft:display_name',{}).get('value','')
    if d.startswith('%'):need_key(d[1:],name)
    placer=c.get('minecraft:block_placer',{}).get('block')
    if placer and placer not in blocks:err('item',name,'places missing block',placer)
# texture files behind the registries
tex_files=set()
for table,kind in((terrain,'terrain'),(itex,'item')):
    for key,v in table.items():
        paths=v['textures'];paths=[paths] if isinstance(paths,str) else [x if isinstance(x,str) else x.get('path') for x in paths]
        for path in paths:
            tex_files.add(path)
            if not os.path.exists(os.path.join(RP,path+'.png')):err(kind,'texture',key,'file missing:',path)
        if (kind,key) not in used_tex:print('unused',kind,'texture key:',key)
# ids named in data files and scripts
for sub in('recipes','loot_tables','features','feature_rules','item_catalog'):
    for p in files(BP,sub):
        for s in strings(load(p)):
            if s.startswith(NS) and s not in known and not re.search(r'[:/](feature|rule|wild_|herb_hut|.*_feature)',s) and sub not in('features','feature_rules'):err(os.path.relpath(p,root),'names missing',s)
            if sub in('features','feature_rules') and s.startswith(NS) and s in known:pass
for p in files(BP,'features'):
    for s in strings(load(p)):
        m=re.fullmatch(NS+r'[a-z_]+',s)
        if m and ('places_block' in text(p) or 'block' in text(p)) and s not in known and not any(s==load(q).get(k,{}).get('description',{}).get('identifier') for q in files(BP,'features') for k in load(q) if k!='format_version'):err(os.path.relpath(p,root),'names missing',s)
script=''
for p in files(BP,'scripts','.js'):
    t=text(p);script+=t if not p.endswith('guidebook.js') else ''
    for s in set(re.findall(r'kaleidoscope_herbal:[a-z_]+',t)):
        if p.endswith('guidebook.js') and s not in known and s not in('kaleidoscope_herbal:guidebook','kaleidoscope_herbal:herb_hut') and not s.endswith('_crop'):err('guidebook names missing',s)
    for m in set(re.findall(r'textures/kaleidoscope_herbal/[a-z_/0-9]*[a-z0-9]',t)):
        if m.endswith(('/items','/ui','/blocks','/models')):continue
        tex_files.add(m)
        if not os.path.exists(os.path.join(RP,m+'.png')):err(os.path.relpath(p,root),'texture missing',m)
# textures a client entity draws
for p in files(RP,'entity'):
    tex_files|=set(load(p)['minecraft:client_entity']['description'].get('textures',{}).values())
particles=set()
for p in files(RP,'particles'):
    t=text(p);particles|=set(re.findall(r'"identifier"\s*:\s*"kaleidoscope_herbal:([a-z_]+)"',t));tex_files|=set(re.findall(r'textures/kaleidoscope_herbal/[a-z_/0-9]+',t))
state_names={s.split(':')[1] for b in blocks.values() for s in b['description'].get('states',{})}
component_names=set(re.findall(r'"kaleidoscope_herbal:([a-z_]+)"',''.join(json.dumps(b.get('components',{}))+json.dumps(b.get('permutations',[])) for b in blocks.values())))
for s in set(re.findall(r"\bid\('([a-z_/]+)'\)",script)):
    if NS+s not in known and s not in state_names and s not in component_names and s not in particles and '/' not in s and NS+s not in entities and s not in('heat','heat_hint','formula','salt','learned','sealed_prescription','pill_of','huts','herb','herbal_trowel','ginseng','four_herb','reishi','cordyceps','four_gentlemen','mugwort_angelica','licorice_jujube'):err('script id() names missing',s)
for key in set(re.findall(r"'(kh\.[a-z_]+\.[a-z_.]*[a-z_])'",script)):need_key(key,'script')
for m in re.finditer(r"`(kh\.[a-z_.]+)\$\{",script):
    for k in list(langs[next(iter(langs))]):
        if k.startswith(m.group(1)):used_keys.add(k)
# every placed block and item needs its fallback game keys too
for l,table in langs.items():
    for k in table:
        m=re.fullmatch(r'(item|tile)\.(kaleidoscope_herbal:[a-z_]+)\.name',k)
        if m:
            used_keys.add(k)
            if m.group(2) not in known:err('text',k,'in',l,'is for a missing id')
unused=sorted(k for k in langs[next(iter(langs))] if k not in used_keys and not k.startswith('pack.'))
print('unused text keys:',len(unused),unused[:60])
on_disk={os.path.relpath(p,RP)[:-4].replace(os.sep,'/') for p in files(RP,'textures','.png') if not p.endswith(('_normal.png','_mer.png','_mers.png'))}
print('unused texture files:',sorted(on_disk-tex_files))
if errors:
    print('FAIL',len(errors));[print(' ',e) for e in errors];sys.exit(1)
print('OK: %d blocks, %d items, %d text keys x %d languages'%(len(blocks),len(items),len(langs[next(iter(langs))]),len(langs)))
