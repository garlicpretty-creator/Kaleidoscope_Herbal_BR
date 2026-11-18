"""Placeholder art for the 1.2 code, until the real art is drawn. Usage: python3 tools/placeholders.py

Writes into the resource pack:
  - the hut marker's fully transparent block texture (it is meant to stay invisible; not a placeholder)

The honey pill icons are drawn by tools/honey_pills.py and tools/icons.py; the wandering herbalist's model and
texture by tools/herbalist_model.py.
"""
import json,os
from PIL import Image
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

# ---------------------------------------------------------------- hut marker: invisible on purpose
def hut_marker():
    folder=os.path.join(TEX,'blocks');Image.new('RGBA',(16,16),(0,0,0,0)).save(os.path.join(folder,'hut_marker.png'));texture_set(folder,'hut_marker')
    path=os.path.join(RP,'textures','terrain_texture.json')
    with open(path,encoding='utf-8') as f:j=json.load(f)
    j['texture_data']['kh_hut_marker']={'textures':'textures/%s/blocks/hut_marker'%NS};dump(path,j)

if __name__=='__main__':
    hut_marker();print('hut marker written')
