"""Leaf translucency (subsurface scattering) for Vibrant Visuals. Usage: python3 tools/subsurface.py

Turns the plant atlas and the leaf texture from a MER map into a MERS map: the same metalness, emissive and
roughness, plus subsurface in the alpha channel, so sunlight shines through leaves and petals. Format checked
against Microsoft's texture set reference: texture set format_version 1.21.30, layer
"metalness_emissive_roughness_subsurface" (a 4-channel image), which replaces "metalness_emissive_roughness"
(the two may not both be set). Subsurface and metalness exclude each other; these textures have no metal.

Subsurface by colour: green leaves 150, petals, flowers and fruit 100, white mycelium and cream fungus 40, stems, bark, soil
and dark parts 0. Transparent pixels 0.

The first run renames <name>_mer.png to <name>_mers.png. Tools that paint into the plant atlas
(plant_models.py, poria_spawn.py) edit the RGB of the _mers.png; rerun this script after them to refresh
the alpha. Safe to rerun.
"""
import colorsys,json,os
from PIL import Image
TEX=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','Kaleidoscope Herbal [RP]','textures','kaleidoscope_herbal')
TARGETS=[os.path.join(TEX,'models','plants'),os.path.join(TEX,'blocks','leaf')]

def subsurface(r,g,b,a):
    if a==0:return 0
    h,s,v=colorsys.rgb_to_hsv(r/255,g/255,b/255)
    if v<.22:return 0                                   # dark stems, shadows
    if s<.16:return 40 if v>.75 else 0                  # white mycelium / grey parts
    if .17<=h<=.47:return 150                           # greens: leaves
    if (h<.11 or h>.85) and v<.5:return 0               # brown bark, soil, roots
    if .06<=h<.17 and s>.25 and v<.62:return 0          # tan stems and soil
    if .05<=h<.17 and s<.55:return 40                   # cream and tan fungus caps
    return 100                                          # petals, flowers, fruit

def convert(base):
    col=Image.open(base+'.png').convert('RGBA')
    src=base+'_mers.png' if os.path.exists(base+'_mers.png') else base+'_mer.png'
    mer=Image.open(src).convert('RGBA');out=Image.new('RGBA',col.size)
    n=0
    for y in range(col.size[1]):
        for x in range(col.size[0]):
            m=mer.getpixel((x,y));s=subsurface(*col.getpixel((x,y)))
            if m[0]>0:s=0                                # metal pixels keep their metal
            out.putpixel((x,y),(m[0],m[1],m[2],s));n+=s>0
    out.save(base+'_mers.png')
    if src.endswith('_mer.png'):os.remove(src)
    name=os.path.basename(base)
    with open(base+'.texture_set.json','w',encoding='utf-8') as f:
        f.write(json.dumps({"format_version":"1.21.30","minecraft:texture_set":{"color":name,"normal":name+"_normal",
            "metalness_emissive_roughness_subsurface":name+"_mers"}},separators=(',',':')))
    print('%s: %d translucent pixels'%(name,n))

if __name__=='__main__':
    for t in TARGETS:convert(t)
